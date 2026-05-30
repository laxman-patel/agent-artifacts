import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Braces, Code2, FileCode2, GitBranch, Globe2, LockKeyhole, PackageCheck, ShieldCheck, Terminal } from "lucide-react";

import { CommandCopyButton } from "./components/command-copy-button";
import { cn } from "@/lib/utils";

const setupCommand = "npx agent-artifacts@latest setup";
const logoPath = "/brand/artifacts-logo.svg";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const navItems = [
  { label: "docs", href: "#how", active: true },
  { label: "pricing", href: "#final-cta" },
  { label: "github", href: "https://github.com" }
];

const features: { icon: IconComponent; title: string; description: string }[] = [
  {
    icon: Globe2,
    title: "Real URLs",
    description: "Return one stable link from every agent run. No temp paths, uploads, or lost chat attachments."
  },
  {
    icon: GitBranch,
    title: "Version history",
    description: "Every update becomes an immutable snapshot you can compare, restore, or pin for review."
  },
  {
    icon: ShieldCheck,
    title: "Safe rendering",
    description: "Preview HTML, Markdown, and JSX through controlled viewers built for untrusted generated content."
  },
  {
    icon: LockKeyhole,
    title: "Access control",
    description: "Share publicly, privately, by allowlist, or by scoped link without changing the artifact URL."
  },
  {
    icon: PackageCheck,
    title: "Agent-ready API",
    description: "Create and update artifacts from CLI, REST, or MCP with the same object model humans use."
  },
  {
    icon: Code2,
    title: "Team ownership",
    description: "Move useful outputs from personal experiments into workspaces when they become shared context."
  }
];

const artifactKinds: {
  variant: "exploration" | "plan" | "review" | "report" | "explainer" | "editor";
  title: string;
  description: string;
}[] = [
  {
    variant: "exploration",
    title: "Exploration grids",
    description: "Compare directions side by side, then point at the one worth expanding."
  },
  {
    variant: "plan",
    title: "Implementation plans",
    description: "Turn a long plan into milestones, data flows, snippets, and review checkpoints."
  },
  {
    variant: "review",
    title: "PR review surfaces",
    description: "Group diffs by risk, annotate the important paths, and guide the reviewer’s attention."
  },
  {
    variant: "report",
    title: "Research reports",
    description: "Synthesize Slack, Git history, docs, and issues into a page people will actually read."
  },
  {
    variant: "explainer",
    title: "Interactive explainers",
    description: "Use diagrams, tabs, sliders, and toggles when text alone would bury the point."
  },
  {
    variant: "editor",
    title: "Throwaway editors",
    description: "Build one-use interfaces for shaping JSON, CSV, prompts, or configuration by hand."
  }
];

const quoteNotes = [
  {
    person: "Thariq",
    avatar: "T",
    note: "HTML is the new Markdown."
  },
  {
    person: "Karpathy",
    avatar: "K",
    note: "Vision, images, animations, and video, are the preferred output from AI."
  },
  {
    person: "Theo",
    avatar: "T",
    note: "There is evidently an opportunity for a microservice for this."
  },
  {
    person: "Anthropic",
    avatar: "A",
    note: "Each file trades a document you would skim for one you would actually read."
  }
];

const workflow = [
  {
    step: "01",
    title: "Agent writes the output",
    description: "A report, prototype, review surface, spec, or one-off tool lands in the workspace."
  },
  {
    step: "02",
    title: "Artifacts stores it",
    description: "Content goes to object storage, metadata goes to Postgres, and a stable URL comes back."
  },
  {
    step: "03",
    title: "Teams review safely",
    description: "Open the preview, inspect versions, manage access, and share without losing context."
  }
];

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
      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-border" />
      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-border" />
      {!last ? (
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2 bg-border" />
      ) : null}
      <div className={cn("px-5 py-10 sm:px-8 sm:py-12 lg:p-12", contentClassName)}>{children}</div>
    </section>
  );
}

