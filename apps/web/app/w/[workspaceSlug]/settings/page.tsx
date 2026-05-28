import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { WorkspaceInviteForm } from "../../../components/workspace-invite-form";
import {
  cookieHeader,
  fetchWorkspaceAuditEvents,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  resolveWorkspaceBySlug,
  workspacePath
} from "../../../../lib/server-api";

export default async function WorkspaceSettingsPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const workspaceResult = await resolveWorkspaceBySlug(header, workspaceSlug);

  if (!workspaceResult.ok && (workspaceResult.status === 401 || workspaceResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/w/${workspaceSlug}/settings`)}`);
  }

  if (!workspaceResult.ok && workspaceResult.status === 404) {
    notFound();
  }

  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.message ?? "Unexpected workspace response");
  }

  const { workspace } = workspaceResult.body;

  if (workspace.kind === "personal") {
    redirect("/settings/account");
  }

  const [membersResult, invitationsResult, auditResult] = await Promise.all([
    fetchWorkspaceMembers(workspace.id, header),
    fetchWorkspaceInvitations(workspace.id, header),
    fetchWorkspaceAuditEvents(workspace.id, header)
  ]);

  const canManageMembers = membersResult.ok;
  const members = membersResult.ok ? membersResult.body.members : [];
  const invitations = invitationsResult.ok ? invitationsResult.body.invitations : [];
  const auditEvents = auditResult.ok ? auditResult.body.events : [];

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team settings</p>
          <h1>{workspace.name}</h1>
          <p className="subtle">Manage members and invitations for @{workspace.slug}.</p>
        </div>
        <Link className="ghost-button" href={workspacePath(workspace)}>
          Back to workspace
        </Link>
      </header>

      <section className="card flat stack">
        <div>
          <h2>Members</h2>
          {!canManageMembers ? (
            <p className="muted">You do not have permission to view team members.</p>
          ) : members.length === 0 ? (
            <p className="muted">No members found.</p>
          ) : (
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <div>
                    <strong>{member.userId}</strong>
                    <p className="muted small">{member.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canManageMembers && invitations.length > 0 ? (
        <section className="card flat stack">
          <div>
            <h2>Pending invitations</h2>
            <ul className="member-list">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <p className="muted small">
                      {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {canManageMembers ? (
        <section className="card flat stack">
          <div>
            <h2>Invite teammate</h2>
            <p className="muted">Send an email invitation to join this team workspace.</p>
            <WorkspaceInviteForm workspaceId={workspace.id} />
          </div>
        </section>
      ) : null}

      {canManageMembers ? (
        <section className="card flat stack">
          <div>
            <h2>Audit log</h2>
            {auditEvents.length === 0 ? (
              <p className="muted">No workspace audit events yet.</p>
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Action</th>
                    <th>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                      <td>{event.action}</td>
                      <td className="muted">{event.actorPrincipalType}:{event.actorPrincipalId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
