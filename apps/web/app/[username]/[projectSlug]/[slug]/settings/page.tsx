import Link from "next/link";
import { cookies } from "next/headers";
import { AccessSettingsForm } from "../../../../components/access-settings-form";
import { DeleteArtifactButton } from "../../../../components/delete-artifact-button";
import { RestrictedArtifactView } from "../../../../components/restricted-artifact-view";
import { ShareLinksManager } from "../../../../components/share-links-manager";
import { artifactPath, cookieHeader, fetchArtifactAccess, fetchShareLinks, loadArtifactGate } from "../../../../../lib/server-api";

export default async function ArtifactSettingsPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const path = artifactPath({
    ownerUsername: params.username,
    projectSlug: params.projectSlug,
    slug: params.slug
  });

  const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, {
    redirectPath: `${path}/settings`
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }
  const meta = gate.meta;

  const [access, shareLinksResult] = await Promise.all([
    fetchArtifactAccess(meta.id, header),
    fetchShareLinks(meta.id, header)
  ]);

  if (!access.ok && access.status === 403) {
    return (
      <main className="workbench min-h-screen bg-[var(--wb-canvas)] px-4 py-8 text-foreground">
        <div className="mx-auto max-w-3xl rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/38">Access</p>
          <h1 className="mt-2 text-[1.75rem]">Admin access required</h1>
          <p className="mt-2 max-w-prose text-[14px] leading-6 text-foreground/58">
            Only artifact admins can change access rules.
          </p>
          <Link className="ghost-button mt-4 inline-flex" href={path}>Artifact</Link>
        </div>
      </main>
    );
  }

  if (!access.ok) {
    throw new Error("Unexpected access response");
  }

  const base = artifactPath(meta);

  return (
    <main className="workbench min-h-screen bg-[var(--wb-canvas)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Link className="ghost-button inline-flex" href={base}>
            Artifact
          </Link>
          <nav className="mt-4 rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-sidebar)] p-2">
            <p className="px-2 pb-2 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">
              Manage
            </p>
            {[
              ["Rules", "#rules"],
              ["Share links", "#share-links"],
              ["Activity", "#activity"],
              ["Danger zone", "#danger"]
            ].map(([label, href]) => (
              <a
                className="block rounded-[0.3rem] px-2 py-1.5 text-[13px] text-foreground/62 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/90"
                href={href}
                key={href}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <header className="rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/38">Artifact settings</p>
                <h1 className="mt-2 truncate text-[2rem] leading-tight">{meta.title}</h1>
                <p className="mt-2 truncate font-mono text-[12px] text-foreground/45">{base}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-[0.3rem] border border-[var(--wb-line-strong)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/48">
                  {access.body.publicView ? "Public view" : "Restricted"}
                </span>
                <span className="rounded-[0.3rem] border border-[var(--wb-line-strong)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/48">
                  {shareLinksResult.ok ? `${shareLinksResult.body.shareLinks.filter((link) => !link.revokedAt).length} active links` : "Links unavailable"}
                </span>
              </div>
            </div>
          </header>

          <section id="rules" className="rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)] p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground/88">Rules</h2>
              <p className="mt-1 text-[13px] leading-5 text-foreground/50">
                Choose who can view or edit this artifact. Viewer emails are the full-page control for restricted access.
              </p>
            </div>
            <AccessSettingsForm
              artifactId={meta.id}
              initialPublicEdit={access.body.publicEdit}
              initialPublicView={access.body.publicView}
              initialViewerEmails={access.body.viewerEmails}
            />
          </section>

          <section id="share-links" className="rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)] p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground/88">Share links</h2>
              <p className="mt-1 text-[13px] leading-5 text-foreground/50">
                Create revocable viewer or editor links with optional expiry.
              </p>
            </div>
            <ShareLinksManager
              artifactId={meta.id}
              initialLinks={shareLinksResult.ok ? shareLinksResult.body.shareLinks : []}
            />
          </section>

          <section id="activity" className="rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)] p-5">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground/88">Activity</h2>
              <p className="mt-1 text-[13px] leading-5 text-foreground/50">
                Audit events stay attached to the artifact lifecycle.
              </p>
            </div>
            <Link className="ghost-button inline-flex" href={`${base}/audit`}>
              View audit log
            </Link>
          </section>

          <section
            id="danger"
            className="rounded-[0.625rem] border border-[color-mix(in_oklch,var(--wb-accent-orange)_32%,var(--wb-line))] bg-[color-mix(in_oklch,var(--wb-accent-orange)_7%,var(--wb-tile))] p-5"
          >
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground/88">Danger zone</h2>
              <p className="mt-1 text-[13px] leading-5 text-foreground/50">
                Deleting hides this artifact from all reads and revokes all access. Audit history is preserved.
              </p>
            </div>
            <DeleteArtifactButton artifactId={meta.id} artifactTitle={meta.title} workspaceSlug={meta.workspaceSlug} />
          </section>
        </div>
      </div>
    </main>
  );
}
