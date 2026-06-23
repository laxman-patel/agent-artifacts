import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import type { StoredCredentials } from "./credentials.js";
import { saveStoredCredentials } from "./credentials.js";

export interface BrowserLoginOptions {
  baseUrl: string;
  webUrl: string;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Inlined Artifacts mark so the page stays fully self-contained on localhost.
const brandMarkSvg = `<svg width="18" height="18" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9.21803 0.247076C9.19499 0.118292 9.294 0 9.42483 0H13.5066C13.636 0 13.7347 0.115965 13.7139 0.243753L12.554 7.38639C12.5375 7.48808 12.4496 7.56279 12.3466 7.56279H10.7027C10.601 7.56279 10.5139 7.48987 10.496 7.38971L9.21803 0.247076Z" fill="#FAFAFA"/><path d="M7.58834 22.6674C7.53743 22.781 7.39942 22.8256 7.29159 22.7634L3.58685 20.6244C3.47833 20.5618 3.44844 20.4187 3.5228 20.3178L9.00191 12.8874C9.06708 12.799 9.18932 12.7757 9.28241 12.834L11.2458 14.0622C11.3347 14.1179 11.3689 14.2305 11.3261 14.3262L7.58834 22.6674Z" fill="#FAFAFA"/><path d="M0.317949 12.0379C0.198563 12.0262 0.113178 11.9171 0.130538 11.7984L0.721521 7.75763C0.739929 7.63177 0.865085 7.55101 0.987348 7.58611L11.4904 10.6009C11.6548 10.6482 11.6969 10.8617 11.5626 10.9677L9.18378 12.8463C9.14116 12.8799 9.08717 12.8958 9.03313 12.8905L0.317949 12.0379Z" fill="#FAFAFA"/><path d="M21.9722 7.68915C22.093 7.65541 22.2162 7.73426 22.2362 7.85803L22.8675 11.7724C22.8869 11.893 22.7998 12.0047 22.6781 12.0151L13.9393 12.7658C13.8874 12.7703 13.8357 12.7553 13.7942 12.7238L11.4854 10.9698C11.3471 10.8648 11.3887 10.6469 11.5559 10.6002L21.9722 7.68915Z" fill="#FAFAFA"/><path d="M19.5359 20.3319C19.6112 20.434 19.5795 20.579 19.4686 20.6404L15.732 22.7078C15.6272 22.7659 15.4951 22.7245 15.442 22.617L11.34 14.3126C11.2914 14.2142 11.3268 14.0949 11.4212 14.0389L13.6744 12.7016C13.7672 12.6466 13.8866 12.6708 13.9506 12.7576L19.5359 20.3319Z" fill="#FAFAFA"/><path d="M9.06326 12.9293C8.96997 12.8728 8.95435 12.7438 9.03147 12.6667L11.1082 10.5899C11.1689 10.5293 11.2654 10.524 11.3323 10.5778L13.894 12.6364C13.9873 12.7114 13.9746 12.8571 13.8697 12.9147L11.4228 14.2596C11.3702 14.2885 11.3062 14.2871 11.2548 14.2561L9.06326 12.9293Z" fill="#FAFAFA"/></svg>`;

function renderPage(options: { heading: string; status: string; accent: "ok" | "alert"; bodyHtml: string }): string {
  const accentColor = options.accent === "ok" ? "oklch(0.7 0.08 155)" : "#FF570A";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.heading)} · Artifacts CLI</title>
<style>
  :root {
    color-scheme: dark;
    --bg: oklch(0.17 0 0);
    --border: oklch(0.26 0 0);
    --fg: oklch(0.985 0 0);
    --accent: ${accentColor};
    --sans: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    height: 48px;
    padding: 0 1.25rem;
    border-bottom: 1px solid var(--border);
  }
  .nav svg { display: block; opacity: 0.95; }
  .wordmark {
    font-family: var(--mono);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    color: color-mix(in oklch, var(--fg) 92%, transparent);
  }
  main {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 2rem 1.25rem 4.5rem;
  }
  .panel {
    width: 100%;
    max-width: 26rem;
    border: 1px solid var(--border);
    background: var(--bg);
    padding: 1.75rem;
    box-shadow: 0 18px 48px oklch(0.08 0 0 / 0.28);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid color-mix(in oklch, var(--accent) 35%, transparent);
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .status .dot { width: 0.4rem; height: 0.4rem; background: var(--accent); }
  h1 {
    margin: 1.1rem 0 0;
    font-size: 2rem;
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.03em;
  }
  p {
    margin: 0.7rem 0 0;
    max-width: 36ch;
    font-size: 0.875rem;
    line-height: 1.6;
    color: color-mix(in oklch, var(--fg) 60%, transparent);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1.25rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--border);
    background: color-mix(in oklch, var(--fg) 2%, transparent);
  }
  .row .k {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: color-mix(in oklch, var(--fg) 40%, transparent);
  }
  .row .v {
    font-family: var(--mono);
    font-size: 12px;
    color: color-mix(in oklch, var(--fg) 78%, transparent);
  }
  .hint {
    margin-top: 1.25rem;
    font-size: 0.75rem;
    color: color-mix(in oklch, var(--fg) 38%, transparent);
  }
  .hint code {
    font-family: var(--mono);
    color: color-mix(in oklch, var(--fg) 65%, transparent);
  }
