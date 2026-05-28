import { describe, expect, it } from "vitest";
import type { Principal } from "@agent-artifacts/shared";
import {
  MemoryArtifactRoleResolver,
  assertAuthorized,
  authorize,
  createArtifactAccess
} from "../src/index.js";

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

describe("authorize", () => {
  const resolver = new MemoryArtifactRoleResolver();

  it("allows namespace create for the owner account", async () => {
    const decision = await authorize(resolver, {
      principal: owner,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: "user_owner" }
    });

    expect(decision.allowed).toBe(true);
    expect(decision).toMatchObject({ allowed: true, effectiveRole: "owner" });
  });

  it("denies namespace create for another user", async () => {
    const decision = await authorize(resolver, {
      principal: intruder,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: "user_owner" }
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toContain("admin");
    }
  });

  it("allows agents to create in their owner namespace when scoped", async () => {
    const agent: Principal = {
      type: "agent",
      id: "agent_1",
      ownerUserId: "user_owner",
      scopes: ["artifacts:create"]
    };

    const decision = await authorize(resolver, {
      principal: agent,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: "user_owner" }
    });

    expect(decision.allowed).toBe(true);
  });

  it("denies artifact actions on namespace context", async () => {
    const decision = await authorize(resolver, {
      principal: owner,
      action: "artifact.view",
      context: { kind: "namespace", ownerUserId: "user_owner" }
    });

    expect(decision.allowed).toBe(false);
  });

  it("honors share-link grants on artifact context", async () => {
    const artifact = {
      id: "art_1",
      ownerUserId: "user_owner",
      publicView: false,
      publicEdit: false
    };

    const guest: Principal = {
      type: "user",
      id: "guest",
      email: "guest@example.com",
      scopes: [],
      artifactRoleGrants: { art_1: "editor" }
    };

    const decision = await authorize(resolver, {
      principal: guest,
      action: "artifact.update",
      context: { kind: "artifact", artifact }
    });

    expect(decision.allowed).toBe(true);
  });
});

describe("createArtifactAccess", () => {
  it("throws ArtifactForbiddenError via assertAuthorized", async () => {
    const access = createArtifactAccess(new MemoryArtifactRoleResolver());

    await expect(
      access.assertAuthorized({
        principal: intruder,
        action: "artifact.create",
        context: { kind: "namespace", ownerUserId: "user_owner" }
      })
    ).rejects.toMatchObject({ name: "ArtifactForbiddenError" });

    const decision = await access.authorize({
      principal: intruder,
      action: "artifact.create",
      context: { kind: "namespace", ownerUserId: "user_owner" }
    });

    expect(() => assertAuthorized(decision)).toThrow();
  });
});
