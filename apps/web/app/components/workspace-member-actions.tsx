"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WorkspaceRole } from "../../lib/server-api";

const allRoles: WorkspaceRole[] = ["owner", "admin", "member", "viewer", "billing_admin"];

function assignableRoles(actorRole: WorkspaceRole, currentRole: WorkspaceRole): WorkspaceRole[] {
  const allowed = actorRole === "owner" ? allRoles : allRoles.filter((role) => role !== "owner");
  if (allowed.includes(currentRole)) {
    return allowed;
  }
  return [currentRole, ...allowed];
}

export function WorkspaceMemberActions(props: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  actorRole: WorkspaceRole;
}) {
  const router = useRouter();
  const [role, setRole] = useState<WorkspaceRole>(props.role);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const roles = assignableRoles(props.actorRole, props.role);

  async function updateRole(nextRole: WorkspaceRole) {
    setRole(nextRole);
    setPending(true);
    setError(null);

    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(props.workspaceId)}/members/${encodeURIComponent(props.userId)}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: nextRole })
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setRole(props.role);
      setError(body.message ?? "Could not update role.");
      setPending(false);
      return;
    }

    setPending(false);
    router.refresh();
  }

  async function removeMember() {
    setPending(true);
    setError(null);

    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(props.workspaceId)}/members/${encodeURIComponent(props.userId)}`,
      {
        method: "DELETE",
        credentials: "include"
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Could not remove member.");
      setPending(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="stack tight member-actions">
      <div className="row-actions">
        <select
          aria-label={`Role for ${props.userId}`}
          className="input compact"
          disabled={pending}
          onChange={(event) => void updateRole(event.target.value as WorkspaceRole)}
          value={role}
        >
          {roles.map((option) => (
            <option key={option} value={option}>
              {option.replace("_", " ")}
            </option>
          ))}
        </select>
        <button className="ghost-button danger" disabled={pending} onClick={() => void removeMember()} type="button">
          Remove
        </button>
      </div>
      {error ? <p className="error small">{error}</p> : null}
    </div>
  );
}
