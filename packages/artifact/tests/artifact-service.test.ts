import { describe, expect, it } from "vitest";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  DrizzleArtifactRoleResolver,
  ArtifactService,
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactVersionRecord,
  type PersistAuditEventInput,
  type PersistCreateArtifactInput,
  type PersistCreateVersionInput,
  type ReplaceArtifactEmailAccessInput
} from "../src/index.js";
import { createArtifactAccess, MemoryArtifactRoleResolver } from "@agent-artifacts/access";
import { BILLING_PLANS, EntitlementLimitError } from "@agent-artifacts/billing";
import type { Principal } from "@agent-artifacts/shared";
import type { ArtifactStorage, GetObjectOutput, PutObjectInput } from "@agent-artifacts/storage";

const APP_URL = "https://www.agents-artifacts";

const ownerPrincipal: Principal = {
  type: "user",
  id: "user_1",
  ownerUserId: "user_1",
  email: "owner@example.com",
  scopes: []
};

const agentPrincipal: Principal = {
  type: "agent",
  id: "agent_1",
  ownerUserId: "user_1",
  scopes: ["artifacts:create", "artifacts:update", "artifacts:read"]
};

function createTestHarness(billingGuard?: MemoryBillingGuard) {
  const roleResolver = new MemoryArtifactRoleResolver();
  const repository = new MemoryArtifactRepository(roleResolver);
  const storage = new MemoryArtifactStorage();
  const access = createArtifactAccess(roleResolver);
  const workspaceAccess = {
    authorize: async () => ({ allowed: true as const, effectiveRole: "owner" as const }),
    assertAuthorized: async () => undefined
  };
  const service = new ArtifactService(repository, storage, APP_URL, access, workspaceAccess, billingGuard);

  return { repository, roleResolver, storage, service, billingGuard };
}

