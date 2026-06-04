"use client";

import { useLogger } from "@logtail/next/hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { signInWithGoogle } from "../../lib/auth-client";
import { AuthOAuthButtons } from "./auth-oauth-buttons";
import { UsernameField, isValidUsername, normalizeUsernameInput } from "./username-field";

export type AuthMode = "signin" | "signup";

function parseAuthMode(value: string | null): AuthMode {
  return value === "signup" ? "signup" : "signin";
}

function AuthHeading({ title }: { title: string }) {
  const titleId = useId();
  return (
    <h1 id={titleId} className="!m-0 flex items-start gap-2 whitespace-nowrap font-pixel !text-[2.35rem] !font-normal !leading-none tracking-[-0.045em] text-foreground/95">
      <span>{title}</span>
      <img src="/brand/artifacts-logo.svg" alt="" className="mt-1 size-3.5 opacity-90" />
    </h1>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-5 border border-[#FF570A]/30 bg-[#FF570A]/10 px-3 py-2 text-[13px] leading-5 text-foreground/78">
      {message}
    </p>
  );
}

type AuthTabsProps = {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
};

function AuthTabs({ mode, onModeChange }: AuthTabsProps) {
  const signInId = useId();
  const signUpId = useId();

  return (
    <div
      role="tablist"
      aria-label="Authentication"
      className="mb-6 grid grid-cols-2 border-b border-foreground/[0.14]"
    >
      <button
        type="button"
        role="tab"
        id={signInId}
        aria-selected={mode === "signin"}
        aria-controls="auth-signin-panel"
        className={`border-b px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
          mode === "signin"
            ? "-mb-px border-foreground/80 text-foreground/90"
            : "border-transparent text-foreground/38 hover:text-foreground/55"
        }`}
        onClick={() => onModeChange("signin")}
      >
        Sign in
      </button>
      <button
        type="button"
        role="tab"
        id={signUpId}
        aria-selected={mode === "signup"}
        aria-controls="auth-signup-panel"
        className={`border-b px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors ${
          mode === "signup"
            ? "-mb-px border-foreground/80 text-foreground/90"
            : "border-transparent text-foreground/38 hover:text-foreground/55"
        }`}
        onClick={() => onModeChange("signup")}
      >
        Sign up
      </button>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
  const oauthError = searchParams.get("error");
  const initialUsername = searchParams.get("username") ?? "";
  const mode = parseAuthMode(searchParams.get("mode"));
  const log = useLogger();
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);

  const setMode = useCallback(
    (nextMode: AuthMode) => {
      setError(null);
      const params = new URLSearchParams(searchParams.toString());
      if (nextMode === "signup") {
        params.set("mode", "signup");
      } else {
        params.delete("mode");
      }
      const query = params.toString();
      router.replace(query ? `/login?${query}` : "/login", { scroll: false });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!oauthError) return;
    log.warn("oauth_login_error", { error: oauthError });
  }, [log, oauthError]);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const response = await fetch("/api/profile/me", { credentials: "include" });
      if (cancelled) return;

      if (!response.ok) {
        setIsAuthenticated(false);
        setHasUsername(false);
        setSessionReady(true);
        return;
      }

      const body = (await response.json()) as { profile?: { username: string } | null };
      const profileUsername = body.profile?.username;
      setIsAuthenticated(true);
      setHasUsername(Boolean(profileUsername));

      if (profileUsername) {
        router.replace(safeNextPath);
        return;
      }

      setSessionReady(true);
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, [router, safeNextPath]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated || hasUsername || mode === "signup") return;
    setMode("signup");
  }, [sessionReady, isAuthenticated, hasUsername, mode, setMode]);

  async function checkUsernameAvailable(normalizedUsername: string): Promise<boolean> {
    const availability = await fetch(`/api/profile/username-availability/${encodeURIComponent(normalizedUsername)}`);
    const body = (await availability.json().catch(() => ({}))) as { available?: boolean; message?: string; issues?: { message: string }[] };

    if (!availability.ok) {
      setError(body.issues?.[0]?.message ?? body.message ?? "Could not check username.");
      return false;
    }

    if (!body.available) {
      setError("That username is already taken.");
      return false;
    }

    return true;
  }

  async function claimUsernameForSession(normalizedUsername: string): Promise<boolean> {
    const claimResponse = await fetch("/api/profile/username", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: normalizedUsername })
    });

    if (claimResponse.ok) {
      router.replace(safeNextPath);
      return true;
    }

    const claimBody = (await claimResponse.json().catch(() => ({}))) as { message?: string; issues?: { message: string }[] };
    setError(claimBody.issues?.[0]?.message ?? claimBody.message ?? "Could not claim that username.");
    return false;
  }

  async function signInGoogle() {
    setError(null);
    setIsBusy(true);

    try {
      const completeUrl = new URL("/login/complete", window.location.origin);
      completeUrl.searchParams.set("next", safeNextPath);
      await signInWithGoogle(completeUrl.toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
      setIsBusy(false);
    }
  }

  async function signUpGoogle() {
    setError(null);
    const normalizedUsername = normalizeUsernameInput(username);

    if (!isValidUsername(normalizedUsername)) {
      setError("Use 3 to 32 lowercase letters, numbers, hyphens, or underscores.");
      return;
    }

    setIsBusy(true);

    try {
      const available = await checkUsernameAvailable(normalizedUsername);
      if (!available) {
        setIsBusy(false);
        return;
      }

      const completeUrl = new URL("/login/complete", window.location.origin);
      completeUrl.searchParams.set("username", normalizedUsername);
      completeUrl.searchParams.set("next", safeNextPath);
      await signInWithGoogle(completeUrl.toString());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-up failed.");
      setIsBusy(false);
    }
  }

  async function finishSignupClaim() {
    setError(null);
    const normalizedUsername = normalizeUsernameInput(username);

    if (!isValidUsername(normalizedUsername)) {
      setError("Use 3 to 32 lowercase letters, numbers, hyphens, or underscores.");
      return;
    }

    setIsBusy(true);

    try {
      const available = await checkUsernameAvailable(normalizedUsername);
      if (!available) {
        setIsBusy(false);
        return;
      }

      await claimUsernameForSession(normalizedUsername);
    } finally {
      setIsBusy(false);
    }
  }

  const visibleError = error ?? (oauthError ? "Google sign-in did not complete. Try again." : null);
  const showSignupClaimOnly = sessionReady && isAuthenticated && !hasUsername;

  if (!sessionReady && isAuthenticated) {
    return (
      <section className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]" aria-busy="true">
        <AuthHeading title={mode === "signup" ? "Sign up" : "Sign in"} />
        <p className="mt-3 text-[13px] leading-6 text-foreground/50">Checking your session…</p>
      </section>
    );
  }

  return (
    <section className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <AuthTabs mode={mode} onModeChange={setMode} />

      {mode === "signin" ? (
        <div role="tabpanel" id="auth-signin-panel" aria-labelledby="signin-tab">
          <AuthHeading title="Sign in" />
          <p className="mt-3 text-[13px] leading-6 text-foreground/50">Continue to Artifacts.</p>

          {visibleError ? <AuthError message={visibleError} /> : null}

          <div className="mt-5">
            <AuthOAuthButtons
              googleBusy={isBusy}
              googleLabel={isBusy ? "Opening Google" : "Continue with Google"}
              onGoogleClick={() => void signInGoogle()}
            />
          </div>

          <p className="mt-6 text-center text-[13px] leading-6 text-foreground/45">
            Don&apos;t have an account yet?{" "}
            <button
              type="button"
              className="text-foreground/78 underline decoration-foreground/25 underline-offset-[0.2em] transition-colors hover:text-foreground/95"
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </p>
        </div>
      ) : (
        <div role="tabpanel" id="auth-signup-panel" aria-labelledby="signup-tab">
          <AuthHeading title="Sign up" />
          <p className="mt-3 text-[13px] leading-6 text-foreground/50">
            {showSignupClaimOnly ? "Claim your namespace to finish signup." : "Reserve your personal namespace, then continue with Google."}
          </p>

          <div className="mt-6">
            <UsernameField username={username} onUsernameChange={setUsername} />
          </div>

          {visibleError ? <AuthError message={visibleError} /> : null}

          <div className="mt-5">
            {showSignupClaimOnly ? (
              <button
                type="button"
                className="inline-grid w-full grid-cols-[1fr_auto] items-center gap-3 border border-foreground/22 bg-[oklch(0.96_0_0)] px-4 py-3 text-left font-pixel text-[14px] font-normal leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.38),0_1px_0_oklch(1_0_0_/_0.16)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
                onClick={() => void finishSignupClaim()}
                disabled={isBusy}
              >
                <span>{isBusy ? "Claiming namespace" : "Claim namespace"}</span>
                <span className="text-[#FF570A]" aria-hidden>
                  ↗
                </span>
              </button>
            ) : (
              <AuthOAuthButtons
                googleBusy={isBusy}
                googleLabel={isBusy ? "Opening Google" : "Continue with Google"}
                onGoogleClick={() => void signUpGoogle()}
              />
            )}
          </div>

          <p className="mt-6 text-center text-[13px] leading-6 text-foreground/45">
            Already have an account?{" "}
            <button
              type="button"
              className="text-foreground/78 underline decoration-foreground/25 underline-offset-[0.2em] transition-colors hover:text-foreground/95"
              onClick={() => setMode("signin")}
            >
              Sign in
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
