"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InvitableWorkspaceRole } from "../../lib/server-api";

export function WorkspaceInviteForm(props: { workspaceId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableWorkspaceRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/workspaces/${encodeURIComponent(props.workspaceId)}/invitations`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Could not send invitation.");
      return;
    }

    setEmail("");
    setSuccess("Invitation sent.");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <label className="stack tight">
        <span className="label">Email</span>
        <input
          autoComplete="email"
          className="input"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label className="stack tight">
        <span className="label">Role</span>
        <select className="input" onChange={(event) => setRole(event.target.value as InvitableWorkspaceRole)} value={role}>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
          <option value="viewer">Viewer</option>
          <option value="billing_admin">Billing admin</option>
        </select>
      </label>
      {error ? <p className="error">{error}</p> : null}
      {success ? <p className="pill success">{success}</p> : null}
      <button className="primary-button" type="submit">
        Send invitation
      </button>
    </form>
  );
}
