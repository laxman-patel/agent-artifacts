import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { StoredCredentials } from "./credentials.js";
import { saveStoredCredentials } from "./credentials.js";

export interface BrowserLoginOptions {
  baseUrl: string;
  webUrl: string;
  noLocalhost?: boolean;
  quiet?: boolean;
}

export interface BrowserLoginResult {
  credentials: StoredCredentials;
}

function log(message: string, quiet?: boolean): void {
  if (!quiet) {
    process.stderr.write(`${message}\n`);
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

function pickPort(): number {
  return 49_152 + Math.floor(Math.random() * 16_383);
}

function successHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>artifacts CLI</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;">
  <h1>Signed in</h1>
  <p>Your CLI is authenticated. You can close this tab and return to the terminal.</p>
</body>
</html>`;
}

export async function browserLogin(options: BrowserLoginOptions): Promise<BrowserLoginResult> {
  const state = randomBytes(16).toString("hex");
  const port = pickPort();
  const webUrl = options.webUrl.replace(/\/+$/, "");
  const loginUrl = new URL("/cli/login", webUrl);
  loginUrl.searchParams.set("port", String(port));
  loginUrl.searchParams.set("state", state);

  if (options.noLocalhost) {
    log(`Open this URL in your browser to sign in:\n${loginUrl.toString()}`, options.quiet);
    log(
      "After signing in, copy the session token from your browser cookies (better-auth.session_token) and run:\n  export AGENT_ARTIFACTS_TOKEN=\"<token>\"",
      options.quiet
    );
    throw new Error("Browser login requires localhost callback. Omit --no-localhost when running locally.");
  }

  return new Promise<BrowserLoginResult>((resolve, reject) => {
    let server: Server | undefined;
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error("Login timed out after 5 minutes. Try again with `artifacts login`."));
    }, 5 * 60_000);

    server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

      if (requestUrl.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const token = requestUrl.searchParams.get("token");
      const returnedState = requestUrl.searchParams.get("state");
      const email = requestUrl.searchParams.get("email") ?? undefined;

      if (!token || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid callback");
        reject(new Error("Login callback failed: invalid or missing token."));
        clearTimeout(timeout);
        server?.close();
        return;
      }

      const credentials: StoredCredentials = {
        baseUrl: options.baseUrl,
        webUrl: options.webUrl,
        token,
        email,
        updatedAt: new Date().toISOString()
      };

      saveStoredCredentials(credentials);

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(successHtml());

      clearTimeout(timeout);
      server?.close();
      resolve({ credentials });
    });

    server.listen(port, "127.0.0.1", () => {
      log(`Opening browser for sign-in…`, options.quiet);
      log(`If the browser does not open, visit:\n${loginUrl.toString()}`, options.quiet);
      openBrowser(loginUrl.toString());
    });

    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
