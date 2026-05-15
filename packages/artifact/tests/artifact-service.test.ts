import { describe, expect, it } from "vitest";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  ArtifactService,
  type ArtifactRecord,
  type ArtifactRepository,
  type ArtifactVersionRecord,
  type PersistAuditEventInput,
  type PersistCreateArtifactInput,
  type PersistCreateVersionInput
} from "../src/index.js";
import type { Principal } from "@agent-artifacts/shared";
import type { ArtifactStorage, GetObjectOutput, PutObjectInput } from "@agent-artifacts/storage";

const ownerPrincipal: Principal = {
  type: "user",
  id: "user_1",
  email: "owner@example.com",
  scopes: []
};

const agentPrincipal: Principal = {
  type: "agent",
  id: "agent_1",
  ownerUserId: "user_1",
  scopes: ["artifacts:create", "artifacts:update", "artifacts:read"]
};

describe("ArtifactService", () => {
  it("creates an immutable first version and writes source content to storage", async () => {
    const repository = new MemoryArtifactRepository();
    const storage = new MemoryArtifactStorage();
    const service = new ArtifactService(repository, storage, "https://www.agents-artifacts");

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        slug: "Weekly Report!",
        type: "markdown",
        title: "Weekly Report",
        content: "# Hello",
        changelog: "Initial draft"
      },
      ownerPrincipal
    );

    expect(created.normalizedSlug).toBe("weekly-report");
    expect(created.versionNumber).toBe(1);
    expect(created.url).toBe("https://www.agents-artifacts/laxman/weekly-report");
    expect(storage.text(created.contentObjectKey)).toBe("# Hello");
    expect(repository.auditEvents).toHaveLength(1);
    expect(repository.auditEvents[0]?.action).toBe("artifact.created");
  });

  it("appends updates as new versions and rejects stale version preconditions", async () => {
    const repository = new MemoryArtifactRepository();
    const storage = new MemoryArtifactStorage();
    const service = new ArtifactService(repository, storage, "https://www.agents-artifacts");

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
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

  it("enforces scopes for agent mutations and email rules for restricted reads", async () => {
    const repository = new MemoryArtifactRepository();
    const storage = new MemoryArtifactStorage();
    const service = new ArtifactService(repository, storage, "https://www.agents-artifacts");

    const created = await service.createArtifact(
      {
        ownerUsername: "laxman",
        slug: "restricted",
        type: "markdown",
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

    repository.emailPermissions.set("allowed@example.com", "viewer");
    const content = await service.getArtifactContent(created.artifactId, {
      type: "user",
      id: "user_3",
      email: "allowed@example.com",
      scopes: []
    });

    expect(content.content).toBe("secret");
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

  text(key: string): string {
    const object = this.objects.get(key);
    if (!object) {
      throw new Error(`Missing object ${key}`);
    }

    return new TextDecoder().decode(object.body);
  }
}

class MemoryArtifactRepository implements ArtifactRepository {
  readonly owners = new Map([["laxman", { userId: "user_1", username: "laxman" }]]);
  readonly artifacts = new Map<string, ArtifactRecord>();
  readonly versions = new Map<string, ArtifactVersionRecord[]>();
  readonly auditEvents: PersistAuditEventInput[] = [];
  readonly emailPermissions = new Map<string, "viewer" | "editor" | "admin" | "owner">();

  async getOwnerByUsername(username: string): Promise<{ userId: string; username: string } | undefined> {
    return this.owners.get(username.toLowerCase());
  }

  async slugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean> {
    return [...this.artifacts.values()].some(
      (artifact) => artifact.ownerUserId === ownerUserId && artifact.slug.toLowerCase() === normalizedSlug
    );
  }

  async getArtifactById(artifactId: string): Promise<ArtifactRecord | undefined> {
    return this.artifacts.get(artifactId);
  }

  async getArtifactByOwnerSlug(username: string, slug: string): Promise<ArtifactRecord | undefined> {
    return [...this.artifacts.values()].find(
      (artifact) => artifact.ownerUsername.toLowerCase() === username.toLowerCase() && artifact.slug === slug
    );
  }

  async getVersion(artifactId: string, versionNumber?: number): Promise<ArtifactVersionRecord | undefined> {
    const versions = this.versions.get(artifactId) ?? [];
    return versionNumber === undefined
      ? versions.toSorted((left, right) => right.versionNumber - left.versionNumber).at(0)
      : versions.find((version) => version.versionNumber === versionNumber);
  }

  async listVersions(artifactId: string, limit: number): Promise<ArtifactVersionRecord[]> {
    return (this.versions.get(artifactId) ?? [])
      .toSorted((left, right) => right.versionNumber - left.versionNumber)
      .slice(0, limit);
  }

  async createArtifact(input: PersistCreateArtifactInput): Promise<void> {
    this.artifacts.set(input.artifact.id, {
      id: input.artifact.id,
      ownerUserId: input.artifact.ownerUserId,
      ownerUsername: "laxman",
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
    const artifact = this.artifacts.get(input.version.artifactId);
    if (!artifact) {
      throw new Error("Missing artifact");
    }

    artifact.latestVersionId = input.version.id;
    artifact.updatedAt = new Date();
    this.versions.set(input.version.artifactId, [...(this.versions.get(input.version.artifactId) ?? []), this.toVersion(input.version)]);
  }

  async getEffectiveRole(artifact: ArtifactRecord, principal: Principal): Promise<"viewer" | "editor" | "admin" | "owner" | undefined> {
    if (principal.id === artifact.ownerUserId || principal.ownerUserId === artifact.ownerUserId) {
      return "owner";
    }

    if (artifact.publicEdit) {
      return "editor";
    }

    if (artifact.publicView) {
      return "viewer";
    }

    return principal.email ? this.emailPermissions.get(principal.email.toLowerCase()) : undefined;
  }

  async createAuditEvent(input: PersistAuditEventInput): Promise<void> {
    this.auditEvents.push(input);
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
      createdAt: new Date(),
      validationStatus: input.validationStatus,
      renderStatus: input.renderStatus,
      renderOutputId: null
    };
  }
}
