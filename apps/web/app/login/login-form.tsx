"use client";

import { useLogger } from "@logtail/next/hooks";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signInWithGoogle } from "../../lib/auth-client";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-1.99 3.02v2.52h3.24c1.9-1.75 2.97-4.32 2.97-7.44Z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.6A10 10 0 0 0 12 22Z"
        opacity="0.74"
      />
      <path
        fill="currentColor"
        d="M6.41 13.89a6.02 6.02 0 0 1 0-3.78v-2.6H3.06a10 10 0 0 0 0 8.98l3.35-2.6Z"
        opacity="0.56"
      />
      <path
        fill="currentColor"
        d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.35 2.6C7.2 7.75 9.4 5.99 12 5.99Z"
        opacity="0.9"
      />
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.97c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92v2.8c0 .27.18.59.69.49A10.15 10.15 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const oauthError = searchParams.get("error");
  const log = useLogger();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!oauthError) return;
    log.warn("oauth_login_error", { error: oauthError });
  }, [log, oauthError]);

  async function signInGoogle() {
    setError(null);
    setIsSigningIn(true);

    const callbackURL = `${window.location.origin}${safeNextPath}`;

    try {
      await signInWithGoogle(callbackURL);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
      setIsSigningIn(false);
    }
  }

  const visibleError = error ?? (oauthError ? "Google sign-in did not complete. Try again." : null);

  return (
    <section aria-labelledby="signin-title" className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <h1 id="signin-title" className="!m-0 flex items-start gap-2 whitespace-nowrap font-pixel !text-[2.35rem] !font-normal !leading-none tracking-[-0.045em] text-foreground/95">
        <span>Sign in</span>
        <img src="/brand/artifacts-logo.svg" alt="" className="mt-1 size-3.5 opacity-90" />
      </h1>
      <p className="mt-3 text-[13px] leading-6 text-foreground/50">Continue to Artifacts.</p>

      {visibleError ? (
        <p role="alert" className="mt-5 border border-[#FF570A]/30 bg-[#FF570A]/10 px-3 py-2 text-[13px] leading-5 text-foreground/78">
          {visibleError}
        </p>
      ) : null}

      <div className="mt-7 space-y-3">
        <button
          type="button"
          className="group inline-grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border border-foreground/22 bg-[oklch(0.96_0_0)] px-4 py-3 text-left font-pixel text-[14px] font-normal leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.38),0_1px_0_oklch(1_0_0_/_0.16)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
          onClick={() => void signInGoogle()}
          disabled={isSigningIn}
        >
          <GoogleGlyph />
          <span>{isSigningIn ? "Opening Google" : "Continue with Google"}</span>
          <span className="text-[#FF570A] transition-transform group-hover:translate-x-0.5" aria-hidden>
            ↗
          </span>
        </button>

        <div className="relative pt-2">
          <span
            id="github-coming-soon"
            className="absolute right-2 top-0 z-10 border border-[#FF570A]/35 bg-background px-2 py-1 font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-[#FF570A] shadow-[0_6px_18px_oklch(0.08_0_0_/_0.28)]"
            role="tooltip"
          >
            Coming soon
          </span>
          <button
            type="button"
            className="inline-grid w-full cursor-not-allowed grid-cols-[auto_1fr] items-center gap-3 border border-foreground/[0.09] bg-card/90 px-4 py-3 text-left font-pixel text-[14px] font-normal leading-none tracking-[-0.035em] text-foreground/35"
            disabled
            aria-describedby="github-coming-soon"
          >
            <GithubGlyph />
            <span>Continue with GitHub</span>
          </button>
        </div>
      </div>
    </section>
  );
}
