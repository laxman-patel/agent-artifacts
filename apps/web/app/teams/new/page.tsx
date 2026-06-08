import { WorkspaceCreateForm } from "../../components/workspace-create-form";

export default function NewTeamPage() {
  return (
    <main className="mx-auto w-full max-w-[920px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            Create team
          </h1>
          <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-foreground/50">
            Create a shared namespace for team projects and artifacts.
          </p>
        </div>
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
