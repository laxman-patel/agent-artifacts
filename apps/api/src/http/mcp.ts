import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ArtifactConflictError,
  ArtifactNotFoundError,
  SlugUnavailableError
} from "@agent-artifacts/artifact";
import { createUserPrincipal, withMcpAuth } from "@agent-artifacts/auth";
import { users } from "@agent-artifacts/db";
import { callMcpTool, listMcpTools, mcpToolInputSchemas, type McpToolName } from "@agent-artifacts/mcp";
import { ArtifactForbiddenError, type Principal } from "@agent-artifacts/shared";
import { getArtifactService, getAuth, getDb, getProjectService } from "../deps.js";

const mcpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional()
});

type McpJsonRpcRequest = z.infer<typeof mcpJsonRpcRequestSchema>;
type McpRequestId = string | number | null;
type McpErrorPayload = {
  jsonrpc: "2.0";
  id: McpRequestId;
  error: { code: number; message: string; data?: unknown };
};

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2024-11-05"] as const;
const DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const SERVER_VERSION = process.env.npm_package_version ?? "0.1.0";

class McpJsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "McpJsonRpcError";
  }
}

function isMcpToolName(name: string): name is McpToolName {
  return name in mcpToolInputSchemas;
}

function isPublicMethod(method: string): boolean {
  return method === "initialize" || method === "tools/list" || method === "ping";
}

async function handleMcpJsonRpc(message: McpJsonRpcRequest, principal: Principal | null): Promise<unknown> {
  switch (message.method) {
    case "initialize": {
      const params = z
        .object({
          protocolVersion: z.string().optional()
        })
        .passthrough()
        .optional()
        .parse(message.params);
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
        params?.protocolVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number]
      )
        ? params!.protocolVersion!
        : DEFAULT_PROTOCOL_VERSION;

      return {
        protocolVersion,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "agent-artifacts",
          version: SERVER_VERSION
        }
      };
    }
    case "tools/list":
      return {
        tools: listMcpTools()
      };
    case "ping":
      return {};
    case "tools/call": {
      const params = z
        .object({
          name: z.string().min(1),
          arguments: z.unknown().optional()
        })
        .parse(message.params);

      if (!isMcpToolName(params.name)) {
        throw new McpJsonRpcError(-32601, `Unknown MCP tool: ${params.name}`);
      }

      if (!principal) {
        throw new McpJsonRpcError(-32001, "Authentication required for tools/call");
      }

      const result = await callMcpTool(params.name, params.arguments ?? {}, {
        artifactService: getArtifactService(),
        projectService: getProjectService(),
        principal
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        structuredContent: result
      };
    }
    default:
      throw new McpJsonRpcError(-32601, `Unknown MCP method: ${message.method}`);
  }
}

function requestId(message: McpJsonRpcRequest): McpRequestId {
  return message.id ?? null;
}

export function mcpErrorPayload(error: unknown, id: McpRequestId = null): McpErrorPayload {
  if (error instanceof McpJsonRpcError) {
    return { jsonrpc: "2.0", id, error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid MCP request.", data: error.issues } };
  }
  if (error instanceof ArtifactForbiddenError) {
    return { jsonrpc: "2.0", id, error: { code: -32001, message: error.message } };
  }
  if (error instanceof ArtifactNotFoundError) {
    return { jsonrpc: "2.0", id, error: { code: -32004, message: error.message } };
  }
  if (error instanceof SlugUnavailableError || error instanceof ArtifactConflictError) {
    return { jsonrpc: "2.0", id, error: { code: -32009, message: error.message } };
  }
  return { jsonrpc: "2.0", id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
}

export function mcpErrorAsResponse(error: unknown, id: McpRequestId = null): Response {
  return Response.json(mcpErrorPayload(error, id), { status: 200 });
}

export function mcpErrorResponse(c: Context, error: unknown) {
  return c.json(mcpErrorPayload(error), 200);
}

export async function handleMcpRequest(c: Context) {
  const raw = await c.req.raw.clone().text();
  const message = mcpJsonRpcRequestSchema.parse(JSON.parse(raw));
  if (message.id === undefined) {
    return new Response(null, { status: 202 });
  }

  if (isPublicMethod(message.method)) {
    let result: unknown;
    try {
      result = await handleMcpJsonRpc(message, null);
    } catch (error) {
      return c.json(mcpErrorPayload(error, requestId(message)), 200);
    }
    return c.json({ jsonrpc: "2.0", id: message.id, result });
  }

  const authRequest = new Request(c.req.raw.url, {
    method: c.req.raw.method,
    headers: c.req.raw.headers,
    body: raw
  });

  const handler = withMcpAuth(getAuth() as never, async (_req: Request, session: { userId: string }) => {
    const [userRow] = await getDb()
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!userRow) {
      return Response.json(
        { jsonrpc: "2.0", id: message.id ?? null, error: { code: -32001, message: "Authenticated user not found." } },
        { status: 200 }
      );
    }

    const principal = createUserPrincipal({ userId: userRow.id, email: userRow.email });
    let result: unknown;
    try {
      result = await handleMcpJsonRpc(message, principal);
    } catch (error) {
      return mcpErrorAsResponse(error, requestId(message));
    }
    return Response.json({ jsonrpc: "2.0", id: message.id, result });
  });

  return handler(authRequest);
}
