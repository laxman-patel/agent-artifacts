import { describe, expect, it } from "vitest";
import { createArtifactAccess, MemoryArtifactRoleResolver } from "@agent-artifacts/access";
import type { Principal } from "@agent-artifacts/shared";
import { createWorkspaceAccess, MemoryWorkspaceRoleResolver } from "@agent-artifacts/workspace";
import {
  ProjectService,
  type PersistCreateProjectInput,
  type ProjectRecord,
  type ProjectRepository
} from "../src/index.js";

const owner: Principal = {
  type: "user",
  id: "user_1",
  ownerUserId: "user_1",
  email: "owner@example.com",
  scopes: []
};

describe("ProjectService", () => {
  it("transfers an owned personal project into a workspace namespace", async () => {
    const repository = new MemoryProjectRepository();
    const workspaceRoles = new MemoryWorkspaceRoleResolver();
    workspaceRoles.setMembership("ws_team", owner.id, "owner");
    const service = new ProjectService(
      repository,
      "https://app.example.com",
      createArtifactAccess(new MemoryArtifactRoleResolver()),
      createWorkspaceAccess(workspaceRoles)
    );

    const transferred = await service.transferProjectToWorkspace("project_personal", "ws_team", "acme", owner);

    expect(transferred).toMatchObject({
      projectId: "project_personal",
      workspaceId: "ws_team",
      normalizedSlug: "default",
      url: "https://app.example.com/w/acme/default"
    });
    expect(repository.projects.get("project_personal")?.workspaceId).toBe("ws_team");
  });
});

class MemoryProjectRepository implements ProjectRepository {
  readonly owners = new Map([["alice", { userId: owner.id, username: "alice" }]]);
  readonly projects = new Map<string, ProjectRecord>([
    [
      "project_personal",
      {
        id: "project_personal",
        ownerUserId: owner.id,
        ownerUsername: "alice",
        workspaceId: "ws_personal",
        slug: "default",
        title: "Default",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]
  ]);

  async getOwnerByUsername(username: string) {
    return this.owners.get(username);
  }

  async projectSlugExists(ownerUserId: string, normalizedSlug: string): Promise<boolean> {
    return [...this.projects.values()].some(
      (project) => project.ownerUserId === ownerUserId && project.slug === normalizedSlug
    );
  }

  async workspaceProjectSlugExists(workspaceId: string, normalizedSlug: string): Promise<boolean> {
    return [...this.projects.values()].some(
      (project) => project.workspaceId === workspaceId && project.slug === normalizedSlug
    );
  }

  async getProjectByOwnerSlug(username: string, projectSlug: string) {
    return [...this.projects.values()].find(
      (project) => project.ownerUsername === username && project.slug === projectSlug
    );
  }

  async getProjectByWorkspaceSlug(workspaceId: string, projectSlug: string) {
    return [...this.projects.values()].find(
      (project) => project.workspaceId === workspaceId && project.slug === projectSlug
    );
  }

  async getProjectById(projectId: string) {
    return this.projects.get(projectId);
  }

  async createProject(input: PersistCreateProjectInput): Promise<void> {
    this.projects.set(input.id, {
      id: input.id,
      ownerUserId: input.ownerUserId,
      ownerUsername: "alice",
      workspaceId: input.workspaceId ?? null,
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async transferProjectToWorkspace(projectId: string, workspaceId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      this.projects.set(projectId, { ...project, workspaceId, updatedAt: new Date() });
    }
  }

  async listProjectsForOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter((project) => project.ownerUserId === ownerUserId);
  }

  async listProjectsForWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter((project) => project.workspaceId === workspaceId);
  }

  async getPersonalWorkspaceId(): Promise<string | undefined> {
    return "ws_personal";
  }
}
