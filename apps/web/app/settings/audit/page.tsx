import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieHeader, fetchAuditEvents, fetchProfileMe } from "../../../lib/server-api";

export default async function GlobalAuditLogPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const me = await fetchProfileMe(header);
  if (!me.ok || !me.body) {
    redirect("/login?next=/settings/audit");
  }

  const eventsResult = await fetchAuditEvents(header, { limit: 100 });

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            Audit log
          </h1>
          <p className="mt-3 text-sm text-foreground/50">All activity on your account.</p>
        </div>
        <Link className="ghost-button" href="/settings/account">
          Account
        </Link>
      </header>

      <section className="card flat">
        {!eventsResult.ok && <p className="muted">Could not load audit events.</p>}
        {eventsResult.ok && eventsResult.body.events.length === 0 && (
          <p className="muted">No audit events yet.</p>
        )}
        {eventsResult.ok && eventsResult.body.events.length > 0 && (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Artifact</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {eventsResult.body.events.map((event) => (
                <tr key={event.id}>
                  <td className="small muted">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="small"><code>{event.action}</code></td>
                  <td className="small muted">{event.artifactId ? event.artifactId.slice(0, 8) : "not linked"}</td>
                  <td className="small muted">{event.actorPrincipalType}:{event.actorPrincipalId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
