import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieHeader, fetchAuditEvents, fetchProfileMe } from "../../../lib/server-api";
import { SettingsHeader, SettingsPanel } from "../components/settings-chrome";

export default async function GlobalAuditLogPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const me = await fetchProfileMe(header);
  if (!me.ok || !me.body) {
    redirect("/login?next=/settings/audit");
  }

  const eventsResult = await fetchAuditEvents(header, { limit: 100 });
  const events = eventsResult.ok ? eventsResult.body.events : [];

  return (
    <>
      <SettingsHeader title="Audit log" description="Recent activity recorded across your account." />

      <SettingsPanel className="overflow-hidden">
        {!eventsResult.ok ? (
          <p className="px-5 py-12 text-center text-[13px] text-foreground/45">Could not load audit events.</p>
        ) : events.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-foreground/45">No audit events yet.</p>
        ) : (
          <div className="wb-scroll overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--wb-line)] font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
                  <th className="px-5 py-2.5 font-medium">Time</th>
                  <th className="px-5 py-2.5 font-medium">Action</th>
                  <th className="px-5 py-2.5 font-medium">Artifact</th>
                  <th className="px-5 py-2.5 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-[var(--wb-line)] last:border-0">
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[12px] text-foreground/50">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5">
                      <code className="font-mono text-[12px] text-foreground/85">{event.action}</code>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[12px] text-foreground/45">
                      {event.artifactId ? event.artifactId.slice(0, 8) : "—"}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[12px] text-foreground/45">
                      {event.actorPrincipalType}:{event.actorPrincipalId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsPanel>
    </>
  );
}
