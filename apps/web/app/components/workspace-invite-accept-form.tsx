"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceInviteAcceptForm(props: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function acceptInvitation() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/workspace-invitations/accept", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: props.token })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not accept invitation.");
        return;
      }

      const body = (await response.json()) as { membership: { workspaceId: string } };
      const workspacesResponse = await fetch("/api/workspaces", { credentials: "include", cache: "no-store" });

      if (workspacesResponse.ok) {
        const workspacesBody = (await workspacesResponse.json()) as {
          workspaces: Array<{ id: string; slug: string; kind: string }>;
        };
        const workspace = workspacesBody.workspaces.find((row) => row.id === body.membership.workspaceId);
        if (workspace) {
          router.replace(workspace.kind === "personal" ? "/dashboard" : `/w/${workspace.slug}`);
          router.refresh();
          return;
        }
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? `Could not accept invitation: ${error.message}` : "Could not accept invitation.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      {error ? <p className="error">{error}</p> : null}
      <button className="primary-button" disabled={pending} onClick={() => void acceptInvitation()} type="button">
        {pending ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  );
}
