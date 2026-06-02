import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { LockKeyhole, PackageCheck, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { BillingCheckoutButton } from "../components/billing-actions";
import { PricingDitherShader } from "../components/pricing-dither-shader";

const logoPath = "/brand/artifacts-logo.svg";

const navItems: { label: string; href: string; active?: boolean }[] = [
  { label: "pricing", href: "/pricing", active: true },
  { label: "docs", href: "/#how" },
  { label: "support", href: "mailto:support@agent-artifacts.com" }
];

const githubUrl = "https://github.com/laxman-patel/agent-artifacts";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.21-3.37-1.21-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.97c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.92v2.8c0 .27.18.59.69.49A10.15 10.15 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

type CtaIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const plans = [
  {
    id: "builder",
    name: "Builder",
    price: "Free",
    cadence: "No card needed",
    summary: "Public artifact links for trying the workflow.",
    cta: "Start free",
    ctaIcon: PackageCheck,
    href: "/login?next=%2Fdashboard",
    checkoutPlanId: null,
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
    ctaIcon: LockKeyhole,
    href: "/login?next=%2Fpricing",
    checkoutPlanId: "builder",
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
    ctaIcon: Users,
    href: "/login?next=%2Fpricing",
    checkoutPlanId: "studio",
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
  title: "Pricing",
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
                  ? "border-b-2 border-b-[#FF570A] bg-background text-foreground"
                  : "text-foreground/40 hover:bg-foreground/[0.03] hover:text-foreground/70"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-stretch">
          <Link
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Artifacts on GitHub"
            className="flex h-full items-center justify-center px-4 text-foreground/42 transition-colors hover:bg-foreground/[0.03] hover:text-foreground/72"
          >
            <GithubIcon className="size-[18px]" />
          </Link>
          <Link href="/login" className="group flex h-full items-center px-4 sm:pr-8" aria-label="Start using Artifacts for free">
            <span className="inline-grid grid-cols-[auto_auto] items-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-3 py-1.5 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18),0_8px_18px_oklch(0.08_0_0_/_0.18)] transition-colors group-hover:bg-[oklch(0.92_0_0)]">
              <span className="leading-none">Start for free</span>
              <span className="font-pixel text-[15px] leading-none text-[#FF570A]" aria-hidden>↗</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function PlanCard({ plan }: { plan: (typeof plans)[number] }) {
  const Icon = plan.ctaIcon as CtaIcon;

  return (
    <article
      className={cn(
        "relative flex min-h-[36rem] flex-col overflow-hidden rounded-[10px] border bg-card px-5 py-6",
        plan.featured
          ? "relative -translate-y-1 border-[#FF570A]/35 bg-foreground/[0.035] shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)] ring-1 ring-[#FF570A]/10"
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
                  <div className="mt-1.5 text-[10px] leading-4 text-foreground/38">/ {meter.unit}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-8">
          {plan.checkoutPlanId ? (
            <BillingCheckoutButton
              planId={plan.checkoutPlanId}
              wrapperClassName="w-full"
              className={cn(
                "inline-grid w-full grid-cols-[auto_auto] items-center justify-center gap-2 border border-foreground/20 px-4 py-2 font-pixel text-[13px] font-normal leading-none tracking-[-0.035em] shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.18)] transition-colors",
                plan.featured
                  ? "bg-[oklch(0.96_0_0)] text-primary-foreground hover:bg-[oklch(0.92_0_0)] disabled:cursor-wait disabled:opacity-70"
                  : "bg-transparent text-foreground/62 hover:border-foreground/30 hover:bg-[oklch(0.96_0_0)] hover:text-primary-foreground disabled:cursor-wait disabled:opacity-70"
              )}
              errorClassName="mt-2 text-center text-[12px] leading-5 text-red-300"
            >
              <span className="leading-none">{plan.cta}</span>
              <Icon className="size-3.5 text-[#FF570A]" aria-hidden />
            </BillingCheckoutButton>
          ) : (
            <Link href={plan.href} className="group flex w-full justify-center" aria-label={plan.cta}>
              <span
                className={cn(
                  "inline-grid w-full grid-cols-[auto_auto] items-center justify-center gap-2 border border-foreground/20 px-4 py-2 font-pixel text-[13px] font-normal leading-none tracking-[-0.035em] shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.18)] transition-colors",
                  "bg-transparent text-foreground/62 group-hover:border-foreground/30 group-hover:bg-[oklch(0.96_0_0)] group-hover:text-primary-foreground"
                )}
              >
                <span className="leading-none">{plan.cta}</span>
                <Icon className="size-3.5 text-[#FF570A]" aria-hidden />
              </span>
            </Link>
          )}
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
        <Link href="/pricing" className="transition-colors hover:text-foreground/70">Pricing</Link>
        <Link href="/#how" className="transition-colors hover:text-foreground/70">Docs</Link>
        <Link href="mailto:support@agent-artifacts.com" className="transition-colors hover:text-foreground/70">Support</Link>
        <Link href={githubUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/70">GitHub</Link>
      </div>
      <div className="font-mono">
        © 2026 Artifacts · by{" "}
        <Link href="https://laxman.me" target="_blank" rel="noopener noreferrer" className="text-foreground/50 underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground/75">
          Laxman Patel
        </Link>
      </div>
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
