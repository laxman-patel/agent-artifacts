import { describe, expect, it } from "vitest";
import { EntitlementLimitError } from "@agent-artifacts/billing";
import { createArtifactAccess, MemoryArtifactRoleResolver } from "@agent-artifacts/access";
import type { Principal } from "@agent-artifacts/shared";
import {
  ProjectService,
  type PersistCreateProjectInput,
  type ProjectRecord,
  type ProjectRepository,
  type ProjectWorkspaceRecord
} from "../src/index.js";

const ownerPrincipal: Principal = {
  type: "user",
  id: "user_1",
  ownerUserId: "user_1",
  email: "owner@example.com",
  scopes: []
};

describe("ProjectService billing gates", () => {
  it("checks project entitlements before creating another workspace project", async () => {
    const billingGuard = new MemoryProjectBillingGuard();
    billingGuard.reject = new EntitlementLimitError("Free includes 3 projects. Upgrade to create more.");
    const repository = new MemoryProjectRepository();
    const service = new ProjectService(
      repository,
      "https://agent-artifacts.test",
      createArtifactAccess(new MemoryArtifactRoleResolver()),
      billingGuard
    );

    await expect(
      service.createProject(
        {
          ownerUsername: "laxman",
          slug: "extra",
          title: "Extra"
        },
        ownerPrincipal
      )
    ).rejects.toThrow("Free includes 3 projects");

    expect(repository.projects).toHaveLength(0);
    expect(billingGuard.checkedOwnerIds).toEqual(["user_1"]);
  });

  it("uses the team workspace owner as the project billing owner", async () => {
    const billingGuard = new MemoryProjectBillingGuard();
    const repository = new MemoryProjectRepository();
    repository.workspace.kind = "team";
    repository.workspace.personalUserId = null;
    repository.workspace.createdByUserId = "user_1";
    const service = new ProjectService(
      repository,
      "https://agent-artifacts.test",
      createArtifactAccess(new MemoryArtifactRoleResolver()),
      billingGuard
    );

    const project = await service.createWorkspaceProject(
      repository.workspace.id,
      repository.workspace.slug,
      { slug: "team-project", title: "Team Project" },
      ownerPrincipal
    );

    expect(project.ownerUserId).toBe("user_1");
    expect(repository.projects).toMatchObject([{ ownerUserId: "user_1" }]);
    expect(billingGuard.checkedOwnerIds).toEqual(["user_1"]);
  });
});

class MemoryProjectBillingGuard {
  reject?: Error;
  readonly checkedOwnerIds: string[] = [];

  async assertCanCreateProject(ownerUserId: string) {
    this.checkedOwnerIds.push(ownerUserId);
    if (this.reject) throw this.reject;
  }
}

class MemoryProjectRepository implements ProjectRepository {
  readonly workspace: ProjectWorkspaceRecord = {
    id: "workspace_1",
    slug: "laxman",
    name: "Laxman",
    kind: "personal",
    createdByUserId: null,
    personalUserId: "user_1"
  };
  readonly projects: PersistCreateProjectInput[] = [];

  async getWorkspaceBySlug(slug: string): Promise<ProjectWorkspaceRecord | undefined> {
    return slug === this.workspace.slug ? this.workspace : undefined;
  }

  async getWorkspaceById(workspaceId: string): Promise<ProjectWorkspaceRecord | undefined> {
    return workspaceId === this.workspace.id ? this.workspace : undefined;
  }

  async projectSlugExists(): Promise<boolean> {
    return false;
  }

  async getProjectByWorkspaceSlug(): Promise<ProjectRecord | undefined> {
    return undefined;
  }

  async getProjectByWorkspaceIdSlug(): Promise<ProjectRecord | undefined> {
    return undefined;
  }

  async createProject(input: PersistCreateProjectInput): Promise<void> {
    this.projects.push(input);
  }

  async listProjectsForWorkspace(): Promise<ProjectRecord[]> {
    return [];
  }

  async listProjectsForUserMemberships(): Promise<ProjectRecord[]> {
    return [];
  }
}
