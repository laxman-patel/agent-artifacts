import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { artifactErrorResponse } from "./errors.js";
import { mcpErrorResponse } from "./mcp.js";
import { logger, serializeError } from "../logger.js";

type JsonEnvelope = {
  body: unknown;
  status: ContentfulStatusCode;
  headers?: Record<string, string>;
};

type TextEnvelope = {
  text: string;
  status: ContentfulStatusCode;
  headers?: Record<string, string>;
};

function applyHeaders(c: Context, headers?: Record<string, string>) {
  if (!headers) return;
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
}

function isJsonEnvelope(value: unknown): value is JsonEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "body" in value &&
    "status" in value &&
    typeof (value as JsonEnvelope).status === "number"
  );
}

function isTextEnvelope(value: unknown): value is TextEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "text" in value &&
    "status" in value &&
    typeof (value as TextEnvelope).text === "string"
  );
}

export async function handle(c: Context, work: () => Promise<unknown>) {
  try {
    const result = await work();
    if (result instanceof Response) {
      return result;
    }
    if (isJsonEnvelope(result)) {
      applyHeaders(c, result.headers);
      return c.json(result.body as never, result.status);
    }
    if (isTextEnvelope(result)) {
      return c.text(result.text, result.status, result.headers);
    }
    return c.json(result as never);
  } catch (error) {
    try {
      return artifactErrorResponse(c, error);
    } catch (rethrown) {
      logger.error("unhandled_request_error", {
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
        err: serializeError(rethrown)
      });
      throw rethrown;
    }
  }
}

export async function handleMcp(c: Context, work: () => Promise<unknown>) {
  try {
    const result = await work();
    if (result instanceof Response) {
      return result;
    }
    return c.json(result);
  } catch (error) {
    try {
      return mcpErrorResponse(c, error);
    } catch (rethrown) {
      logger.error("unhandled_mcp_error", {
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
        err: serializeError(rethrown)
      });
      throw rethrown;
    }
  }
}
