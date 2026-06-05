import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceInviteAcceptForm } from "../../components/workspace-invite-accept-form";
import { cookieHeader, fetchProfileMe } from "../../../lib/server-api";

export default async function WorkspaceInvitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const profile = await fetchProfileMe(header);
  const nextPath = `/workspace-invite/${encodeURIComponent(token)}`;

  if (!profile.ok || !profile.body.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <main className="page-shell narrow">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team invitation</p>
          <h1>Join workspace</h1>
          <p className="subtle">
            Signed in as {profile.body.user.email}. Accept this invitation to join the team workspace.
          </p>
        </div>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Invitation</h2>
          <p className="muted small">Accepting adds this account to the workspace immediately.</p>
        </div>
        <WorkspaceInviteAcceptForm token={token} />
        <Link className="ghost-button" href="/dashboard">
          Dashboard
        </Link>
      </section>
    </main>
  );
}