</style>
</head>
<body>
  <header class="nav">${brandMarkSvg}<span class="wordmark">Artifacts</span></header>
  <main>
    <section class="panel">
      <span class="status"><span class="dot"></span>${escapeHtml(options.status)}</span>
      <h1>${escapeHtml(options.heading)}</h1>
      ${options.bodyHtml}
    </section>
  </main>
</body>
</html>`;
}

function successHtml(email?: string): string {
  const accountRow = email
    ? `<div class="row"><span class="k">Account</span><span class="v">${escapeHtml(email)}</span></div>`
    : "";
  return renderPage({
    heading: "Signed in",
    status: "Authenticated",
    accent: "ok",
    bodyHtml: `<p>Your CLI is authenticated. You can close this tab and return to the terminal.</p>
      ${accountRow}
      <p class="hint">Back in the terminal, run <code>artifacts whoami</code> to confirm.</p>`
  });
}

function errorHtml(message: string): string {
  return renderPage({
    heading: "Sign-in failed",
    status: "Error",
    accent: "alert",
    bodyHtml: `<p>${escapeHtml(message)}</p>
      <p class="hint">Run <code>artifacts login</code> in your terminal to try again.</p>`
  });
}

async function exchangeCliCode(baseUrl: string, code: string, state: string): Promise<{ token: string; apiKeyId?: string; email?: string }> {
  const response = await fetch(new URL("/api/cli/exchange", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, state })
  });

  const payload = (await response.json()) as { token?: string; apiKeyId?: string; email?: string; message?: string };
  if (!response.ok || !payload.token) {
    throw new Error(payload.message ?? "Login callback failed: could not exchange authorization code.");
  }

  return { token: payload.token, apiKeyId: payload.apiKeyId, email: payload.email };
}

export async function browserLogin(options: BrowserLoginOptions): Promise<BrowserLoginResult> {
  const state = randomBytes(16).toString("hex");
  const port = pickPort();
  const webUrl = options.webUrl.replace(/\/+$/, "");
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const loginUrl = new URL("/cli/login", webUrl);
  loginUrl.searchParams.set("port", String(port));
  loginUrl.searchParams.set("state", state);

  return new Promise<BrowserLoginResult>((resolve, reject) => {
    let server: Server | undefined;
    const timeout = setTimeout(() => {
      server?.close();
      reject(new Error("Login timed out after 5 minutes. Try again with `artifacts login`."));
    }, 5 * 60_000);

    server = createServer((req, res) => {
      void (async () => {
        const requestUrl = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);

        if (requestUrl.pathname !== "/callback") {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const code = requestUrl.searchParams.get("code");
        const returnedState = requestUrl.searchParams.get("state");

        if (!code || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(errorHtml("The authorization callback was invalid or missing a code."));
          reject(new Error("Login callback failed: invalid or missing authorization code."));
          clearTimeout(timeout);
          server?.close();
          return;
        }

        try {
          const exchanged = await exchangeCliCode(baseUrl, code, state);
          const credentials: StoredCredentials = {
            baseUrl: options.baseUrl,
            webUrl: options.webUrl,
            token: exchanged.token,
            apiKeyId: exchanged.apiKeyId,
            email: exchanged.email,
            updatedAt: new Date().toISOString()
          };

          saveStoredCredentials(credentials);

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(successHtml(exchanged.email));

          clearTimeout(timeout);
          server?.close();
          resolve({ credentials });
        } catch (error) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(errorHtml("Could not exchange the authorization code. Please try signing in again."));
          reject(error instanceof Error ? error : new Error(String(error)));
          clearTimeout(timeout);
          server?.close();
        }
      })();
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
