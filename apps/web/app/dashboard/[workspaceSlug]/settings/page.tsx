import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { WorkspaceInvitationActions } from "../../../components/workspace-invitation-actions";
import { WorkspaceInviteForm } from "../../../components/workspace-invite-form";
import { WorkspaceMemberActions } from "../../../components/workspace-member-actions";
import {
  cookieHeader,
  fetchWorkspaceAuditEvents,
  fetchWorkspaceInvitations,
  fetchWorkspaceMembers,
  fetchWorkspaces,
  workspaceDashboardPath
} from "../../../../lib/server-api";

export default async function WorkspaceSettingsPage(props: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${workspaceSlug}/settings`)}`);
  }

  if (!workspacesResult.ok) {
    throw new Error(workspacesResult.message ?? "Teams could not be loaded.");
  }

  const workspace = workspacesResult.body.workspaces.find(
    (candidate) => candidate.slug.toLowerCase() === workspaceSlug.toLowerCase()
  );

  if (!workspace || workspace.kind === "personal") {
    notFound();
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
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team settings</p>
          <h1>{workspace.name}</h1>
          <p className="meta-line">/{workspace.slug} · {workspace.role}</p>
        </div>
        <Link className="ghost-button" href={workspaceDashboardPath(workspace)}>
          Team
        </Link>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Members</h2>
          <p className="muted small">Roles control team access across web, API, CLI, and MCP.</p>
        </div>
        <div>
          {!canManageMembers ? (
            <p className="empty-state">You do not have permission to view team members.</p>
          ) : members.length === 0 ? (
            <p className="empty-state">No members found.</p>
          ) : (
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <div>
                    <strong>{member.displayName ?? member.name ?? member.email ?? member.userId}</strong>
                    <p className="muted small">
                      {member.email ? `${member.email} · ` : null}
                      {member.userId}
                    </p>
                  </div>
                  <WorkspaceMemberActions
                    workspaceId={workspace.id}
                    userId={member.userId}
                    displayName={member.displayName ?? member.name}
                    email={member.email}
                    role={member.role}
                    actorRole={workspace.role}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canManageMembers && invitations.length > 0 ? (
        <section className="card flat stack">
          <div className="section-header">
            <h2>Pending invitations</h2>
            <p className="muted small">Invitations expire automatically if they are not accepted.</p>
          </div>
          <div>
            <ul className="member-list">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <p className="muted small">
                      {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <WorkspaceInvitationActions invitationId={invitation.id} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {canManageMembers ? (
        <section className="card flat stack">
          <div className="section-header">
            <h2>Invite teammate</h2>
            <p className="muted">Create an invitation link, then send it to the invitee.</p>
          </div>
          <div>
            <WorkspaceInviteForm workspaceId={workspace.id} />
          </div>
        </section>
      ) : null}

      {canManageMembers ? (
        <section className="card flat stack">
          <div className="section-header">
            <h2>Audit log</h2>
            <p className="muted small">Recent team-level changes.</p>
          </div>
          <div>
            {auditEvents.length === 0 ? (
              <p className="empty-state">No team audit events yet.</p>
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
