"use client";

import Link from "next/link";
import { useArtifactSession } from "../../lib/auth-client";
import type { WorkspaceSummary } from "../../lib/server-api";
import { WorkspaceSwitcher } from "./workspace-switcher";

async function signOut() {
  await fetch(`${window.location.origin}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include"
  });
  window.location.href = "/";
}

export function SessionNav(props: { workspaces?: WorkspaceSummary[] }) {
  const { data, isPending } = useArtifactSession();
  const workspaces = props.workspaces ?? [];

  if (isPending) {
    return (
      <nav className="top-nav">
        <span className="muted">Loading session…</span>
      </nav>
    );
  }

  if (!data?.user) {
    return (
      <nav className="top-nav">
        <Link href="/login">Sign in</Link>
      </nav>
    );
  }

  return (
    <nav className="top-nav">
      <WorkspaceSwitcher workspaces={workspaces} />
      <Link href="/dashboard">Dashboard</Link>
      <Link href="/settings/account">Account</Link>
      <button type="button" className="link-button" onClick={() => void signOut()}>
        Sign out
      </button>
    </nav>
  );
}
