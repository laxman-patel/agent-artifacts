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
          Back to dashboard
        </Link>
      </header>

      <section className="card flat stack">
        <WorkspaceCreateForm />
      </section>
    </main>
  );
}