describe("ArtifactService", () => {
  it("creates an immutable first version and writes source content to storage", async () => {
    const { repository, storage, service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "Weekly Report!",
        type: "md",
        title: "Weekly Report",
        content: "# Hello",
        changelog: "Initial draft"
      },
      ownerPrincipal
    );

    expect(created.normalizedSlug).toBe("weekly-report");
    expect(created.versionNumber).toBe(1);
    expect(created.url).toBe("https://www.agents-artifacts/laxman/default/weekly-report");
    expect(storage.text(created.contentObjectKey)).toBe("# Hello");
    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]?.action).toBe("artifact.created");
  });

  it("checks billing entitlements before private artifact writes", async () => {
    const billingGuard = new MemoryBillingGuard();
    billingGuard.rejectCreateArtifact = new EntitlementLimitError("Private artifacts require Pro.", {
      limit: "private_artifacts",
      requiredPlanId: "builder"
    });
    const { service, storage } = createTestHarness(billingGuard);

    await expect(
      service.createArtifact(
        {
          ownerUsername: "laxman",
          projectSlug: "default",
          slug: "private-demo",
          type: "md",
          title: "Private",
          content: "# secret",
          access: { publicView: false, publicEdit: false }
        },
        ownerPrincipal
      )
    ).rejects.toThrow("Private artifacts require Pro.");

    expect(storage.objects.size).toBe(0);
    expect(billingGuard.createArtifactChecks).toEqual([
      { ownerUserId: "user_1", publicView: false, publicEdit: false, contentBytes: 8 }
    ]);
  });

  it("denies create in another user's namespace", async () => {
    const { service } = createTestHarness();

    await expect(
      service.createArtifact(
        {
          ownerUsername: "laxman",
        projectSlug: "default",
          slug: "hijack",
          type: "md",
          title: "Hijack",
          content: "nope"
        },
        {
          type: "user",
          id: "user_2",
          ownerUserId: "user_2",
          email: "intruder@example.com",
          scopes: []
        }
      )
    ).rejects.toBeInstanceOf(ArtifactForbiddenError);
  });

  it("allows a share-granted principal to resolve a restricted artifact by path", async () => {
    const { service } = createTestHarness();
    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "private-demo",
        type: "md",
        title: "Private Demo",
        content: "# Secret",
        access: { publicView: false, publicEdit: false }
      },
      ownerPrincipal
    );
    const anonymousPrincipal: Principal = {
      type: "service",
      id: "anonymous-public-viewer",
      scopes: ["artifacts:read"]
    };

    await expect(
      service.getArtifactByPath("laxman", "default", "private-demo", anonymousPrincipal)
    ).rejects.toBeInstanceOf(ArtifactForbiddenError);

    await expect(
      service.getArtifactByPath("laxman", "default", "private-demo", {
        ...anonymousPrincipal,
        artifactRoleGrants: { [created.artifactId]: "viewer" }
      })
    ).resolves.toMatchObject({ id: created.artifactId });
  });

  it("appends updates as new versions and rejects stale version preconditions", async () => {
    const { repository, storage, service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "demo",
        type: "html",
        title: "Demo",
        content: "<h1>One</h1>"
      },
      ownerPrincipal
    );

    const updated = await service.updateArtifact(
      {
        artifactId: created.artifactId,
        content: "<h1>Two</h1>",
        expectedLatestVersion: 1
      },
      agentPrincipal
    );

    expect(updated.versionNumber).toBe(2);
    expect(repository.versions.get(created.artifactId)).toHaveLength(2);
    expect(storage.text(updated.contentObjectKey)).toBe("<h1>Two</h1>");

    await expect(
      service.updateArtifact(
        {
          artifactId: created.artifactId,
          content: "<h1>Stale</h1>",
          expectedLatestVersion: 1
        },
        agentPrincipal
      )
    ).rejects.toBeInstanceOf(ArtifactConflictError);
  });

  it("restores an old version by creating a new head version", async () => {
    const { repository, storage, service } = createTestHarness();
    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "restore-demo",
        type: "md",
        title: "Restore Demo",
        content: "# One"
      },
      ownerPrincipal
    );
    await service.updateArtifact(
      {
        artifactId: created.artifactId,
        content: "# Two"
      },
      ownerPrincipal
    );

    const restored = await service.restoreArtifactVersion(
      {
        artifactId: created.artifactId,
        versionNumber: 1
      },
      ownerPrincipal
    );

    expect(restored.versionNumber).toBe(3);
    expect(repository.versions.get(created.artifactId)).toHaveLength(3);
    expect(storage.text(restored.contentObjectKey)).toBe("# One");
    expect(repository.auditEvents.at(-1)?.action).toBe("artifact.version_restored");
    expect(repository.auditEvents.at(-1)?.metadata).toMatchObject({
      restoredFromVersionNumber: 1,
      versionNumber: 3
    });
  });

  it("filters version history by the owner's retention window", async () => {
    const billingGuard = new MemoryBillingGuard();
    billingGuard.versionHistoryDays = 30;
    const { repository, service } = createTestHarness(billingGuard);
    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "retained-history",
        type: "md",
        title: "Retained History",
        content: "# one"
      },
      ownerPrincipal
    );
    await service.updateArtifact({ artifactId: created.artifactId, content: "# two" }, ownerPrincipal);

    const versions = repository.versions.get(created.artifactId) ?? [];
    versions[0] = { ...versions[0], createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) };

    await expect(service.listArtifactVersions(created.artifactId, ownerPrincipal)).resolves.toMatchObject([
      { versionNumber: 2 }
    ]);
  });

  it("removes newly written source content when version persistence fails", async () => {
    const { repository, storage, service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "cleanup-demo",
        type: "md",
        title: "Cleanup",
        content: "# one"
      },
      ownerPrincipal
    );
    repository.rejectNextCreateVersion = new ArtifactConflictError("The artifact was updated by another writer.");

    await expect(
      service.updateArtifact(
        {
          artifactId: created.artifactId,
          content: "# two"
        },
        ownerPrincipal
      )
    ).rejects.toBeInstanceOf(ArtifactConflictError);

    expect(storage.objects.size).toBe(1);
  });

  it("treats owner agents as owner principals for workspace-scoped artifacts", async () => {
    const resolver = new DrizzleArtifactRoleResolver({
      select() {
        throw new Error("workspace membership should not be consulted for owner-account principals");
      }
    } as never);

    await expect(
      resolver.resolveArtifact(agentPrincipal, {
        id: "artifact_1",
        ownerUserId: "user_1",
        workspaceId: "workspace_laxman",
        publicView: false,
        publicEdit: false
      })
    ).resolves.toEqual({ role: "owner", isOwnerAccount: true });
  });

  it("records paid usage hooks for version writes and content delivery", async () => {
    const billingGuard = new MemoryBillingGuard();
    const { service } = createTestHarness(billingGuard);

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "metered",
        type: "md",
        title: "Metered",
        content: "# one"
      },
      ownerPrincipal
    );

    await service.updateArtifact(
      {
        artifactId: created.artifactId,
        content: "# two"
      },
      ownerPrincipal
    );
    await service.getArtifactContent(created.artifactId, ownerPrincipal);

    expect(billingGuard.versionWrites).toEqual([
      { ownerUserId: "user_1", artifactId: created.artifactId, versionNumber: 1, contentBytes: 5 },
      { ownerUserId: "user_1", artifactId: created.artifactId, versionNumber: 2, contentBytes: 5 }
    ]);
    expect(billingGuard.deliveryEvents).toEqual([
      { ownerUserId: "user_1", artifactId: created.artifactId, versionNumber: 2, contentBytes: 5 }
    ]);
  });

  it("enforces scopes for agent mutations and email rules for restricted reads", async () => {
    const { roleResolver, service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "restricted",
        type: "md",
        title: "Restricted",
        content: "secret",
        access: {
          publicView: false,
          publicEdit: false
        }
      },
      ownerPrincipal
    );

    const underScopedAgent: Principal = {
      type: "agent",
      id: "agent_2",
      ownerUserId: "user_1",
      scopes: ["artifacts:read"]
    };

    await expect(
      service.updateArtifact(
        {
          artifactId: created.artifactId,
          content: "edit"
        },
        underScopedAgent
      )
    ).rejects.toBeInstanceOf(ArtifactForbiddenError);

    await expect(
      service.getArtifactContent(created.artifactId, {
        type: "user",
        id: "user_2",
        email: "blocked@example.com",
        scopes: []
      })
    ).rejects.toBeInstanceOf(ArtifactForbiddenError);

    roleResolver.grantEmailViewer(created.artifactId, "allowed@example.com");
    const content = await service.getArtifactContent(created.artifactId, {
      type: "user",
      id: "user_3",
      email: "allowed@example.com",
      scopes: []
    });

    expect(content.content).toBe("secret");
  });

  it("lists owned artifacts for human principals", async () => {
    const { service } = createTestHarness();

    await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "a-one",
        type: "md",
        title: "One",
        content: "# One"
      },
      ownerPrincipal
    );

    await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "b-two",
        type: "md",
        title: "Two",
        content: "# Two"
      },
      ownerPrincipal
    );

    const owned = await service.listOwnedArtifacts(ownerPrincipal);
    expect(owned).toHaveLength(2);
    expect(new Set(owned.map((artifact) => artifact.slug))).toEqual(new Set(["a-one", "b-two"]));
  });

  it("updates access flags and email viewers with auditing", async () => {
    const { repository, service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "policy-demo",
        type: "md",
        title: "Policy",
        content: "hello",
        access: { publicView: true, publicEdit: false }
      },
      ownerPrincipal
    );

    await service.setArtifactAccess(
      created.artifactId,
      {
        publicView: false,
        publicEdit: false,
        viewerEmails: ["friend@example.com"]
      },
      ownerPrincipal
    );

    const snapshot = await service.getArtifactAccess(created.artifactId, ownerPrincipal);
    expect(snapshot.publicView).toBe(false);
    expect(snapshot.viewerEmails).toEqual(["friend@example.com"]);

    await expect(
      service.getArtifactContent(created.artifactId, {
        type: "user",
        id: "user_9",
        email: "stranger@example.com",
        scopes: []
      })
    ).rejects.toBeInstanceOf(ArtifactForbiddenError);

    const allowedRead = await service.getArtifactContent(created.artifactId, {
      type: "user",
      id: "user_10",
      email: "friend@example.com",
      scopes: []
    });

    expect(allowedRead.content).toBe("hello");

    expect(repository.auditEvents.some((event) => event.action === "artifact.access_updated")).toBe(true);
  });

  it("diffs two artifact versions", async () => {
    const { service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "diff-me",
        type: "md",
        title: "Diff",
        content: "alpha\n"
      },
      ownerPrincipal
    );

    await service.updateArtifact(
      {
        artifactId: created.artifactId,
        content: "beta\n"
      },
      ownerPrincipal
    );

    const diffResult = await service.diffArtifactVersions(created.artifactId, ownerPrincipal, 1, 2);

    expect(diffResult.unifiedDiff).toContain("alpha");
    expect(diffResult.unifiedDiff).toContain("beta");
  });

  it("soft-deletes an artifact for the owner and hides it from subsequent reads", async () => {
    const { service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "throwaway",
        type: "md",
        title: "Throwaway",
        content: "# bye"
      },
      ownerPrincipal
    );

    const result = await service.deleteArtifact(created.artifactId, ownerPrincipal);
    expect(result).toEqual({ artifactId: created.artifactId, deleted: true });

    await expect(service.getArtifact(created.artifactId, ownerPrincipal)).rejects.toThrow(/not.found|forbidden|active/i);
  });

  it("rejects delete for non-owner principals", async () => {
    const { service } = createTestHarness();

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        projectSlug: "default",
        slug: "protected",
        type: "md",
        title: "Protected",
        content: "# keep"
      },
      ownerPrincipal
    );

    const editorAgent: Principal = {
      type: "agent",
      id: "agent_editor",
      ownerUserId: "user_1",
      scopes: ["artifacts:update"]
    };

    await expect(service.deleteArtifact(created.artifactId, editorAgent)).rejects.toBeInstanceOf(ArtifactForbiddenError);
  });
});

