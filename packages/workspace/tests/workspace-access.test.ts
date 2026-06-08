import { describe, expect, it } from "vitest";
import type { Principal } from "@agent-artifacts/shared";
import { canPerformWorkspaceAction } from "../src/policy.js";
import {
  MemoryWorkspaceRoleResolver,
  authorizeWorkspaceAction,
  createWorkspaceAccess
} from "../src/access.js";

const owner: Principal = {
  type: "user",
  id: "user_owner",
  ownerUserId: "user_owner",
  email: "owner@example.com",
  scopes: []
};

const intruder: Principal = {
  type: "user",
  id: "user_other",
  ownerUserId: "user_other",
  email: "other@example.com",
  scopes: []
};

describe("canPerformWorkspaceAction", () => {
  it("allows owners to delete workspaces", () => {
    expect(canPerformWorkspaceAction({ action: "workspace.delete", role: "owner" }).allowed).toBe(true);
  });

  it("denies members from managing billing", () => {
    const decision = canPerformWorkspaceAction({ action: "workspace.manage_billing", role: "member" });
    expect(decision.allowed).toBe(false);
  });

  it("allows billing admins to manage billing but not members", () => {
    expect(canPerformWorkspaceAction({ action: "workspace.manage_billing", role: "billing_admin" }).allowed).toBe(
      true
    );
    expect(canPerformWorkspaceAction({ action: "workspace.manage_members", role: "billing_admin" }).allowed).toBe(
      false
    );
  });

  it("allows members to create content", () => {
    expect(canPerformWorkspaceAction({ action: "workspace.create_content", role: "member" }).allowed).toBe(true);
  });

  it("denies viewers from creating content", () => {
    expect(canPerformWorkspaceAction({ action: "workspace.create_content", role: "viewer" }).allowed).toBe(false);
  });
});

describe("authorizeWorkspaceAction", () => {
  const workspaceId = "ws_team_1";
  const resolver = new MemoryWorkspaceRoleResolver();
  resolver.setMembership(workspaceId, owner.id, "owner");

  it("allows workspace members to view", async () => {
    const decision = await authorizeWorkspaceAction(resolver, {
      principal: owner,
      action: "workspace.view",
      context: { workspaceId }
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies non-members", async () => {
    const decision = await authorizeWorkspaceAction(resolver, {
      principal: intruder,
      action: "workspace.view",
      context: { workspaceId }
    });

    expect(decision.allowed).toBe(false);
  });

  it("asserts through WorkspaceAccess wrapper", async () => {
    const access = createWorkspaceAccess(resolver);

    await expect(
      access.assertAuthorized({
        principal: owner,
        action: "workspace.manage_members",
        context: { workspaceId }
      })
    ).resolves.toBeUndefined();

    await expect(
      access.assertAuthorized({
        principal: intruder,
        action: "workspace.manage_members",
        context: { workspaceId }
      })
    ).rejects.toThrow("Not a team member.");
  });
});
