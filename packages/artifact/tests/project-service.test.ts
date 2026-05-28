import { describe, expect, it } from "vitest";
import { EntitlementLimitError } from "@agent-artifacts/billing";
import { createArtifactAccess, MemoryArtifactRoleResolver } from "@agent-artifacts/access";
import type { Principal } from "@agent-artifacts/shared";
import {
  ProjectService,
  type PersistCreateProjectInput,
  type ProjectRecord,
  type ProjectRepository
} from "../src/index.js";

const ownerPrincipal: Principal = {
  type: "user",
  id: "user_1",
  ownerUserId: "user_1",
  email: "owner@example.com",
  scopes: []
};

describe("ProjectService billing gates", () => {
  it("checks project entitlements before creating another project", async () => {
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
  readonly projects: PersistCreateProjectInput[] = [];

  async getOwnerByUsername(username: string) {
    return username === "laxman" ? { userId: "user_1", username: "laxman" } : undefined;
  }

  async projectSlugExists() {
    return false;
  }

  async getProjectByOwnerSlug(): Promise<ProjectRecord | undefined> {
    return undefined;
  }

  async createProject(input: PersistCreateProjectInput): Promise<void> {
    this.projects.push(input);
  }

  async listProjectsForOwner(): Promise<ProjectRecord[]> {
    return [];
  }
}
