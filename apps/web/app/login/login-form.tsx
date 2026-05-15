"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle } from "../../lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);

  async function signInGoogle() {
    setError(null);

    const callbackURL =
      nextPath.startsWith("/") && !nextPath.startsWith("//")
        ? `${window.location.origin}${nextPath}`
        : `${window.location.origin}/dashboard`;

    try {
      await signInWithGoogle(callbackURL);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in failed.");
    }
  }

  return (
    <main className="shell narrow">
      <section className="card">
        <p className="eyebrow">Account</p>
        <h1>Sign in</h1>
        <p className="lede subtle">Use Google to access restricted artifacts and manage your username namespace.</p>
        {error ? <p className="error">{error}</p> : null}
        <div className="stack">
          <button type="button" className="primary-button" onClick={() => void signInGoogle()}>
            Continue with Google
          </button>
          <button type="button" className="ghost-button" onClick={() => router.push("/")}>
            Back home
          </button>
        </div>
        <p className="muted small">
          After OAuth completes you will return to{" "}
          <Link href={nextPath.startsWith("/") ? nextPath : "/dashboard"}>{nextPath.startsWith("/") ? nextPath : "/dashboard"}</Link>.
        </p>
      </section>
    </main>
  );
}
