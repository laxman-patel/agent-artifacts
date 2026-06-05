"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useArtifactSession } from "../../lib/auth-client";

async function signOut() {
  await fetch(`${window.location.origin}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include"
  });
  window.location.href = "/";
}

export function SessionNav() {
  const { data, isPending } = useArtifactSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isPending) {
    return (
      <nav className="top-nav" aria-busy="true">
        <span className="muted">Loading session…</span>
      </nav>
    );
  }

  if (!data?.user) {
    return (
      <nav className="top-nav">
        <Link href="/pricing">Pricing</Link>
        <Link href="/login">Sign in</Link>
      </nav>
    );
  }

  return (
    <nav className="top-nav">
      <Link href="/pricing">Pricing</Link>
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/settings/account">Account</Link>
      <Link href="/settings/billing">Billing</Link>
      <button type="button" className="link-button" onClick={() => void signOut()}>
        Sign out
      </button>
    </nav>
  );
}
