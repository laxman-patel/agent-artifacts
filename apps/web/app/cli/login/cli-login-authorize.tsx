"use client";

import { useState } from "react";

interface CliLoginAuthorizeProps {
  port: string;
  state: string;
}

export function CliLoginAuthorize({ port, state }: CliLoginAuthorizeProps) {
  const [error, setError] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  async function authorizeCli() {
    setError(null);
    setAuthorizing(true);

    try {
      const response = await fetch("/api/cli/authorize", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ port: Number.parseInt(port, 10), state })
      });

      const payload = (await response.json()) as { callbackUrl?: string; message?: string };

      if (!response.ok || !payload.callbackUrl) {
        setError(payload.message ?? "Could not authorize the CLI. Try running `artifacts login` again.");
        setAuthorizing(false);
        return;
      }

      window.location.href = payload.callbackUrl;
    } catch {
      setError("Network error while authorizing the CLI.");
      setAuthorizing(false);
    }
  }

  return (
    <main className="shell narrow">
      <section className="card stack">
        <div className="section-header">
          <p className="eyebrow">CLI</p>
          <h1>Authorize CLI</h1>
        </div>
        <p>
          The artifacts CLI on your machine is requesting access to your account. Only continue if you
          just ran <code>artifacts login</code>.
        </p>
        {error ? <p className="error">{error}</p> : null}
        <button type="button" className="primary-button" disabled={authorizing} onClick={() => void authorizeCli()}>
          {authorizing ? "Authorizing…" : "Authorize CLI"}
        </button>
      </section>
    </main>
  );
}
