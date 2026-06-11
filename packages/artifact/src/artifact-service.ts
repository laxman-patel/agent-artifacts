import { createHash, randomUUID } from "node:crypto";
import type { ArtifactAccess } from "@agent-artifacts/access";
import type { BillingService } from "@agent-artifacts/billing";
import type { WorkspaceAccess } from "@agent-artifacts/workspace";
import type { ArtifactAction, ArtifactType, Principal } from "@agent-artifacts/shared";
import { buildWorkspaceProjectArtifactUrl } from "@agent-artifacts/shared";
import type { ArtifactStorage } from "@agent-artifacts/storage";
import { createVersionSourceKey } from "@agent-artifacts/storage";
import { createTwoFilesPatch } from "diff";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  ArtifactIntegrityError,
  ArtifactNotFoundError,
  SlugUnavailableError,
  contentTypeForArtifact,
  createArtifactInputSchema,
  createWorkspaceArtifactInputSchema,
  restoreArtifactVersionInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema,
  type ArtifactAccessSnapshot,
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactSummary,
  type ArtifactVersionRecord,
  type CreateArtifactInput,
  type CreateWorkspaceArtifactInput,
  type RestoreArtifactVersionInput,
  type SetArtifactAccessInput,
  type UpdateArtifactInput
} from "./artifact-types.js";
import { validateProjectSlug } from "./project.js";
import { validateSlug } from "./slug.js";

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

type ArtifactBillingGuard = Pick<
  BillingService,
  "assertCanCreateArtifact" | "assertCanWriteVersion" | "assertCanSetArtifactAccess" | "getAccountEntitlements"
> & {
  recordVersionWrite?(input: { ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }): Promise<void>;
  recordDelivery?(input: { ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }): Promise<void>;
};

