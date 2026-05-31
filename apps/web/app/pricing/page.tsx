import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const logoPath = "/brand/artifacts-logo.svg";

const navItems = [
  { label: "docs", href: "/#how" },
  { label: "pricing", href: "/pricing", active: true },
  { label: "github", href: "https://github.com" }
];

const plans = [
  {
    id: "builder",
    name: "Builder",
    marker: "plan.builder",
    price: "Free",
    cadence: "No card needed",
    summary: "For publishing public agent outputs with durable URLs and enough history to try the workflow.",
    cta: "Start with Builder",
    href: "/login?next=%2Fdashboard",
    featured: false,
    limits: [
      { label: "Projects", value: "3" },
      { label: "Active public artifacts", value: "25" },
      { label: "Stored history", value: "100 MiB" },
      { label: "Version writes", value: "100/mo" }
    ],
    features: [
      "Public artifact hosting",
      "Stable URLs for HTML, Markdown, and JSX outputs",
      "Basic CLI and MCP usage",
      "Capped usage with no overages"
    ],
    note: "Best first step for demos, public reports, and scratch artifacts."
  },
  {
    id: "pro",
    name: "Pro",
    marker: "plan.pro",
    price: "$3",
    cadence: "per month",
    summary: "For solo builders who need private artifacts, longer history, and higher automation limits.",
    cta: "Upgrade to Pro",
    href: "/login?next=%2Fpricing",
    featured: true,
    limits: [
      { label: "Projects", value: "Unlimited" },
      { label: "Active artifacts", value: "Unlimited" },
      { label: "Stored history", value: "5 GiB" },
      { label: "Version writes", value: "2,000/mo" }
    ],
    features: [
      "Private artifacts and controlled sharing",
      "Email allowlists and scoped share links",
      "Public edit links when collaboration is intentional",
      "50 GiB delivery included each month",
      "365 days of version history and 90 days of audit events"
    ],
    note: "The default for private PR reports, specs, prototypes, and client review links."
  },
  {
    id: "team",
    name: "Team",
    marker: "plan.team",
    price: "$12",
    cadence: "per month",
    summary: "For shared workspaces where useful outputs become team context instead of personal files.",
    cta: "Start Team",
    href: "/login?next=%2Fpricing",
    featured: false,
    limits: [
      { label: "Included seats", value: "3" },
      { label: "Extra seats", value: "$3" },
      { label: "Stored history", value: "50 GiB" },
      { label: "Version writes", value: "10,000/mo" }
    ],
    features: [
      "Team workspace namespace and shared projects",
      "Member invitations, roles, and billing admin access",
      "Workspace audit events for artifact activity",
      "250 GiB delivery included each month",
      "365 days of version history and audit retention"
    ],
    note: "Use it when artifacts need a workspace owner, not one person's account."
  }
] as const;

export const metadata: Metadata = {
  title: "Pricing: Artifacts",
  description:
    "Compare Artifacts plans for public agent outputs, private artifact sharing, and team workspaces. Builder is free, Pro is $3/month, and Team is $12/month."
};

function SectionShell({
  id,
  children,
  className,
  contentClassName,
  last = false
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  last?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative mx-auto w-[calc(100%-1rem)] max-w-[76rem] sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full",
        className
      )}
    >
      <div className="pointer-events-none absolute left-0 top-0 z-30 h-full w-px bg-border" />
      <div className="pointer-events-none absolute right-0 top-0 z-30 h-full w-px bg-border" />
      {!last ? (
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-px w-screen -translate-x-1/2 bg-border" />
      ) : null}
      <div className={cn("relative z-10 px-5 py-10 sm:px-8 sm:py-12 lg:p-12", contentClassName)}>{children}</div>
    </section>
  );
}

function PricingNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[45px] w-[calc(100%-1rem)] max-w-[76rem] items-stretch justify-between border-x border-border sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full">
        <Link href="/" className="flex items-center gap-1.5 px-4 text-sm font-semibold text-foreground sm:px-8">
          <img src={logoPath} alt="" className="size-[22px] opacity-95" />
          <span className="text-[17px] font-semibold leading-none tracking-[-0.015em]">Artifacts</span>
        </Link>
        <nav className="hidden items-stretch border-x border-border md:flex" aria-label="Marketing sections">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center border-r border-border px-[1.375rem] text-xs font-medium uppercase tracking-wider transition-colors last:border-r-0",
                item.active
                  ? "border-b-2 border-b-foreground/60 bg-background text-foreground"
                  : "text-foreground/40 hover:bg-foreground/[0.03] hover:text-foreground/70"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center px-3 sm:px-6">
          <Link
            href="/login"
            className="rounded-sm bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}

function PlanCard({ plan }: { plan: (typeof plans)[number] }) {
  return (
    <article
      className={cn(
        "rounded-[10px] border border-foreground/[0.08] p-1",
        plan.featured ? "border-foreground/[0.18] bg-foreground/[0.025]" : "bg-card/50"
      )}
    >
      <div className="flex h-full flex-col rounded-md border border-foreground/[0.06] bg-background/35 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/35">{plan.marker}</div>
            <h2 className="font-pixel mt-3 text-2xl font-normal tracking-[-0.04em] text-foreground/92">{plan.name}</h2>
          </div>
          {plan.featured ? (
            <span className="rounded-sm border border-foreground/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/68">
              Solo default
            </span>
          ) : null}
        </div>

        <p className="mt-4 min-h-[4.5rem] text-sm leading-relaxed text-foreground/48">{plan.summary}</p>

        <div className="mt-6 border-y border-foreground/[0.08] py-5">
          <div className="flex items-end gap-2">
            <span className="font-pixel text-[2.45rem] font-normal leading-none tracking-[-0.05em] text-foreground/95">{plan.price}</span>
            <span className="pb-1.5 text-sm text-foreground/42">{plan.cadence}</span>
          </div>
        </div>

        <dl className="mt-5 space-y-2 border-y border-foreground/[0.08] py-4">
          {plan.limits.map((limit) => (
            <div key={limit.label} className="flex items-baseline justify-between gap-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/30">{limit.label}</dt>
              <dd className="text-sm font-medium text-foreground/82">{limit.value}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-5 space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/55">
              <i className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-foreground/45" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-foreground/[0.08] pt-4 text-sm leading-relaxed text-foreground/38">{plan.note}</p>

        <Link
          href={plan.href}
          className={cn(
            "mt-auto inline-flex items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium transition-colors",
            plan.featured
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-foreground/[0.12] text-foreground/72 hover:border-foreground/[0.22] hover:bg-foreground/[0.03] hover:text-foreground"
          )}
        >
          {plan.cta}
        </Link>
      </div>
    </article>
  );
}

export default function PricingPage() {
  return (
    <main id="pricing" className="marketing dark min-h-dvh overflow-hidden bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
        Skip to content
      </a>
      <PricingNav />

      <SectionShell id="content" last contentClassName="min-h-dvh pb-16 pt-16 sm:pt-20 lg:pb-24 lg:pt-24">
        <div className="mb-8 max-w-xl lg:mb-10">
          <h1 className="font-pixel !text-xl font-normal !leading-tight tracking-[-0.04em] text-foreground/90 sm:!text-2xl">
            Choose by access model
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/45 sm:text-base">
            The plan decision is mostly about who needs the artifact after the agent finishes writing it.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </SectionShell>
    </main>
  );
}