function MarketingNav() {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="relative mx-auto flex h-[45px] w-[calc(100%-1rem)] max-w-[76rem] items-stretch justify-between border-x border-border sm:w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] xl:w-full">
        <Link href="#readme" className="flex items-center gap-1.5 px-4 text-sm font-semibold text-foreground sm:px-8">
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

function CodeLine({ n, children }: { n: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2ch_1fr] gap-4 font-mono text-[12px] leading-6 sm:text-[13px]">
      <span className="select-none text-right text-foreground/25">{n}</span>
      <span className="min-w-0 whitespace-pre text-foreground/80">{children}</span>
    </div>
  );
}

function HeroCodePanel() {
  return (
    <div className="w-full max-w-full rounded-[10px] border border-border p-1 shadow-2xl shadow-black/30 lg:max-w-[37rem]">
      <div className="overflow-hidden rounded-md border border-foreground/[0.1] bg-card">
        <div className="flex items-center border-b border-foreground/[0.08]">
          <div className="border-r border-foreground/[0.08] px-4 py-2 text-xs text-foreground/85">artifact.ts</div>
          <div className="px-4 py-2 text-xs text-foreground/35">mcp.json</div>
          <div className="ml-auto hidden items-center gap-1 px-3 text-[11px] text-foreground/35 sm:flex">
            <Terminal className="size-3" aria-hidden />
            create
          </div>
        </div>
        <div className="bg-[radial-gradient(circle_at_80%_0%,oklch(0.985_0_0/0.04),transparent_36%),linear-gradient(180deg,oklch(1_0_0/0.02),transparent)] px-3 py-4 sm:px-4">
          <CodeLine n="1">
            <span className="text-violet-400">import</span> {" { artifacts } "}
            <span className="text-violet-400">from</span> <span className="text-emerald-300">"agent-artifacts"</span>
          </CodeLine>
          <CodeLine n="2"> </CodeLine>
          <CodeLine n="3">
            <span className="text-violet-400">const</span> artifact = <span className="text-violet-400">await</span> artifacts.create({"{"}
          </CodeLine>
          <CodeLine n="4">
            {"  "}title: <span className="text-emerald-300">"Quarterly model eval"</span>,
          </CodeLine>
          <CodeLine n="5">
            {"  "}type: <span className="text-emerald-300">"html"</span>,
          </CodeLine>
          <CodeLine n="6">
            {"  "}file: <span className="text-emerald-300">"./out/eval-report.html"</span>,
          </CodeLine>
          <CodeLine n="7">
            {"  "}access: {"{ "}view: <span className="text-emerald-300">"workspace"</span>{" }"},
          </CodeLine>
          <CodeLine n="8">{"})"}</CodeLine>
          <CodeLine n="9">
            <span className="text-sky-300">console</span>.log(artifact.url)
          </CodeLine>
        </div>
        <div className="flex items-center justify-between border-t border-foreground/[0.08] px-4 py-3 text-xs">
          <code className="font-mono text-foreground/65">https://agent-artifacts.com/you/eval-report</code>
          <span className="rounded-sm border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-emerald-300">live</span>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  className
}: {
  icon: IconComponent;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("group rounded-[10px] border border-foreground/[0.08] p-1 transition-colors hover:border-foreground/[0.14]", className)}>
      <div className="flex min-h-[10.25rem] flex-col gap-4 rounded-md border border-foreground/[0.06] p-5 transition-colors group-hover:border-foreground/[0.1] group-hover:bg-foreground/[0.015]">
        <Icon className="size-5 text-foreground/40 transition-colors group-hover:text-foreground/60" aria-hidden />
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
          <p className="max-w-[52ch] text-sm leading-relaxed text-foreground/45">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ArtifactPreview({ variant }: { variant: (typeof artifactKinds)[number]["variant"] }) {
  if (variant === "exploration") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {["A", "B", "C"].map((item) => (
          <div key={item} className="rounded-sm border border-foreground/[0.08] bg-background/70 p-2">
            <div className="mb-2 font-mono text-[10px] text-foreground/35">Option {item}</div>
            <div className="h-10 rounded-sm bg-foreground/[0.05]" />
            <div className="mt-2 h-1.5 w-3/4 rounded-full bg-foreground/10" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "plan") {
    return (
      <div className="space-y-2">
        {["Schema", "Renderer", "Sharing"].map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-sm border border-foreground/[0.08] bg-background/70 p-2">
            <span className="font-mono text-[10px] text-foreground/30">0{index + 1}</span>
            <span className="h-1.5 flex-1 rounded-full bg-foreground/10" />
            <span className="font-mono text-[10px] text-foreground/35">{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "review") {
    return (
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
        <div className="space-y-2 rounded-sm border border-foreground/[0.08] bg-background/70 p-2">
          <div className="h-1.5 rounded-full bg-red-400/45" />
          <div className="h-1.5 w-5/6 rounded-full bg-amber-400/35" />
          <div className="h-1.5 w-2/3 rounded-full bg-emerald-400/30" />
        </div>
        <div className="rounded-sm border border-foreground/[0.08] bg-background/70 p-2 font-mono text-[10px] leading-4 text-foreground/35">
          <div>+ stream.flush()</div>
          <div>- buffer.wait()</div>
          <div className="text-amber-300/70">! backpressure</div>
        </div>
      </div>
    );
  }

  if (variant === "report") {
    return (
      <div className="rounded-sm border border-foreground/[0.08] bg-background/70 p-3">
        <div className="mb-3 h-2 w-32 rounded-full bg-foreground/15" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-12 rounded-sm bg-foreground/[0.05]" />
          <div className="h-12 rounded-sm bg-foreground/[0.05]" />
          <div className="h-12 rounded-sm bg-foreground/[0.05]" />
        </div>
      </div>
    );
  }

  if (variant === "explainer") {
    return (
      <div className="rounded-sm border border-foreground/[0.08] bg-background/70 p-3">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-foreground/35">
          <span>token bucket</span>
          <span>42%</span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/10">
          <div className="h-1.5 w-5/12 rounded-full bg-sky-300/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-foreground/[0.08] bg-background/70 p-3">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="h-8 rounded-sm border border-foreground/[0.08] bg-foreground/[0.04]" />
        <div className="h-8 rounded-sm border border-foreground/[0.08] bg-foreground/[0.04]" />
        <div className="h-8 rounded-sm border border-foreground/[0.08] bg-foreground/[0.04]" />
      </div>
      <div className="flex justify-end">
        <span className="rounded-sm border border-foreground/[0.08] px-2 py-1 font-mono text-[10px] text-foreground/35">copy JSON</span>
      </div>
    </div>
  );
}

function DemoPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <div className="rounded-[10px] border border-border p-1">
        <div className="overflow-hidden rounded-md border border-foreground/[0.1] bg-card">
          <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-4 py-3">
            <span className="size-2 rounded-full bg-red-400/70" />
            <span className="size-2 rounded-full bg-amber-400/70" />
            <span className="size-2 rounded-full bg-emerald-400/70" />
            <div className="ml-3 flex-1 rounded-sm border border-foreground/[0.06] bg-foreground/[0.03] py-1 text-center font-mono text-[11px] text-foreground/35">
              agent-artifacts.com/you/model-eval
            </div>
          </div>
          <div className="grid min-h-[23rem] grid-cols-1 sm:grid-cols-[14rem_1fr]">
            <aside className="border-b border-foreground/[0.08] p-4 sm:border-b-0 sm:border-r">
              <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/35">Artifacts</div>
              <div className="space-y-2">
                {[
                  ["Model eval", "HTML · v7"],
                  ["PR review", "Markdown · v3"],
                  ["Pricing prototype", "JSX · v12"]
                ].map(([title, meta], index) => (
                  <div
                    key={title}
                    className={cn(
                      "rounded-md border p-3",
                      index === 0
                        ? "border-foreground/[0.14] bg-foreground/[0.04]"
                        : "border-foreground/[0.06] bg-transparent"
                    )}
                  >
                    <div className="text-sm font-medium text-foreground/85">{title}</div>
                    <div className="mt-1 font-mono text-[11px] text-foreground/35">{meta}</div>
                  </div>
                ))}
              </div>
            </aside>
            <div className="p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground/90">Quarterly model eval</div>
                  <div className="mt-1 font-mono text-[11px] text-foreground/35">current · version 7 · private workspace</div>
                </div>
                <span className="rounded-sm border border-border bg-foreground/[0.03] px-2 py-1 text-xs text-foreground/60">Share</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Accuracy", "94.2%"],
                  ["Regressions", "3"],
                  ["Last run", "14m"]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-foreground/[0.07] bg-foreground/[0.02] p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-foreground/35">{label}</div>
                    <div className="mt-2 text-lg font-semibold text-foreground/90">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-foreground/[0.07] bg-background/60 p-4">
                <div className="mb-3 h-2 w-28 rounded-full bg-foreground/15" />
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-foreground/10" />
                  <div className="h-2 w-11/12 rounded-full bg-foreground/10" />
                  <div className="h-2 w-8/12 rounded-full bg-foreground/10" />
                </div>
                <div className="mt-5 h-28 rounded-md border border-dashed border-foreground/[0.1] bg-[linear-gradient(135deg,oklch(0.985_0_0/0.06),transparent)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-border p-1">
        <div className="h-full rounded-md border border-foreground/[0.1] bg-card p-4">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/35">Behind the URL</div>
          <div className="space-y-3">
            {[
              ["mcp.create_artifact", "Stored content hash · rendered preview"],
              ["policy.check", "workspace member allowed"],
              ["versions.append", "v7 created from v6"],
              ["audit.write", "agent updated artifact"]
            ].map(([title, description]) => (
              <div key={title} className="rounded-md border border-foreground/[0.07] bg-background/70 p-3">
                <code className="font-mono text-[11px] text-amber-300">{title}</code>
                <div className="mt-1 text-xs leading-relaxed text-foreground/45">{description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main id="readme" className="marketing dark min-h-dvh overflow-hidden bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
        Skip to content
      </a>
      <MarketingNav />

      <SectionShell id="content" contentClassName="pb-16 pt-14 sm:pt-16 lg:pb-20 lg:pt-32">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:basis-[45%]">
            <h1 className="font-pixel !m-0 max-w-2xl !text-3xl !font-normal !leading-tight !tracking-tight text-foreground/95 md:!text-3xl lg:!text-[2.5rem]">
              Every artifact your <br />
              agent creates has a home.
            </h1>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-foreground/50 sm:text-sm">
              Publish HTML reports, Markdown specs, JSX prototypes, PR writeups, and one-off tools with permanent URLs,
              immutable versions, access control, and MCP-native automation.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <CommandCopyButton command={setupCommand} />
              <Link href="/cli/login" className="inline-flex items-center gap-1 text-sm text-foreground/45 underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground/75">
                ...or connect with MCP <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
          <div className="flex w-full justify-center lg:basis-[55%] lg:justify-end">
            <HeroCodePanel />
          </div>
        </div>
      </SectionShell>

      <SectionShell id="how">
        <div className="mb-8 max-w-2xl space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">How it works</h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            Your agent writes the artifact. Artifacts stores it, returns a URL, versions every update, and keeps the
            same access checks across humans, agents, API keys, and MCP.
          </p>
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {workflow.map((item) => (
            <div key={item.step} className="rounded-[10px] border border-foreground/[0.08] p-1">
              <div className="h-full rounded-md border border-foreground/[0.06] p-5">
                <div className="font-mono text-[11px] text-foreground/35">{item.step}</div>
                <h3 className="font-pixel mt-4 text-base font-normal tracking-[-0.03em] text-foreground/90">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/45">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
        <DemoPanel />
      </SectionShell>

      <SectionShell id="features">
        <div className="mb-8 max-w-lg space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">Features</h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            Everything generated work needs after the model is done writing it.
          </p>
        </div>
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </SectionShell>

      <SectionShell id="create">
        <div className="mb-8 max-w-xl space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">
            Outputs worth keeping
          </h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            Agents already make finished surfaces. Artifacts gives those surfaces somewhere to live after the task ends.
          </p>
        </div>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artifactKinds.map((kind) => (
            <article key={kind.title} className="flex h-full flex-col rounded-[10px] border border-foreground/[0.08] p-4 transition-colors hover:border-foreground/[0.14]">
              <div className="mb-5 flex h-[8.25rem] items-center rounded-md border border-foreground/[0.06] bg-card p-3">
                <div className="w-full">
                  <ArtifactPreview variant={kind.variant} />
                </div>
              </div>
              <div className="min-h-[7.25rem]">
                <h3 className="text-sm font-semibold text-foreground/90">{kind.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/45">{kind.description}</p>
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell id="quotes">
        <div className="mb-8 max-w-xl space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">Why this now</h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            The web is becoming a better output surface for agents. Drop sourced pull quotes here before launch.
          </p>
        </div>
        <div className="relative -mx-5 py-2 sm:-mx-8 lg:-mx-12">
          <div className="quote-fade overflow-hidden">
            <div className="quote-marquee flex w-max gap-12">
              {[...quoteNotes, ...quoteNotes].map((quote, index) => (
                <figure key={`${quote.person}-${index}`} className="flex w-[26rem] shrink-0 items-start gap-3 py-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full border border-foreground/[0.08] bg-card font-mono text-[11px] text-foreground/55">
                    {quote.avatar}
                  </div>
                  <div>
                    <blockquote className="text-base italic leading-relaxed text-foreground/62">
                      <q>{quote.note}</q>
                    </blockquote>
                    <figcaption className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground/35">
                      {quote.person}
                    </figcaption>
                  </div>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </SectionShell>

      <SectionShell id="final-cta" last contentClassName="py-16 sm:py-20 lg:py-24">
        <div className="flex flex-col items-center gap-5 text-center">
          <img src={logoPath} alt="" className="size-7 opacity-90" />
          <h2 className="font-pixel max-w-xl text-3xl font-normal tracking-[-0.045em] text-foreground/90 sm:text-4xl">
            Give the next agent output a durable URL.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-foreground/45 sm:text-base">
            One setup command, then your reports, prototypes, specs, and tools have somewhere to live.
          </p>
          <div className="flex flex-col items-center gap-3">
            <CommandCopyButton command={setupCommand} />
            <Link href="/cli/login" className="inline-flex items-center gap-1 text-sm text-foreground/45 underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground/75">
              ...or connect with MCP <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </SectionShell>

      <footer className="relative mx-auto flex w-[calc(100%-1rem)] max-w-[76rem] flex-col gap-4 border-x border-t border-border px-5 py-8 text-xs text-foreground/35 sm:w-[calc(100%-2rem)] sm:px-8 md:w-[calc(100%-3rem)] lg:w-[calc(100%-4rem)] lg:flex-row lg:items-center lg:justify-between xl:w-full">
        <div className="flex flex-wrap items-center gap-4">
          <img src={logoPath} alt="Artifacts" className="size-5 opacity-75" />
          <Link href="#readme" className="transition-colors hover:text-foreground/70">Docs</Link>
          <Link href="#how" className="transition-colors hover:text-foreground/70">How it works</Link>
          <Link href="#features" className="transition-colors hover:text-foreground/70">Features</Link>
          <Link href="#create" className="transition-colors hover:text-foreground/70">Create</Link>
        </div>
        <div className="font-mono">© 2026 Artifacts · built for humans and agents</div>
      </footer>
    </main>
  );
}