export class ArtifactService {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly storage: ArtifactStorage,
    private readonly appUrl: string,
    private readonly access: ArtifactAccess,
    private readonly workspaceAccess: WorkspaceAccess,
    private readonly billing?: ArtifactBillingGuard
  ) {}

  async checkSlugAvailability(
    ownerUsername: string,
    projectSlug: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; projectId: string; normalizedSlug: string }> {
    const normalizedSlug = validateSlug(slug);
    const project = await this.requireProject(ownerUsername, projectSlug);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: {
        kind: "namespace",
        ownerUserId: project.ownerUserId,
        workspaceId: project.workspaceId
      }
    });
    const available = !(await this.repository.slugExistsInProject(project.id, normalizedSlug));

    return { available, ownerUserId: project.ownerUserId, projectId: project.id, normalizedSlug };
  }

  async createArtifact(input: CreateArtifactInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = createArtifactInputSchema.parse(input);
    const project = await this.requireProject(parsed.ownerUsername, parsed.projectSlug);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: {
        kind: "namespace",
        ownerUserId: project.ownerUserId,
        workspaceId: project.workspaceId
      }
    });
    return this.createArtifactInProject({ project, namespaceSlug: parsed.ownerUsername, artifact: parsed, principal });
  }

  async createWorkspaceArtifact(
    workspaceId: string,
    workspaceSlug: string,
    input: CreateWorkspaceArtifactInput,
    principal: Principal
  ): Promise<ArtifactSummary> {
    const parsed = createWorkspaceArtifactInputSchema.parse(input);
    const project = await this.requireWorkspaceProject(workspaceId, parsed.projectSlug);
    await this.workspaceAccess.assertAuthorized({
      principal,
      action: "workspace.create_content",
      context: { workspaceId }
    });
    return this.createArtifactInProject({ project, namespaceSlug: workspaceSlug, artifact: parsed, principal });
  }

  private async createArtifactInProject(input: {
    project: { id: string; slug: string; workspaceId: string; ownerUserId: string };
    namespaceSlug: string;
    artifact: {
      slug: string;
      type: ArtifactType;
      title: string;
      description?: string;
      content: string;
      changelog?: string;
      access: { publicView: boolean; publicEdit: boolean };
    };
    principal: Principal;
  }): Promise<ArtifactSummary> {
    const normalizedSlug = validateSlug(input.artifact.slug);
    const available = !(await this.repository.slugExistsInProject(input.project.id, normalizedSlug));
    if (!available) {
      throw new SlugUnavailableError(normalizedSlug);
    }

    const contentBytes = byteLength(input.artifact.content);
    await this.billing?.assertCanCreateArtifact(input.project.ownerUserId, {
      publicView: input.artifact.access.publicView,
      publicEdit: input.artifact.access.publicEdit,
      contentBytes
    });

    const artifactId = randomUUID();
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: input.project.ownerUserId,
      artifactId,
      versionNumber: 1,
      type: input.artifact.type,
      content: input.artifact.content
    });

    try {
      await this.repository.createArtifact({
        artifact: {
          id: artifactId,
          ownerUserId: input.project.ownerUserId,
          projectId: input.project.id,
          slug: normalizedSlug,
          title: input.artifact.title,
          description: input.artifact.description,
          type: input.artifact.type,
          latestVersionId: versionId,
          createdByPrincipalType: input.principal.type,
          createdByPrincipalId: input.principal.id,
          publicView: input.artifact.access.publicView,
          publicEdit: input.artifact.access.publicEdit
        },
        version: {
          id: versionId,
          artifactId,
          versionNumber: 1,
          contentObjectKey: content.contentObjectKey,
          contentSha256: content.contentSha256,
          contentBytes: content.contentBytes,
          changelog: input.artifact.changelog,
          createdByPrincipalType: input.principal.type,
          createdByPrincipalId: input.principal.id
        }
      });
    } catch (error) {
      await this.deleteContent(content.contentObjectKey);
      throw error;
    }

    await this.audit(input.project.ownerUserId, artifactId, input.principal, "artifact.created", "artifact", artifactId, {
      slug: normalizedSlug,
      versionNumber: 1
    }, input.project.workspaceId);
    this.recordBillingMetering(
      "recordVersionWrite",
      this.billing?.recordVersionWrite?.({
        ownerUserId: input.project.ownerUserId,
        artifactId,
        versionNumber: 1,
        contentBytes: content.contentBytes
      })
    );

    return {
      artifactId,
      versionId,
      versionNumber: 1,
      ownerUserId: input.project.ownerUserId,
      ownerUsername: input.namespaceSlug,
      projectId: input.project.id,
      projectSlug: input.project.slug,
      normalizedSlug,
      type: input.artifact.type,
      title: input.artifact.title,
      url: buildWorkspaceProjectArtifactUrl(this.appUrl, input.namespaceSlug, input.project.slug, normalizedSlug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: input.artifact.access.publicView,
      publicEdit: input.artifact.access.publicEdit
    };
  }

  async updateArtifact(input: UpdateArtifactInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = updateArtifactInputSchema.parse(input);
    const artifact = await this.requireArtifactById(parsed.artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.update");

    const latestVersion = await this.requireVersion(artifact.id);
    if (parsed.expectedLatestVersion !== undefined && parsed.expectedLatestVersion !== latestVersion.versionNumber) {
      throw new ArtifactConflictError(`Expected latest version ${parsed.expectedLatestVersion}, got ${latestVersion.versionNumber}.`);
    }

    const namespaceSlug = artifact.workspaceId ? artifact.workspaceSlug : artifact.ownerUsername;
    if (!namespaceSlug) {
      throw new ArtifactNotFoundError();
    }

    const nextVersionNumber = latestVersion.versionNumber + 1;
    const projectedContentBytes = byteLength(parsed.content);
    await this.billing?.assertCanWriteVersion(artifact.ownerUserId, { contentBytes: projectedContentBytes });

    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: artifact.ownerUserId,
      artifactId: artifact.id,
      versionNumber: nextVersionNumber,
      type: artifact.type,
      content: parsed.content
    });

    try {
      await this.repository.createVersion({
        expectedLatestVersionId: latestVersion.id,
        version: {
          id: versionId,
          artifactId: artifact.id,
          versionNumber: nextVersionNumber,
          parentVersionId: latestVersion.id,
          contentObjectKey: content.contentObjectKey,
          contentSha256: content.contentSha256,
          contentBytes: content.contentBytes,
          changelog: parsed.changelog,
          createdByPrincipalType: principal.type,
          createdByPrincipalId: principal.id
        }
      });
    } catch (error) {
      await this.deleteContent(content.contentObjectKey);
      throw error;
    }

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.updated", "artifact_version", versionId, {
      previousVersionNumber: latestVersion.versionNumber,
      versionNumber: nextVersionNumber
    }, artifact.workspaceId ?? undefined);
    this.recordBillingMetering(
      "recordVersionWrite",
      this.billing?.recordVersionWrite?.({
        ownerUserId: artifact.ownerUserId,
        artifactId: artifact.id,
        versionNumber: nextVersionNumber,
        contentBytes: content.contentBytes
      })
    );

    return {
      artifactId: artifact.id,
      versionId,
      versionNumber: nextVersionNumber,
      ownerUserId: artifact.ownerUserId,
      ownerUsername: namespaceSlug,
      projectId: artifact.projectId,
      projectSlug: artifact.projectSlug,
      normalizedSlug: artifact.slug,
      type: artifact.type,
      title: artifact.title,
      url: buildWorkspaceProjectArtifactUrl(this.appUrl, namespaceSlug, artifact.projectSlug, artifact.slug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit
    };
  }

  async restoreArtifactVersion(input: RestoreArtifactVersionInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = restoreArtifactVersionInputSchema.parse(input);
    const artifact = await this.requireArtifactById(parsed.artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.restore");

    const latestVersion = await this.requireVersion(artifact.id);
    const sourceVersion = await this.requireVersion(artifact.id, parsed.versionNumber);
    const restoredContent = await this.readVerifiedVersionContent(sourceVersion);
    const namespaceSlug = artifact.workspaceId ? artifact.workspaceSlug : artifact.ownerUsername;
    if (!namespaceSlug) {
      throw new ArtifactNotFoundError();
    }

    const nextVersionNumber = latestVersion.versionNumber + 1;
    await this.billing?.assertCanWriteVersion(artifact.ownerUserId, { contentBytes: sourceVersion.contentBytes });

    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: artifact.ownerUserId,
      artifactId: artifact.id,
      versionNumber: nextVersionNumber,
      type: artifact.type,
      content: restoredContent
    });

    try {
      await this.repository.createVersion({
        expectedLatestVersionId: latestVersion.id,
        version: {
          id: versionId,
          artifactId: artifact.id,
          versionNumber: nextVersionNumber,
          parentVersionId: latestVersion.id,
          contentObjectKey: content.contentObjectKey,
          contentSha256: content.contentSha256,
          contentBytes: content.contentBytes,
          changelog: `Restored from v${sourceVersion.versionNumber}`,
          createdByPrincipalType: principal.type,
          createdByPrincipalId: principal.id
        }
      });
    } catch (error) {
      await this.deleteContent(content.contentObjectKey);
      throw error;
    }

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.version_restored", "artifact_version", versionId, {
      previousVersionNumber: latestVersion.versionNumber,
      restoredFromVersionNumber: sourceVersion.versionNumber,
      versionNumber: nextVersionNumber
    }, artifact.workspaceId ?? undefined);
    this.recordBillingMetering(
      "recordVersionWrite",
      this.billing?.recordVersionWrite?.({
        ownerUserId: artifact.ownerUserId,
        artifactId: artifact.id,
        versionNumber: nextVersionNumber,
        contentBytes: content.contentBytes
      })
    );

    return {
      artifactId: artifact.id,
      versionId,
      versionNumber: nextVersionNumber,
      ownerUserId: artifact.ownerUserId,
      ownerUsername: namespaceSlug,
      projectId: artifact.projectId,
      projectSlug: artifact.projectSlug,
      normalizedSlug: artifact.slug,
      type: artifact.type,
      title: artifact.title,
      url: buildWorkspaceProjectArtifactUrl(this.appUrl, namespaceSlug, artifact.projectSlug, artifact.slug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit
    };
  }

  async getArtifactByPath(
    username: string,
    projectSlug: string,
    slug: string,
    principal: Principal
  ): Promise<ArtifactRecord> {
    const artifact = await this.resolveActiveArtifactByPath(username, projectSlug, slug);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return artifact;
  }

  async resolveActiveArtifactByPath(
    username: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord> {
    const artifact = await this.repository.getArtifactByOwnerProjectSlug(
      username,
      validateProjectSlug(projectSlug),
      validateSlug(slug)
    );
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    return artifact;
  }

  async getArtifactByWorkspacePath(
    workspaceId: string,
    projectSlug: string,
    slug: string,
    principal: Principal
  ): Promise<ArtifactRecord> {
    const artifact = await this.repository.getArtifactByWorkspaceProjectSlug(
      workspaceId,
      validateProjectSlug(projectSlug),
      validateSlug(slug)
    );
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return artifact;
  }

  async getArtifact(artifactId: string, principal: Principal): Promise<ArtifactRecord> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return artifact;
  }

  async deleteArtifact(artifactId: string, principal: Principal): Promise<{ artifactId: string; deleted: true }> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.delete");

    await this.repository.softDeleteArtifact(artifact.id);

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.deleted", "artifact", artifact.id, {
      slug: artifact.slug,
      title: artifact.title
    }, artifact.workspaceId ?? undefined);

    return { artifactId: artifact.id, deleted: true };
  }

  async checkArtifactPermission(artifactId: string, action: ArtifactAction, principal: Principal): Promise<boolean> {
    const artifact = await this.repository.getArtifactById(artifactId);
    if (!artifact || artifact.state !== "active") return false;
    const decision = await this.access.authorize({
      principal,
      action,
      context: { kind: "artifact", artifact: this.artifactRoleContext(artifact) }
    });
    return decision.allowed;
  }

  async getArtifactContent(
    artifactId: string,
    principal: Principal,
    versionNumber?: number
  ): Promise<{ artifact: ArtifactRecord; version: ArtifactVersionRecord; content: string; contentType: string }> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    const version = await this.requireVersion(artifact.id, versionNumber);
    const content = await this.readVerifiedVersionContent(version);
    this.recordBillingMetering(
      "recordDelivery",
      this.billing?.recordDelivery?.({
        ownerUserId: artifact.ownerUserId,
        artifactId: artifact.id,
        versionNumber: version.versionNumber,
        contentBytes: version.contentBytes
      })
    );

    return {
      artifact,
      version,
      content,
      // Authoritative: derive Content-Type from the artifact's declared type column.
      // Any value stored in S3 metadata is ignored to prevent content-type spoofing.
      contentType: contentTypeForArtifact(artifact.type)
    };
  }

  async listArtifactVersions(artifactId: string, principal: Principal, limit = 50): Promise<ArtifactVersionRecord[]> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    const cutoff = await this.versionHistoryCutoff(artifact.ownerUserId);
    return this.repository.listVersions(artifactId, Math.min(Math.max(limit, 1), 100), { createdAtGte: cutoff });
  }

  async listWorkspaceArtifacts(workspaceId: string, principal: Principal): Promise<ArtifactRecord[]> {
    const artifacts = await this.repository.listArtifactsForWorkspace(workspaceId);
    const visible: ArtifactRecord[] = [];

    for (const artifact of artifacts) {
      const decision = await this.access.authorize({
        principal,
        action: "artifact.view",
        context: { kind: "artifact", artifact: this.artifactRoleContext(artifact) }
      });
      if (decision.allowed) {
        visible.push(artifact);
      }
    }

    return visible;
  }

  async listOwnedArtifacts(principal: Principal): Promise<ArtifactRecord[]> {
    if (principal.type !== "user") {
      throw new ArtifactForbiddenError("Only signed-in users can list owned artifacts.");
    }

    return this.repository.listArtifactsForOwner(principal.id);
  }

  async listArtifactsInProject(
    username: string,
    projectSlug: string,
    principal: Principal
  ): Promise<ArtifactRecord[]> {
    const project = await this.requireProject(username, projectSlug);
    const artifacts = await this.repository.listArtifactsForProject(project.id);
    const visible: ArtifactRecord[] = [];
    for (const artifact of artifacts) {
      const decision = await this.access.authorize({
        principal,
        action: "artifact.view",
        context: { kind: "artifact", artifact: this.artifactRoleContext(artifact) }
      });
      if (decision.allowed) {
        visible.push(artifact);
      }
    }

    return visible;
  }

  async listArtifactsInWorkspaceProject(
    workspaceId: string,
    projectSlug: string,
    principal: Principal
  ): Promise<ArtifactRecord[]> {
    const project = await this.requireWorkspaceProject(workspaceId, projectSlug);
    const artifacts = await this.repository.listArtifactsForProject(project.id);
    const visible: ArtifactRecord[] = [];
    for (const artifact of artifacts) {
      const decision = await this.access.authorize({
        principal,
        action: "artifact.view",
        context: { kind: "artifact", artifact: this.artifactRoleContext(artifact) }
      });
      if (decision.allowed) {
        visible.push(artifact);
      }
    }

    return visible;
  }

  async getArtifactAccess(artifactId: string, principal: Principal): Promise<ArtifactAccessSnapshot> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.manage_access");
    const viewerEmails = await this.repository.listViewerEmailsForArtifact(artifactId);

    return {
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit,
      viewerEmails
    };
  }

  async setArtifactAccess(
    artifactId: string,
    input: SetArtifactAccessInput,
    principal: Principal
  ): Promise<ArtifactAccessSnapshot> {
    const parsed = setArtifactAccessInputSchema.parse(input);
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.manage_access");
    await this.billing?.assertCanSetArtifactAccess(artifact.ownerUserId, {
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: parsed.viewerEmails
    });

    const normalizedEmails = parsed.viewerEmails.map((email) => email.trim().toLowerCase());

    await this.repository.replaceArtifactEmailAccess({
      artifactId,
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id
    });

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.access_updated", "artifact", artifactId, {
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails
    }, artifact.workspaceId ?? undefined);

    return {
      publicView: parsed.publicView,
      publicEdit: parsed.publicEdit,
      viewerEmails: normalizedEmails
    };
  }

  async diffArtifactVersions(
    artifactId: string,
    principal: Principal,
    fromVersionNumber: number,
    toVersionNumber: number
  ): Promise<{ fromVersion: ArtifactVersionRecord; toVersion: ArtifactVersionRecord; unifiedDiff: string }> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.diff");

    const fromVersion = await this.requireVersion(artifact.id, fromVersionNumber);
    const toVersion = await this.requireVersion(artifact.id, toVersionNumber);

    const [left, right] = await Promise.all([
      this.readVerifiedVersionContent(fromVersion),
      this.readVerifiedVersionContent(toVersion)
    ]);

    const unifiedDiff = createTwoFilesPatch(`v${fromVersionNumber}`, `v${toVersionNumber}`, left, right, "", "");

    return { fromVersion, toVersion, unifiedDiff };
  }

  private async requireProject(
    ownerUsername: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string }> {
    const project = await this.repository.getProjectByOwnerSlug(ownerUsername, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ArtifactNotFoundError();
    }

    return project;
  }

  private async requireWorkspaceProject(
    workspaceId: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string }> {
    const project = await this.repository.getProjectByWorkspaceSlug(workspaceId, validateProjectSlug(projectSlug));
    if (!project) {
      throw new ArtifactNotFoundError();
    }

    return project;
  }

  private async requireArtifactById(artifactId: string): Promise<ArtifactRecord> {
    const artifact = await this.repository.getArtifactById(artifactId);
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    return artifact;
  }

  private async requireVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord> {
    const version = await this.repository.getVersion(artifactId, versionNumber);
    if (!version) {
      throw new ArtifactNotFoundError();
    }

    return version;
  }

  private async assertArtifactAction(artifact: ArtifactRecord, principal: Principal, action: ArtifactAction): Promise<void> {
    await this.access.assertAuthorized({
      principal,
      action,
      context: { kind: "artifact", artifact: this.artifactRoleContext(artifact) }
    });
  }

  private artifactRoleContext(artifact: ArtifactRecord) {
    return {
      id: artifact.id,
      ownerUserId: artifact.ownerUserId,
      workspaceId: artifact.workspaceId,
      publicView: artifact.publicView,
      publicEdit: artifact.publicEdit
    };
  }

  private async versionHistoryCutoff(ownerUserId: string): Promise<Date | undefined> {
    const entitlements = await this.billing?.getAccountEntitlements(ownerUserId);
    const days = entitlements?.plan.entitlements.versionHistoryDays;
    if (!days) {
      return undefined;
    }
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private async writeContent(input: {
    ownerUserId: string;
    artifactId: string;
    versionNumber: number;
    type: ArtifactType;
    content: string;
  }): Promise<{ contentObjectKey: string; contentSha256: string; contentBytes: number }> {
    const encodedContent = textEncoder.encode(input.content);
    const contentSha256 = createHash("sha256").update(encodedContent).digest("hex");
    const contentObjectKey = createVersionSourceKey(input);

    await this.storage.putObject({
      key: contentObjectKey,
      body: encodedContent,
      contentType: contentTypeForArtifact(input.type)
    });

    return {
      contentObjectKey,
      contentSha256,
      contentBytes: encodedContent.byteLength
    };
  }

  private async deleteContent(contentObjectKey: string): Promise<void> {
    await this.storage.deleteObject?.(contentObjectKey).catch((error: unknown) => {
      console.error("Artifact content cleanup failed", error);
    });
  }

  private async readVerifiedVersionContent(version: ArtifactVersionRecord): Promise<string> {
    const object = await this.storage.getObject(version.contentObjectKey);
    const actualSha256 = createHash("sha256").update(object.body).digest("hex");
    if (actualSha256 !== version.contentSha256) {
      console.error("Artifact content integrity check failed", {
        artifactId: version.artifactId,
        versionNumber: version.versionNumber,
        contentObjectKey: version.contentObjectKey,
        expectedSha256: version.contentSha256,
        actualSha256
      });
      throw new ArtifactIntegrityError();
    }
    return textDecoder.decode(object.body);
  }

  private recordBillingMetering(operation: string, promise: Promise<void> | undefined): void {
    if (!promise) return;
    void promise.catch((error: unknown) => {
      console.error(`Billing ${operation} failed`, error);
    });
  }

  private async audit(
    ownerUserId: string,
    artifactId: string,
    principal: Principal,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown> = {},
    workspaceId?: string
  ): Promise<void> {
    await this.repository.createAuditEvent({
      id: randomUUID(),
      ownerUserId,
      workspaceId,
      artifactId,
      actorPrincipalType: principal.type,
      actorPrincipalId: principal.id,
      action,
      targetType,
      targetId,
      metadata
    });
  }
}

function byteLength(content: string): number {
  return textEncoder.encode(content).byteLength;
}
