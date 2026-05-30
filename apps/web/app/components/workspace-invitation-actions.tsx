"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceInvitationActions(props: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(action: "revoke" | "resend") {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspace-invitations/${encodeURIComponent(props.invitationId)}/${action}`,
        {
          method: "POST",
          credentials: "include"
        }
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Could not ${action} invitation.`);
        return;
      }

      setMessage(action === "resend" ? "Invitation resent." : "Invitation revoked.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? `Could not ${action} invitation: ${error.message}` : `Could not ${action} invitation.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack tight">
      <div className="row-actions">
        <button className="ghost-button" disabled={pending} onClick={() => void post("resend")} type="button">
          Resend
        </button>
        <button className="ghost-button danger" disabled={pending} onClick={() => void post("revoke")} type="button">
          Revoke
        </button>
      </div>
      {message ? <p className="pill success">{message}</p> : null}
      {error ? <p className="error small">{error}</p> : null}
    </div>
  );
}
