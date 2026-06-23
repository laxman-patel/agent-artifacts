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
    <section className="relative z-10 w-full max-w-[24rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <h1 className="!m-0 flex items-start gap-2 font-pixel !text-[1.9rem] !font-normal !leading-[1.05] tracking-[-0.045em] text-foreground/95">
        <span>Authorize CLI</span>
        <img src="/brand/artifacts-logo.svg" alt="" className="mt-1.5 size-3 shrink-0 opacity-90" />
      </h1>

      <p className="mt-3 text-[13px] leading-6 text-foreground/50">
        The Artifacts CLI on your machine is requesting access to your account.
      </p>

      <dl className="mt-5 border border-border bg-foreground/[0.02]">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="font-mono text-[10px] uppercase leading-none tracking-[0.16em] text-foreground/40">Callback</dt>
          <dd className="font-mono text-[12px] leading-none text-foreground/75">127.0.0.1:{port}</dd>
        </div>
      </dl>

      <p className="mt-4 text-[12px] leading-5 text-foreground/40">
        Only continue if you just ran <code className="font-mono text-foreground/70">artifacts login</code> yourself.
      </p>

      {error ? (
        <p role="alert" className="mt-5 border border-[#FF570A]/30 bg-[#FF570A]/10 px-3 py-2 text-[13px] leading-5 text-foreground/78">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={authorizing}
        onClick={() => void authorizeCli()}
        className="group mt-5 inline-grid w-full grid-cols-[1fr_auto] items-center gap-3 border border-foreground/22 bg-[oklch(0.96_0_0)] px-4 py-3 text-left font-pixel text-[14px] font-normal leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.38),0_1px_0_oklch(1_0_0_/_0.16)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
      >
        <span>{authorizing ? "Authorizing" : "Authorize CLI"}</span>
        <span className="text-[#FF570A] transition-transform group-hover:translate-x-0.5" aria-hidden>
          ↗
        </span>
      </button>
    </section>
  );
}
