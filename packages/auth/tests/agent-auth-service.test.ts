import { describe, expect, it } from "vitest";
import {
  agentIdentityInputSchema,
  hashAgentAuthSecret,
  normalizeAgentScopes
} from "../src/agent-auth-service.js";

describe("agent auth utilities", () => {
  it("hashes presented secrets without preserving the raw token", () => {
    const hash = hashAgentAuthSecret("aa_claim_example");

    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashAgentAuthSecret("aa_claim_example"));
    expect(hash).not.toContain("aa_claim_example");
  });

  it("constrains anonymous pre-claim scopes to the configured low-privilege subset", () => {
    const scopes = normalizeAgentScopes({
      requestedScopes: ["artifacts:read", "artifacts:create"],
      allowedScopes: ["artifacts:read"]
    });

    expect(scopes).toEqual(["artifacts:read"]);
  });

  it("requires service_auth registrations to include an email login hint", () => {
    const result = agentIdentityInputSchema.safeParse({
      type: "service_auth",
      scopes: ["artifacts:read"]
    });

    expect(result.success).toBe(false);
  });
});
