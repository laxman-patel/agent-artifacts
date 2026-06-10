import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BillingPortalButton } from "../../components/billing-actions";
import { cookieHeader, fetchBillingMe } from "../../../lib/server-api";

export default async function BillingSettingsPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const billing = await fetchBillingMe(header);

  if (!billing.ok && (billing.status === 401 || billing.status === 403)) {
    redirect("/login?next=/settings/billing");
  }
  if (!billing.ok) {
    throw new Error(billing.message);
  }

  const { plan, account, usage } = billing.body;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            Plan & billing
          </h1>
          <p className="mt-3 text-sm text-foreground/50">
            {account ? `Subscription status: ${account.status}` : "Free plan with hard limits and no overage billing."}
          </p>
          <p className="mt-2 font-mono text-[12px] text-[var(--wb-accent-orange)]">{plan.displayName}</p>
        </div>
        <div className="row-actions">
          <Link className="ghost-button" href="/pricing">
            View plans
          </Link>
          {account ? <BillingPortalButton /> : null}
        </div>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Included usage</h2>
          <p className="muted">These are enforced server-side across web, API, CLI, and MCP.</p>
        </div>
        <div className="usage-grid">
          <UsageTile label="Projects" value={String(usage.projects)} limit={formatLimit(plan.entitlements.maxProjects)} />
          <UsageTile label="Artifacts" value={String(usage.activeArtifacts)} limit={formatLimit(plan.entitlements.maxActiveArtifacts)} />
          <UsageTile label="Storage" value={formatBytes(usage.storageBytes)} limit={formatBytes(plan.entitlements.includedStorageBytes)} />
          <UsageTile
            label="Version writes"
            value={String(usage.versionWritesThisMonth)}
            limit={String(plan.entitlements.includedVersionWrites)}
          />
          <UsageTile
            label="Delivery"
            value={formatBytes(usage.deliveryBytesThisMonth)}
            limit={plan.entitlements.includedDeliveryBytes ? formatBytes(plan.entitlements.includedDeliveryBytes) : "Hard-capped by abuse controls"}
          />
          <UsageTile label="Max version size" value={formatBytes(plan.entitlements.maxContentBytes)} limit="Per version" />
        </div>
      </section>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Feature access</h2>
          <p className="muted">Plan gates are enforced server-side across every client.</p>
        </div>
        <ul className="feature-list">
          <li>{plan.entitlements.privateArtifacts ? "Private artifacts enabled" : "Private artifacts require Pro"}</li>
          <li>{plan.entitlements.emailAllowlist ? "Email allowlists enabled" : "Email allowlists require Pro"}</li>
          <li>{plan.entitlements.shareLinks ? "Share links enabled" : "Share links require Pro"}</li>
          <li>{plan.entitlements.overageBilling ? "Overage billing enabled after included usage" : "No overage billing on Builder"}</li>
        </ul>
      </section>
    </main>
  );
}

function UsageTile({ label, value, limit }: { label: string; value: string; limit: string }) {
  return (
    <div className="usage-tile">
      <strong>{label}</strong>
      <span>{value}</span>
      <span className="muted small">Limit: {limit}</span>
    </div>
  );
}

function formatLimit(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MiB`;
  return `${bytes} bytes`;
}
