import Link from "next/link";
import { WorkspaceCreateForm } from "../../components/workspace-create-form";

export default function NewTeamPage() {
  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">New team</p>
          <h1>Create team</h1>
          <p className="subtle">Create a shared namespace for team projects and artifacts.</p>
        </div>
        <Link className="ghost-button" href="/dashboard">
          Dashboard
        </Link>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Team identity</h2>
          <p className="muted small">The slug becomes the shared namespace for team artifacts.</p>
        </div>
        <WorkspaceCreateForm />
      </section>
    </main>
  );
}
