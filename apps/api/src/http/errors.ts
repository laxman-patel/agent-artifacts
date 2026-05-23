import type { Context } from "hono";
import {
  ArtifactConflictError,
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
import { ArtifactForbiddenError } from "@agent-artifacts/shared";
import { z } from "zod";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function artifactErrorResponse(c: Context, error: unknown) {
  if (error instanceof ArtifactNotFoundError || error instanceof ProfileNotFoundError || error instanceof ShareLinkNotFoundError) {
    return c.json({ error: "not_found", message: error.message }, 404);
  }

  if (error instanceof ShareLinkExpiredError) {
    return c.json({ error: "gone", message: error.message }, 410);
  }

  if (error instanceof ArtifactForbiddenError) {
    return c.json({ error: "forbidden", message: error.message }, 403);
  }

  if (
    error instanceof SlugUnavailableError ||
    error instanceof ProjectSlugUnavailableError ||
    error instanceof ArtifactConflictError ||
    error instanceof UsernameAlreadySetError ||
    error instanceof UsernameTakenError
  ) {
    return c.json({ error: "conflict", message: error.message }, 409);
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
