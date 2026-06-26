import { CliError, errorKindFromApi, exitCodeForKind } from "./errors.js";
import type { CliConfig } from "./config.js";

export interface ApiErrorBody {
  error?: string;
  message?: string;
  issues?: unknown;
}

export class ApiClient {
  constructor(private readonly config: CliConfig) {}

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      query?: Record<string, string | number | undefined>;
      accept?: string;
      rawText?: boolean;
    }
  ): Promise<T> {
    const url = new URL(path, `${this.config.baseUrl}/`);
    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers = new Headers();
    if (this.config.token) {
      headers.set("Authorization", `Bearer ${this.config.token}`);
    }

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    if (options?.accept) {
      headers.set("Accept", options.accept);
    }

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new CliError(
        "network",
        `Could not reach the API at ${this.config.baseUrl}: ${reason}`,
        exitCodeForKind("network")
      );
    }

    if (options?.rawText) {
      const text = await response.text();
      if (!response.ok) {
        throw apiErrorFromResponse(response.status, text, response.headers.get("content-type") ?? "");
      }
      return text as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? ((await response.json()) as T | ApiErrorBody) : await response.text();

    if (!response.ok) {
      if (typeof payload === "object" && payload !== null && "error" in payload) {
        throw apiErrorFromBody(response.status, payload as ApiErrorBody);
      }
      throw nonJsonError(response.status, typeof payload === "string" ? payload : undefined);
    }

    return payload as T;
  }

  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

function apiErrorFromBody(status: number, body: ApiErrorBody): CliError {
  const kind = errorKindFromApi(body.error);
  if (body.error === "csrf_blocked") {
    return new CliError(kind, "Not signed in. Run `artifacts login`.", exitCodeForKind(kind), body.issues ?? body);
  }

  const message = body.message ?? body.error ?? `HTTP ${status}`;
  return new CliError(kind, message, exitCodeForKind(kind), body.issues ?? body);
}

function apiErrorFromResponse(status: number, text: string, contentType: string): CliError {
  if (contentType.includes("application/json")) {
    try {
      return apiErrorFromBody(status, JSON.parse(text) as ApiErrorBody);
    } catch {
      // Fall through to the non-JSON handling below.
    }
  }
  return nonJsonError(status, text);
}

const MAX_ERROR_SNIPPET = 200;

/**
 * Builds a clean error for non-JSON responses (e.g. an HTML 404/502 page from a
 * proxy or the wrong base URL). We never surface the full body — dumping an
 * entire HTML document as an error is what made commands like `health` produce
 * pages of noise. A short, single-line snippet is enough to diagnose.
 */
function nonJsonError(status: number, body: string | undefined): CliError {
  const kind = status === 404 ? "not_found" : "unknown";
  const snippet = body
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ERROR_SNIPPET);
  const hint =
    status === 404
      ? "Endpoint not found. Check --base-url (it should point at the API, e.g. https://hostartifacts.dev)."
      : `Unexpected non-JSON response from the API (HTTP ${status}).`;
  return new CliError(kind, hint, exitCodeForKind(kind), snippet ? { status, body: snippet } : { status });
}