class MemoryArtifactStorage implements ArtifactStorage {
  readonly objects = new Map<string, { body: Uint8Array; contentType: string }>();

  async putObject(input: PutObjectInput): Promise<void> {
    this.objects.set(input.key, {
      body: typeof input.body === "string" ? new TextEncoder().encode(input.body) : input.body,
      contentType: input.contentType
    });
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`Missing object ${key}`);
    }

    return object;
  }

  async getSignedReadUrl(key: string): Promise<string> {
    return `memory://${key}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  text(key: string): string {
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`Missing object ${key}`);
    }

    return new TextDecoder().decode(object.body);
  }
}

class MemoryArtifactRepository implements ArtifactRepository {
  constructor(private readonly roleResolver?: MemoryArtifactRoleResolver) {}

  readonly owners = new Map([["laxman", { userId: "user_1", username: "laxman" }]]);
  readonly defaultProject = { id: "project_default", slug: "default", workspaceId: "workspace_laxman", ownerUserId: "user_1" };
  readonly artifacts = new Map<string, ArtifactRecord>();
  readonly versions = new Map<string, ArtifactVersionRecord[]>();
  readonly auditEvents: PersistAuditEventInput[] = [];
  readonly artifactEmailViewers = new Map<string, Set<string>>();
  rejectNextCreateVersion?: Error;

  async getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined> {
    return this.owners.get(username.toLowerCase());
  }

  async getProjectByOwnerSlug(
    username: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined> {
    if (username.toLowerCase() !== "laxman" || projectSlug !== "default") {
      return undefined;
    }

    return this.defaultProject;
  }

  async getProjectByWorkspaceSlug(
    workspaceId: string,
    projectSlug: string
  ): Promise<{ id: string; slug: string; workspaceId: string; ownerUserId: string } | undefined> {
    if (workspaceId !== this.defaultProject.workspaceId || projectSlug !== "default") {
      return undefined;
    }

    return this.defaultProject;
  }

  async slugExistsInProject(projectId: string, normalizedSlug: string): Promise<boolean> {
    return [...this.artifacts.values()].some(
      (artifact) => artifact.projectId === projectId && artifact.slug.toLowerCase() === normalizedSlug
    );
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined> {
    return this.artifacts.get(artifactId);
  }

  async getArtifactByOwnerProjectSlug(
    username: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined> {
    return [...this.artifacts.values()].find(
      (artifact) =>
        artifact.ownerUsername.toLowerCase() === username.toLowerCase() &&
        artifact.projectSlug === projectSlug &&
        artifact.slug === slug
    );
  }

  async listArtifactsForProject(projectId: string): Promise<ArtifactRecord[]> {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.projectId === projectId && artifact.state === "active"
    );
  }

  async listArtifactsForWorkspace(workspaceId: string): Promise<ArtifactRecord[]> {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.workspaceId === workspaceId && artifact.state === "active"
    );
  }

  async getArtifactByWorkspaceProjectSlug(
    workspaceId: string,
    projectSlug: string,
    slug: string
  ): Promise<ArtifactRecord | undefined> {
    return [...this.artifacts.values()].find(
      (artifact) => artifact.workspaceId === workspaceId && artifact.projectSlug === projectSlug && artifact.slug === slug
    );
  }

  async getVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord | undefined> {
    const versions = this.versions.get(artifactId) ?? [];
    return versionNumber === undefined
      ? versions.toSorted((left, right) => right.versionNumber - left.versionNumber).at(0)
      : versions.find((version) => version.versionNumber === versionNumber);
  }

  async listVersions(
    artifactId: string,
    limit: number,
    options: { createdAtGte?: Date } = {}
  ): Promise<ArtifactVersionRecord[]> {
    return (this.versions.get(artifactId) ?? [])
      .filter((version) => !options.createdAtGte || version.createdAt >= options.createdAtGte)
      .toSorted((left, right) => right.versionNumber - left.versionNumber)
      .slice(0, limit);
  }

  async createArtifact(input: PersistCreateArtifactInput): Promise<void> {
    this.artifacts.set(input.artifact.id, {
      id: input.artifact.id,
      ownerUserId: input.artifact.ownerUserId,
      ownerUsername: "laxman",
      projectId: input.artifact.projectId,
      projectSlug: this.defaultProject.slug,
      workspaceId: this.defaultProject.workspaceId,
      workspaceSlug: "laxman",
      slug: input.artifact.slug,
      title: input.artifact.title,
      description: input.artifact.description ?? null,
      type: input.artifact.type,
      state: "active",
      latestVersionId: input.artifact.latestVersionId,
      publicView: input.artifact.publicView,
      publicEdit: input.artifact.publicEdit,
      createdByPrincipalType: input.artifact.createdByPrincipalType,
      createdByPrincipalId: input.artifact.createdByPrincipalId,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    });
    this.versions.set(input.artifact.id, [this.toVersion(input.version)]);
  }

  async createVersion(input: PersistCreateVersionInput): Promise<void> {
    if (this.rejectNextCreateVersion) {
      const error = this.rejectNextCreateVersion;
      this.rejectNextCreateVersion = undefined;
      throw error;
    }

    const artifact = this.artifacts.get(input.version.artifactId);
    if (!artifact) {
      throw new Error("Missing artifact");
    }

    artifact.latestVersionId = input.version.id;
    artifact.updatedAt = new Date();
    this.versions.set(input.version.artifactId, [...(this.versions.get(input.version.artifactId) ?? []), this.toVersion(input.version)]);
  }

  async createAuditEvent(input: PersistAuditEventInput): Promise<void> {
    this.auditEvents.push(input);
  }

  async listArtifactsForOwner(ownerUserId: string): Promise<ArtifactRecord[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => artifact.ownerUserId === ownerUserId && artifact.state === "active")
      .toSorted((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  }

  async listViewerEmailsForArtifact(artifactId: string): Promise<string[]> {
    return [...(this.artifactEmailViewers.get(artifactId) ?? new Set())].toSorted();
  }

  async replaceArtifactEmailAccess(input: ReplaceArtifactEmailAccessInput): Promise<void> {
    const artifact = this.artifacts.get(input.artifactId);
    if (!artifact) {
      throw new Error("Missing artifact");
    }

    artifact.publicView = input.publicView;
    artifact.publicEdit = input.publicEdit;
    artifact.updatedAt = new Date();
    this.artifactEmailViewers.set(input.artifactId, new Set(input.viewerEmails));
    for (const email of input.viewerEmails) {
      this.roleResolver?.grantEmailViewer(input.artifactId, email);
    }
  }

  async softDeleteArtifact(artifactId: string): Promise<void> {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) return;
    artifact.state = "deleted";
    artifact.archivedAt = new Date();
    artifact.updatedAt = new Date();
  }

  private toVersion(input: PersistCreateVersionInput["version"]): ArtifactVersionRecord {
    return {
      id: input.id,
      artifactId: input.artifactId,
      versionNumber: input.versionNumber,
      parentVersionId: input.parentVersionId ?? null,
      contentObjectKey: input.contentObjectKey,
      contentSha256: input.contentSha256,
      contentBytes: input.contentBytes,
      changelog: input.changelog ?? null,
      createdByPrincipalType: input.createdByPrincipalType,
      createdByPrincipalId: input.createdByPrincipalId,
      createdAt: new Date()
    };
  }
}

class MemoryBillingGuard {
  rejectCreateArtifact?: Error;
  rejectWriteVersion?: Error;
  rejectAccess?: Error;
  versionHistoryDays = 365;
  auditRetentionDays = 365;
  readonly createArtifactChecks: Array<{ ownerUserId: string; publicView: boolean; publicEdit: boolean; contentBytes: number }> = [];
  readonly versionWrites: Array<{ ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }> = [];
  readonly deliveryEvents: Array<{ ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }> = [];

  async assertCanCreateArtifact(
    ownerUserId: string,
    input: { publicView: boolean; publicEdit: boolean; contentBytes: number }
  ) {
    this.createArtifactChecks.push({ ownerUserId, ...input });
    if (this.rejectCreateArtifact) throw this.rejectCreateArtifact;
  }

  async assertCanWriteVersion() {
    if (this.rejectWriteVersion) throw this.rejectWriteVersion;
  }

  async assertCanSetArtifactAccess() {
    if (this.rejectAccess) throw this.rejectAccess;
  }

  async getAccountEntitlements() {
    return {
      plan: {
        ...BILLING_PLANS.studio,
        entitlements: {
          ...BILLING_PLANS.studio.entitlements,
          versionHistoryDays: this.versionHistoryDays,
          auditRetentionDays: this.auditRetentionDays
        }
      }
    };
  }

  async recordVersionWrite(input: { ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }) {
    this.versionWrites.push(input);
  }

  async recordDelivery(input: { ownerUserId: string; artifactId: string; versionNumber: number; contentBytes: number }) {
    this.deliveryEvents.push(input);
  }
}
