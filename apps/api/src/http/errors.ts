import type { Context } from "hono";
import {
  ArtifactConflictError,
  ArtifactIntegrityError,
  ArtifactNotFoundError,
  ProfileNotFoundError,
  ProjectNotFoundError,
  ProjectSlugUnavailableError,
  ShareLinkExpiredError,
  ShareLinkNotFoundError,
  SlugUnavailableError,
  UsernameAlreadySetError,
  UsernameTakenError
} from "@agent-artifacts/artifact";
import { AgentAuthError } from "@agent-artifacts/auth";
import { EntitlementLimitError } from "@agent-artifacts/billing";
import {
  ArtifactForbiddenError,
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceSlugUnavailableError
} from "@agent-artifacts/shared";
import { z } from "zod";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function artifactErrorResponse(c: Context, error: unknown) {
  if (error instanceof AgentAuthError) {
    return Response.json(
      { error: error.code, message: error.message, error_description: error.message },
      { status: error.status }
    );
  }

  if (
    error instanceof ArtifactNotFoundError ||
    error instanceof ProfileNotFoundError ||
    error instanceof ShareLinkNotFoundError ||
    error instanceof WorkspaceNotFoundError
  ) {
    return c.json({ error: "not_found", message: error.message }, 404);
  }

  if (error instanceof ShareLinkExpiredError) {
    return c.json({ error: "gone", message: error.message }, 410);
  }

  if (error instanceof ArtifactForbiddenError || error instanceof WorkspaceForbiddenError) {
    return c.json({ error: "forbidden", message: error.message }, 403);
  }

  if (error instanceof EntitlementLimitError) {
    return c.json({
      error: "plan_limit_exceeded",
      message: error.message,
      ...(error.limit ? { limit: error.limit } : {}),
      ...(error.requiredPlanId ? { requiredPlanId: error.requiredPlanId } : {})
    }, 402);
  }

  if (
    error instanceof SlugUnavailableError ||
    error instanceof ProjectSlugUnavailableError ||
    error instanceof ArtifactConflictError ||
    error instanceof UsernameAlreadySetError ||
    error instanceof UsernameTakenError ||
    error instanceof WorkspaceSlugUnavailableError
  ) {
    return c.json({ error: "conflict", message: error.message }, 409);
  }

  if (error instanceof ArtifactIntegrityError) {
    return c.json({ error: "integrity_check_failed", message: error.message }, 500);
  }

  if (error instanceof ProjectNotFoundError) {
    return c.json({ error: "not_found", message: error.message }, 404);
  }

  if (error instanceof z.ZodError) {
    return c.json({ error: "invalid_request", issues: error.issues }, 400);
  }

  if (isUniqueViolation(error)) {
    return c.json({ error: "conflict", message: "That username is already taken." }, 409);
  }

  throw error;
}
