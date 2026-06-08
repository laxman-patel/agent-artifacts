import Link from "next/link";
import { WorkspaceCreateForm } from "../../components/workspace-create-form";

export default function NewWorkspacePage() {
  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">New team workspace</p>
          <h1>Create workspace</h1>
          <p className="subtle">Create a shared namespace for team projects and artifacts.</p>
        </div>
        <Link className="ghost-button" href="/dashboard">
          Dashboard
        </Link>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Workspace identity</h2>
          <p className="muted small">The slug becomes the shared namespace for team artifacts.</p>
        </div>
        <WorkspaceCreateForm />
      </section>
    </main>
  );
}
