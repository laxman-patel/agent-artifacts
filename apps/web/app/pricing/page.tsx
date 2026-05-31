import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PricingDitherShader } from "../components/pricing-dither-shader";

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
    price: "Free",
    cadence: "No card needed",
    summary: "Public artifact links for trying the workflow.",
    cta: "Start free",
    href: "/login?next=%2Fdashboard",
    featured: false,
    features: [
      "Public HTML, Markdown, and JSX artifacts",
      "3 projects and 25 active artifacts",
      "100 MiB stored history",
      "100 version writes each month"
    ],
    usage: null
  },
  {
    id: "pro",
    name: "Pro",
    price: "$3",
    cadence: "/month",
    summary: "Private sharing and higher limits for one builder.",
    cta: "Upgrade to Pro",
    href: "/login?next=%2Fpricing",
    featured: true,
    features: [
      "Everything in Builder is included",
      "Private artifacts",
      "Email allowlists and share links",
      "5 GiB history and 50 GiB delivery",
      "2,000 version writes each month"
    ],
    usage: [
      { label: "Storage", price: "$0.10", unit: "extra GB-mo" },
      { label: "Delivery", price: "$0.05", unit: "extra GB" },
      { label: "Writes", price: "$0.20", unit: "extra 1k writes" }
    ]
  },
  {
    id: "team",
    name: "Team",
    price: "$12",
    cadence: "/month",
    summary: "A shared workspace for artifacts that belong to the team.",
    cta: "Start Team",
    href: "/login?next=%2Fpricing",
    featured: false,
    features: [
      "Everything in Pro is included",
      "3 seats included, $3 per extra seat",
      "Workspace projects and member roles",
      "50 GiB history and 250 GiB delivery",
      "10,000 version writes each month"
    ],
    usage: null
  }
] as const;

export const metadata: Metadata = {
  title: "Pricing: Artifacts",
  description:
    "Artifacts pricing starts with a free Builder plan, then adds Pro for private sharing and Team for shared workspaces."
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
        <Link href="/" className="flex items-center gap-2 px-4 text-foreground sm:px-8" aria-label="Artifacts home">
          <img src={logoPath} alt="" className="size-[18px] opacity-95" />
          <span className="font-mono text-[13px] font-semibold uppercase leading-none tracking-[0.045em] text-foreground/92">ARTIFACTS</span>
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
        "relative flex min-h-[36rem] flex-col overflow-hidden rounded-[10px] border bg-card px-5 py-6",
        plan.featured
          ? "relative -translate-y-1 border-foreground/35 bg-foreground/[0.035] shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)] ring-1 ring-foreground/10"
          : "border-foreground/[0.08]"
      )}
    >
      {plan.featured ? <PricingDitherShader /> : null}
      <div className="relative z-10 flex h-full flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-pixel text-[1.35rem] font-normal tracking-[-0.04em] text-foreground/92">{plan.name}</h2>
        </div>

        <p className="mt-3 min-h-10 text-[13px] leading-6 text-foreground/48">{plan.summary}</p>

        <div className="mt-6 flex items-end gap-2 border-b border-foreground/[0.08] pb-5">
          <span className="font-pixel text-[2.45rem] font-normal leading-none tracking-[-0.05em] text-foreground/95">{plan.price}</span>
          <span className="pb-1.5 text-[13px] text-foreground/42">{plan.cadence}</span>
        </div>

        <ul className="mt-5 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-[13px] leading-6 text-foreground/58">
              <i className="font-pixel mt-[0.15rem] shrink-0 text-sm not-italic leading-6 text-foreground/62" aria-hidden>
                ✓
              </i>
              {feature}
            </li>
          ))}
        </ul>

        {plan.usage ? (
          <div className="mt-7">
            <div className="mb-5 flex items-center justify-center gap-3">
              <span className="h-px w-8 bg-foreground/[0.07]" aria-hidden />
              <span className="text-center text-[12px] leading-5 text-foreground/42">Overage rates</span>
              <span className="h-px w-8 bg-foreground/[0.07]" aria-hidden />
            </div>
            <div className="grid grid-cols-3 gap-0">
              {plan.usage.map((meter, index) => (
                <div
                  key={meter.label}
                  className={cn(
                    "relative min-w-0 px-3 first:pl-0 last:pr-0",
                    index < plan.usage.length - 1 &&
                      "after:absolute after:right-0 after:top-1/2 after:h-8 after:w-px after:-translate-y-1/2 after:bg-foreground/[0.08]"
                  )}
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-foreground/30">{meter.label}</div>
                  <div className="mt-2 font-pixel text-[1.15rem] leading-none tracking-[-0.04em] text-foreground/88">{meter.price}</div>
                  <div className="mt-1.5 text-[10px] leading-4 text-foreground/38">per {meter.unit}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-8">
          <Link
            href={plan.href}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-sm px-4 py-2.5 text-sm font-medium transition-colors",
              plan.featured
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "border border-foreground/[0.12] text-foreground/72 hover:border-foreground/[0.22] hover:bg-foreground/[0.03] hover:text-foreground"
            )}
          >
            {plan.cta}
          </Link>
        </div>
      </div>
    </article>
  );
}

function PricingFooter() {
  return (
    <footer className="relative mx-auto flex w-[calc(100%-1rem)] max-w-[76rem] flex-col gap-4 border-x border-t border-border px-5 py-8 text-xs text-foreground/35 sm:w-[calc(100%-2rem)] sm:px-8 md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] lg:flex-row lg:items-center lg:justify-between xl:w-full">
      <div className="flex flex-wrap items-center gap-4">
        <img src={logoPath} alt="Artifacts" className="size-[18px] opacity-75" />
        <Link href="/" className="transition-colors hover:text-foreground/70">Home</Link>
        <Link href="/#how" className="transition-colors hover:text-foreground/70">How it works</Link>
        <Link href="/#features" className="transition-colors hover:text-foreground/70">Features</Link>
        <Link href="/pricing" className="transition-colors hover:text-foreground/70">Pricing</Link>
      </div>
      <div className="font-mono">© 2026 Artifacts · built for humans and agents</div>
    </footer>
  );
}

export default function PricingPage() {
  return (
    <main id="pricing" className="marketing dark flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
        Skip to content
      </a>
      <PricingNav />

      <SectionShell id="content" last className="flex-1" contentClassName="pb-14 pt-20 sm:pt-24 lg:pb-16 lg:pt-28">
        <div className="mb-8 max-w-2xl lg:mb-10">
          <h1 className="font-pixel !m-0 max-w-2xl !text-3xl !font-normal !leading-tight !tracking-tight text-foreground/95 md:!text-3xl lg:!text-[2.5rem]">
            Simple pricing for artifact hosting
          </h1>
          <p className="mt-4 max-w-2xl text-[12px] leading-5 text-foreground/48 sm:text-[13px]">
            Start free. Upgrade for privacy, higher limits, or a team workspace.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

      </SectionShell>

      <PricingFooter />
    </main>
  );
}
