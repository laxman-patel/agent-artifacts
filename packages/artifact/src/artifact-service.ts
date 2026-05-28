import { createHash, randomUUID } from "node:crypto";
import type { ArtifactAccess } from "@agent-artifacts/access";
import type { ArtifactAction, ArtifactType, Principal } from "@agent-artifacts/shared";
import { buildProjectArtifactUrl, buildWorkspaceProjectArtifactUrl } from "@agent-artifacts/shared";
import type { ArtifactStorage } from "@agent-artifacts/storage";
import { createVersionSourceKey } from "@agent-artifacts/storage";
import { createTwoFilesPatch } from "diff";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  ArtifactNotFoundError,
  SlugUnavailableError,
  contentTypeForArtifact,
  createArtifactInputSchema,
  createWorkspaceArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema,
  type ArtifactAccessSnapshot,
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactSummary,
  type ArtifactVersionRecord,
  type CreateArtifactInput,
  type CreateWorkspaceArtifactInput,
  type SetArtifactAccessInput,
  type UpdateArtifactInput
} from "./artifact-types.js";
import { validateProjectSlug } from "./project.js";
import { validateSlug } from "./slug.js";

const textDecoder = new TextDecoder();

export class ArtifactService {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly storage: ArtifactStorage,
    private readonly appUrl: string,
    private readonly access: ArtifactAccess
  ) {}

  async checkSlugAvailability(
    ownerUsername: string,
    projectSlug: string,
    slug: string,
    principal: Principal
  ): Promise<{ available: boolean; ownerUserId: string; projectId: string; normalizedSlug: string }> {
    const normalizedSlug = validateSlug(slug);
    const owner = await this.requireOwner(ownerUsername);
    const project = await this.requireProject(owner.username, projectSlug);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: {
        kind: "namespace",
        ownerUserId: owner.userId,
        workspaceId: project.workspaceId ?? undefined
      }
    });
    const available = !(await this.repository.slugExistsInProject(project.id, normalizedSlug));

    return { available, ownerUserId: owner.userId, projectId: project.id, normalizedSlug };
  }

  async createArtifact(input: CreateArtifactInput, principal: Principal): Promise<ArtifactSummary> {
    const parsed = createArtifactInputSchema.parse(input);
    const owner = await this.requireOwner(parsed.ownerUsername);
    const project = await this.requireProject(owner.username, parsed.projectSlug);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: {
        kind: "namespace",
        ownerUserId: owner.userId,
        workspaceId: project.workspaceId ?? undefined
      }
    });
    const normalizedSlug = validateSlug(parsed.slug);
    const available = !(await this.repository.slugExistsInProject(project.id, normalizedSlug));
    if (!available) {
      throw new SlugUnavailableError(normalizedSlug);
    }

    const artifactId = randomUUID();
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: owner.userId,
      artifactId,
      versionNumber: 1,
      type: parsed.type,
      content: parsed.content
    });

    await this.repository.createArtifact({
      artifact: {
        id: artifactId,
        ownerUserId: owner.userId,
        projectId: project.id,
        slug: normalizedSlug,
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        latestVersionId: versionId,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id,
        publicView: parsed.access.publicView,
        publicEdit: parsed.access.publicEdit
      },
      version: {
        id: versionId,
        artifactId,
        versionNumber: 1,
        contentObjectKey: content.contentObjectKey,
        contentSha256: content.contentSha256,
        contentBytes: content.contentBytes,
        changelog: parsed.changelog,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id
      }
    });

    await this.audit(owner.userId, artifactId, principal, "artifact.created", "artifact", artifactId, {
      slug: normalizedSlug,
      versionNumber: 1
    }, project.workspaceId ?? undefined);

    return {
      artifactId,
      versionId,
      versionNumber: 1,
      ownerUserId: owner.userId,
      ownerUsername: owner.username,
      projectId: project.id,
      projectSlug: project.slug,
      normalizedSlug,
      type: parsed.type,
      title: parsed.title,
      url: buildProjectArtifactUrl(this.appUrl, owner.username, project.slug, normalizedSlug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: parsed.access.publicView,
      publicEdit: parsed.access.publicEdit
    };
  }

  async createWorkspaceArtifact(
    workspaceId: string,
    workspaceSlug: string,
    input: CreateWorkspaceArtifactInput,
    principal: Principal
  ): Promise<ArtifactSummary> {
    const parsed = createWorkspaceArtifactInputSchema.parse(input);
    const project = await this.requireWorkspaceProject(workspaceId, parsed.projectSlug);
    await this.access.assertAuthorized({
      principal,
      action: "artifact.create",
      context: {
        kind: "namespace",
        ownerUserId: project.ownerUserId,
        workspaceId: project.workspaceId
      }
    });
    const normalizedSlug = validateSlug(parsed.slug);
    const available = !(await this.repository.slugExistsInProject(project.id, normalizedSlug));
    if (!available) {
      throw new SlugUnavailableError(normalizedSlug);
    }

    const artifactId = randomUUID();
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: project.ownerUserId,
      artifactId,
      versionNumber: 1,
      type: parsed.type,
      content: parsed.content
    });

    await this.repository.createArtifact({
      artifact: {
        id: artifactId,
        ownerUserId: project.ownerUserId,
        projectId: project.id,
        slug: normalizedSlug,
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        latestVersionId: versionId,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id,
        publicView: parsed.access.publicView,
        publicEdit: parsed.access.publicEdit
      },
      version: {
        id: versionId,
        artifactId,
        versionNumber: 1,
        contentObjectKey: content.contentObjectKey,
        contentSha256: content.contentSha256,
        contentBytes: content.contentBytes,
        changelog: parsed.changelog,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id
      }
    });

    await this.audit(project.ownerUserId, artifactId, principal, "artifact.created", "artifact", artifactId, {
      slug: normalizedSlug,
      versionNumber: 1
    }, project.workspaceId);

    return {
      artifactId,
      versionId,
      versionNumber: 1,
      ownerUserId: project.ownerUserId,
      ownerUsername: workspaceSlug,
      projectId: project.id,
      projectSlug: project.slug,
      normalizedSlug,
      type: parsed.type,
      title: parsed.title,
      url: buildWorkspaceProjectArtifactUrl(this.appUrl, workspaceSlug, project.slug, normalizedSlug),
      contentObjectKey: content.contentObjectKey,
      contentSha256: content.contentSha256,
      contentBytes: content.contentBytes,
      publicView: parsed.access.publicView,
      publicEdit: parsed.access.publicEdit
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

    const nextVersionNumber = latestVersion.versionNumber + 1;
    const versionId = randomUUID();
    const content = await this.writeContent({
      ownerUserId: artifact.ownerUserId,
      artifactId: artifact.id,
      versionNumber: nextVersionNumber,
      type: artifact.type,
      content: parsed.content
    });

    await this.repository.createVersion({
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

    await this.audit(artifact.ownerUserId, artifact.id, principal, "artifact.updated", "artifact_version", versionId, {
      previousVersionNumber: latestVersion.versionNumber,
      versionNumber: nextVersionNumber
    }, artifact.workspaceId ?? undefined);

    return {
      artifactId: artifact.id,
      versionId,
      versionNumber: nextVersionNumber,
      ownerUserId: artifact.ownerUserId,
      ownerUsername: artifact.ownerUsername,
      projectId: artifact.projectId,
      projectSlug: artifact.projectSlug,
      normalizedSlug: artifact.slug,
      type: artifact.type,
      title: artifact.title,
      url: buildProjectArtifactUrl(this.appUrl, artifact.ownerUsername, artifact.projectSlug, artifact.slug),
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
    const artifact = await this.repository.getArtifactByOwnerProjectSlug(
      username,
      validateProjectSlug(projectSlug),
      validateSlug(slug)
    );
    if (!artifact || artifact.state !== "active") {
      throw new ArtifactNotFoundError();
    }

    await this.assertArtifactAction(artifact, principal, "artifact.view");
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
    const object = await this.storage.getObject(version.contentObjectKey);

    return {
      artifact,
      version,
      content: textDecoder.decode(object.body),
      // Authoritative: derive Content-Type from the artifact's declared type column.
      // Any value stored in S3 metadata is ignored to prevent content-type spoofing.
      contentType: contentTypeForArtifact(artifact.type)
    };
  }

  async listArtifactVersions(artifactId: string, principal: Principal, limit = 50): Promise<ArtifactVersionRecord[]> {
    const artifact = await this.requireArtifactById(artifactId);
    await this.assertArtifactAction(artifact, principal, "artifact.view");
    return this.repository.listVersions(artifactId, Math.min(Math.max(limit, 1), 100));
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

    const [fromObject, toObject] = await Promise.all([
      this.storage.getObject(fromVersion.contentObjectKey),
      this.storage.getObject(toVersion.contentObjectKey)
    ]);

    const left = textDecoder.decode(fromObject.body);
    const right = textDecoder.decode(toObject.body);

    const unifiedDiff = createTwoFilesPatch(`v${fromVersionNumber}`, `v${toVersionNumber}`, left, right, "", "");

    return { fromVersion, toVersion, unifiedDiff };
  }

  private async requireOwner(ownerUsername: string): Promise<{ userId: string; username: string }> {
    const owner = await this.repository.getOwnerByUsername(ownerUsername);
    if (!owner) {
      throw new ArtifactNotFoundError();
    }

    return owner;
  }

  private async requireProject(
    ownerUsername: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string | null; ownerUserId: string }> {
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

  private async writeContent(input: {
    ownerUserId: string;
    artifactId: string;
    versionNumber: number;
    type: ArtifactType;
    content: string;
  }): Promise<{ contentObjectKey: string; contentSha256: string; contentBytes: number }> {
    const encodedContent = new TextEncoder().encode(input.content);
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
