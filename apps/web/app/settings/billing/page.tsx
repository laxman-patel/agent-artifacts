import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { BillingPortalButton } from "../../components/billing-actions";
import { cookieHeader, fetchBillingMe } from "../../../lib/server-api";
import { SettingsHeader, SettingsPanel } from "../components/settings-chrome";

type MeterState = "normal" | "warn" | "over";

type Meter = {
  label: string;
  valueLabel: string;
  limitLabel?: string;
  pct: number | null;
  state: MeterState;
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

function meterState(pct: number | null): MeterState {
  if (pct === null) return "normal";
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "normal";
}

function bounded(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

const BAR_COLORS: Record<MeterState, string> = {
  normal: "oklch(1 0 0 / 0.34)",
  warn: "var(--wb-accent-orange)",
  over: "oklch(0.68 0.09 15)"
};

function UsageMeter({ meter }: { meter: Meter }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13px] text-foreground/70">{meter.label}</span>
        <span className="font-mono text-[12px] text-foreground/45">
          <span className="tabular-nums text-foreground/85">{meter.valueLabel}</span>
          {meter.limitLabel ? <> / {meter.limitLabel}</> : null}
        </span>
      </div>
      {meter.pct !== null ? (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[oklch(1_0_0/0.06)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(meter.pct, 1.5)}%`, backgroundColor: BAR_COLORS[meter.state] }}
          />
        </div>
      ) : null}
    </div>
  );
}

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
  const ent = plan.entitlements;
  const priceLabel = plan.monthlyPriceUsd === 0 ? "Free" : `$${plan.monthlyPriceUsd}/mo`;

  const projectsPct = ent.maxProjects === null ? null : bounded(usage.projects, ent.maxProjects);
  const artifactsPct = ent.maxActiveArtifacts === null ? null : bounded(usage.activeArtifacts, ent.maxActiveArtifacts);
  const storagePct = bounded(usage.storageBytes, ent.includedStorageBytes);
  const versionsPct = bounded(usage.versionWritesThisMonth, ent.includedVersionWrites);
  const deliveryPct = ent.includedDeliveryBytes > 0 ? bounded(usage.deliveryBytesThisMonth, ent.includedDeliveryBytes) : null;

  const meters: Meter[] = [
    {
      label: "Projects",
      valueLabel: String(usage.projects),
      limitLabel: ent.maxProjects === null ? "Unlimited" : String(ent.maxProjects),
      pct: projectsPct,
      state: meterState(projectsPct)
    },
    {
      label: "Active artifacts",
      valueLabel: String(usage.activeArtifacts),
      limitLabel: ent.maxActiveArtifacts === null ? "Unlimited" : String(ent.maxActiveArtifacts),
      pct: artifactsPct,
      state: meterState(artifactsPct)
    },
    {
      label: "Storage",
      valueLabel: formatBytes(usage.storageBytes),
      limitLabel: formatBytes(ent.includedStorageBytes),
      pct: storagePct,
      state: meterState(storagePct)
    },
    {
      label: "Version writes this month",
      valueLabel: String(usage.versionWritesThisMonth),
      limitLabel: String(ent.includedVersionWrites),
      pct: versionsPct,
      state: meterState(versionsPct)
    },
    {
      label: "Delivery this month",
      valueLabel: formatBytes(usage.deliveryBytesThisMonth),
      limitLabel: ent.includedDeliveryBytes > 0 ? formatBytes(ent.includedDeliveryBytes) : "Not included",
      pct: deliveryPct,
      state: meterState(deliveryPct)
    },
    {
      label: "Max version size",
      valueLabel: formatBytes(ent.maxContentBytes),
      pct: null,
      state: "normal"
    }
  ];

  const features = [
    { label: "Private artifacts", on: ent.privateArtifacts },
    { label: "Email allowlists", on: ent.emailAllowlist },
    { label: "Share links", on: ent.shareLinks },
    { label: "Overage billing past included usage", on: ent.overageBilling }
  ];

  return (
    <>
      <SettingsHeader
        title="Plan & billing"
        description="Usage limits are enforced server-side across web, API, CLI, and MCP."
      />

      <SettingsPanel className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-pixel text-[1.4rem] leading-none tracking-[-0.04em] text-foreground/95">{plan.displayName}</span>
              {account ? <StatusBadge status={account.status} /> : <PlanBadge label="Current plan" />}
            </div>
            <p className="mt-2 text-[13px] text-foreground/50">
              {priceLabel}
              {account?.currentPeriodEnd ? ` · Renews ${formatDate(account.currentPeriodEnd)}` : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {account ? (
              <>
                <Link className="ghost-button" href="/pricing">
                  View plans
                </Link>
                <BillingPortalButton />
              </>
            ) : (
              <Link className="primary-button" href="/pricing">
                Upgrade plan
              </Link>
            )}
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Usage" className="mb-4 overflow-hidden">
        <div className="divide-y divide-[var(--wb-line)]">
          {meters.map((meter) => (
            <UsageMeter key={meter.label} meter={meter} />
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Feature access" className="overflow-hidden">
        <div className="divide-y divide-[var(--wb-line)]">
          {features.map((feature) => (
            <div key={feature.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                {feature.on ? (
                  <Check className="size-4 shrink-0 text-[color-mix(in_oklch,var(--wb-accent-jsx)_75%,white)]" aria-hidden />
                ) : (
                  <Lock className="size-3.5 shrink-0 text-foreground/35" aria-hidden />
                )}
                <span className={cn("text-[13px]", feature.on ? "text-foreground/85" : "text-foreground/45")}>{feature.label}</span>
              </div>
              {feature.on ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground/35">Included</span>
              ) : (
                <PlanBadge label="Pro" />
              )}
            </div>
          ))}
        </div>
      </SettingsPanel>
    </>
  );
}

function PlanBadge({ label }: { label: string }) {
  return (
    <span className="rounded-[0.25rem] border border-[color-mix(in_oklch,var(--wb-accent-orange)_40%,var(--wb-line-strong))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--wb-accent-orange)]">
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "active" || normalized === "trialing"
      ? "text-[color-mix(in_oklch,var(--wb-accent-jsx)_72%,white)] border-[color-mix(in_oklch,var(--wb-accent-jsx)_38%,var(--wb-line-strong))]"
      : normalized === "past_due" || normalized === "unpaid" || normalized === "canceled"
        ? "text-[color-mix(in_oklch,oklch(0.68_0.09_15)_80%,white)] border-[color-mix(in_oklch,oklch(0.68_0.09_15)_42%,var(--wb-line-strong))]"
        : "text-foreground/55 border-[var(--wb-line-strong)]";
  const pretty = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={cn("rounded-[0.25rem] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]", tone)}>{pretty}</span>
  );
}
