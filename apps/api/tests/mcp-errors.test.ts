import { describe, expect, it } from "vitest";
import { WorkspaceForbiddenError, WorkspaceNotFoundError, WorkspaceSlugUnavailableError } from "@agent-artifacts/shared";
import { WorkspaceInvitationConflictError } from "@agent-artifacts/workspace";
import { mcpErrorPayload } from "../src/http/mcp.js";

describe("mcpErrorPayload", () => {
  it("maps workspace-domain errors to typed JSON-RPC errors", () => {
    expect(mcpErrorPayload(new WorkspaceForbiddenError("No access.")).error).toMatchObject({
      code: -32001,
      message: "No access."
    });
    expect(mcpErrorPayload(new WorkspaceNotFoundError()).error.code).toBe(-32004);
    expect(mcpErrorPayload(new WorkspaceSlugUnavailableError("acme")).error.code).toBe(-32009);
    expect(mcpErrorPayload(new WorkspaceInvitationConflictError("Already invited.")).error).toMatchObject({
      code: -32009,
      message: "Already invited."
    });
  });
});
