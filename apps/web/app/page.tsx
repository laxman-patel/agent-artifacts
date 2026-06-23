import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Code2, GitBranch, Globe2, LockKeyhole, PackageCheck, ShieldCheck } from "lucide-react";

import { CommandCopyButton } from "./components/command-copy-button";
import { HeroDitherShader } from "./components/hero-dither-shader";
import { HoverLipCard } from "./components/hover-lip-card";
import { MarketingNav } from "./components/marketing-chrome";
import { docsUrl } from "@/lib/site-metadata";
import { cn } from "@/lib/utils";

const setupCommand = "curl -fsSL https://hostartifacts.dev/install.sh | sh";
const logoPath = "/brand/artifacts-logo.svg";
const docsHref = docsUrl();

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const githubUrl = "https://github.com/laxman-patel/agent-artifacts";

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
    description: "Move useful outputs from personal experiments into teams when they become shared context."
  }
];

const artifactTones = {
  cyan: "oklch(0.72 0.08 215)",
  amber: "oklch(0.72 0.08 75)",
  rose: "oklch(0.68 0.09 15)",
  emerald: "oklch(0.7 0.08 155)"
} as const;

const artifactKinds: {
  variant: "exploration" | "plan" | "review" | "report" | "explainer" | "editor";
  tone: keyof typeof artifactTones;
  title: string;
  description: string;
}[] = [
  {
    variant: "exploration",
    tone: "cyan",
    title: "Exploration grids",
    description: "Compare directions side by side, then point at the one worth expanding."
  },
  {
    variant: "plan",
    tone: "amber",
    title: "Implementation plans",
    description: "Turn a long plan into milestones, data flows, snippets, and review checkpoints."
  },
  {
    variant: "review",
    tone: "rose",
    title: "PR review surfaces",
    description: "Group diffs by risk, annotate the important paths, and guide the reviewer’s attention."
  },
  {
    variant: "report",
    tone: "amber",
    title: "Research reports",
    description: "Synthesize Slack, Git history, docs, and issues into a page people will actually read."
  },
  {
    variant: "explainer",
    tone: "cyan",
    title: "Interactive explainers",
    description: "Use diagrams, tabs, sliders, and toggles when text alone would bury the point."
  },
  {
    variant: "editor",
    tone: "emerald",
    title: "Throwaway editors",
    description: "Build one-use interfaces for shaping JSON, CSV, prompts, or configuration by hand."
  }
];

const quoteNotes = [
  {
    person: "Thariq",
    avatarUrl: "https://github.com/thdxr.png",
    note: "HTML is the new Markdown."
  },
  {
    person: "Karpathy",
    avatarUrl: "https://github.com/karpathy.png",
    note: "Vision, images, animations, and video, are the preferred output from AI."
  },
  {
    person: "Theo",
    avatarUrl: "https://github.com/t3dotgg.png",
    note: "There is evidently an opportunity for a microservice for this."
  },
  {
    person: "Anthropic",
    avatarUrl: "https://github.com/anthropics.png",
    note: "Each file trades a document you would skim for one you would actually read."
  }
];

const workflow = [
  {
    step: "01",
    title: "Agent writes the output",
    description: "A report, prototype, review surface, spec, or one-off tool lands in the team."
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
      <div className="pointer-events-none absolute left-0 top-0 z-30 h-full w-px bg-border" />
      <div className="pointer-events-none absolute right-0 top-0 z-30 h-full w-px bg-border" />
      {!last ? (
        <div className="pointer-events-none absolute bottom-0 left-1/2 z-30 h-px w-screen -translate-x-1/2 bg-border" />
      ) : null}
      <div className={cn("relative z-10 px-5 py-10 sm:px-8 sm:py-12 lg:p-12", contentClassName)}>{children}</div>
    </section>
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
    <HoverLipCard
      className={cn("group rounded-[10px] border border-border p-1 transition-colors hover:border-foreground/[0.14]", className)}
      innerClassName="flex h-full flex-col gap-3 rounded-md border border-foreground/[0.1] bg-background px-5 py-4 transition-colors group-hover:border-foreground/[0.14] group-hover:bg-[oklch(0.18_0_0)]"
    >
      <Icon className="size-5 text-[oklch(0.56_0_0)] transition-colors group-hover:text-[oklch(0.68_0_0)]" aria-hidden />
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground/90">{title}</h3>
        <p className="max-w-[52ch] text-sm leading-relaxed text-foreground/45">{description}</p>
      </div>
    </HoverLipCard>
  );
}

function ArtifactPreview({ variant }: { variant: (typeof artifactKinds)[number]["variant"] }) {
  if (variant === "exploration") {
    return (
      <div className="artifact-preview-exploration grid grid-cols-3 gap-2">
        {["A", "B", "C"].map((item) => (
          <div key={item} className="artifact-option artifact-accent-border rounded-sm border bg-background/70 p-2">
            <div className="mb-2 font-mono text-[10px] text-foreground/35">Option {item}</div>
            <div className="artifact-option-window artifact-accent-soft h-10 rounded-sm" />
            <div className="artifact-option-line artifact-accent-line mt-2 h-1.5 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "plan") {
    return (
      <div className="artifact-preview-plan space-y-2">
        {["Schema", "Renderer", "Sharing"].map((item, index) => (
          <div key={item} className="artifact-plan-row artifact-accent-border flex items-center gap-3 rounded-sm border bg-background/70 p-2">
            <span className="artifact-accent-text font-mono text-[10px]">0{index + 1}</span>
            <span className="artifact-plan-line artifact-accent-line h-1.5 flex-1 rounded-full" />
            <span className="font-mono text-[10px] text-foreground/35">{item}</span>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "review") {
    return (
      <div className="artifact-preview-review grid grid-cols-[0.8fr_1.2fr] gap-2">
        <div className="artifact-accent-border space-y-2 rounded-sm border bg-background/70 p-2">
          <div className="artifact-risk-line h-1.5 rounded-full bg-red-400/45" />
          <div className="artifact-risk-line h-1.5 w-5/6 rounded-full bg-amber-400/35" />
          <div className="artifact-risk-line h-1.5 w-2/3 rounded-full bg-emerald-400/30" />
        </div>
        <div className="artifact-code-window artifact-accent-border rounded-sm border bg-background/70 p-2 font-mono text-[10px] leading-4 text-foreground/35">
          <div>+ stream.flush()</div>
          <div>- buffer.wait()</div>
          <div className="text-amber-300/70">! backpressure</div>
        </div>
      </div>
    );
  }

  if (variant === "report") {
    return (
      <div className="artifact-preview-report artifact-accent-border rounded-sm border bg-background/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="artifact-accent-line h-2 w-28 rounded-full" />
          <div className="font-mono text-[10px] text-foreground/30">n=2,184</div>
        </div>
        <div className="grid grid-cols-[1.15fr_0.85fr] gap-3">
          <div className="flex h-12 items-end gap-1.5 rounded-sm bg-foreground/[0.025] px-2 pb-2">
            {[34, 58, 42, 72, 51, 84].map((height, index) => (
              <span
                key={index}
                className="artifact-report-bar artifact-accent-line w-full rounded-t-[2px]"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="relative h-12 rounded-sm bg-foreground/[0.025] p-2">
            <svg viewBox="0 0 96 44" className="h-full w-full overflow-visible" aria-hidden="true">
              <polyline
                className="artifact-trend-line"
                points="0,34 16,29 30,31 46,18 62,22 78,10 96,13"
                fill="none"
                stroke="color-mix(in oklch, var(--artifact-accent) 48%, transparent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle className="artifact-trend-point" cx="78" cy="10" r="3" fill="color-mix(in oklch, var(--artifact-accent) 62%, transparent)" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "explainer") {
    return (
      <div className="artifact-preview-explainer artifact-accent-border rounded-sm border bg-background/70 p-3">
        <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-foreground/35">
          <span>token bucket</span>
          <span>42%</span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/10">
          <div className="artifact-token-fill artifact-accent-line h-1.5 w-5/12 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="artifact-preview-editor artifact-accent-border rounded-sm border bg-background/70 p-3">
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="artifact-editor-field artifact-accent-border artifact-accent-soft h-8 rounded-sm border" />
        <div className="artifact-editor-field artifact-accent-border artifact-accent-soft h-8 rounded-sm border" />
        <div className="artifact-editor-field artifact-accent-border artifact-accent-soft h-8 rounded-sm border" />
      </div>
      <div className="flex justify-end">
        <span className="artifact-copy-chip artifact-accent-border artifact-accent-text rounded-sm border px-2 py-1 font-mono text-[10px]">copy JSON</span>
      </div>
    </div>
  );
}

function DemoPanel() {
  return (
    <HoverLipCard
      className="rounded-[10px] border border-border p-1"
      innerClassName="demo-video-frame overflow-hidden rounded-md border border-foreground/[0.1] bg-card"
    >
      <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-4 py-3">
        <span className="size-2 rounded-full bg-red-400/70" />
        <span className="size-2 rounded-full bg-amber-400/70" />
        <span className="size-2 rounded-full bg-emerald-400/70" />
        <div className="ml-3 min-w-0 flex-1 truncate text-[12px] font-medium tracking-[-0.015em] text-foreground/48">
          artifacts-demo-final-final-v2.mp4
        </div>

      </div>

      <div className="demo-video-screen relative aspect-video overflow-hidden bg-background" aria-label="Demo video placeholder">
        {/* Replace this placeholder with the recorded demo when ready:
          <video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata" poster="/demo/artifacts-demo-poster.jpg">
            <source src="/demo/artifacts-demo.mp4" type="video/mp4" />
          </video>
          */}
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-md">
            <img src={logoPath} alt="" className="mx-auto mb-4 size-5 opacity-45" />
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground/35">Demo recording</div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/45">
              Drop in the Claude Code run here: generate a PR report, publish the URL, then append v2.
            </p>
          </div>
        </div>
      </div>
    </HoverLipCard>
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
          <div className="relative z-20 w-full lg:basis-[45%]">
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
          <div className="absolute bottom-px left-0 right-px top-0 z-0 hidden lg:flex">
            <HeroDitherShader />
          </div>
        </div>
      </SectionShell>

      <SectionShell id="how">
        <div className="mb-8 max-w-2xl space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">How it works</h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            A Claude Code recording will show the whole path: prompt, generated HTML report, publish command, live URL,
            and a version update.
          </p>
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {workflow.map((item) => (
            <HoverLipCard
              key={item.step}
              className="rounded-[10px] border border-foreground/[0.08] p-1"
              innerClassName="h-full rounded-md border border-foreground/[0.06] bg-background p-5"
            >
              <div className="font-mono text-[11px] text-foreground/35">{item.step}</div>
              <h3 className="font-pixel mt-4 text-base font-normal tracking-[-0.03em] text-foreground/90">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/45">{item.description}</p>
            </HoverLipCard>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            Agents already make finished surfaces. Artifacts gives
            <br />
            those surfaces somewhere to live after the task ends.
          </p>
        </div>
        <div className="grid items-start gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {artifactKinds.map((kind) => {
            const accent = artifactTones[kind.tone];
            return (
              <article
                key={kind.title}
                style={{ "--artifact-accent": accent } as CSSProperties}
                className="artifact-card flex flex-col"
              >
                <HoverLipCard
                  className="mb-4 rounded-[10px] border border-border p-1"
                  innerClassName="artifact-preview flex h-[7.6rem] items-center rounded-md border p-3"
                >
                  <div className="w-full">
                    <ArtifactPreview variant={kind.variant} />
                  </div>
                </HoverLipCard>
                <h3 className="text-sm font-semibold text-foreground/90">{kind.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/45">{kind.description}</p>
              </article>
            );
          })}
        </div>

      </SectionShell>

      <SectionShell id="quotes">
        <div className="mb-8 max-w-xl space-y-2 lg:mb-10">
          <h2 className="font-pixel text-2xl font-normal tracking-[-0.04em] text-foreground/90 sm:text-3xl">The shift to HTML artifacts</h2>
          <p className="text-sm leading-relaxed text-foreground/45 sm:text-base">
            Industry voices are pointing past chat text toward rich,
            <br />
            inspectable web outputs.
          </p>
        </div>
        <div className="relative -mx-5 py-3 sm:-mx-8 lg:-mx-12">
          <div className="quote-fade overflow-hidden">
            <div className="quote-marquee flex w-max items-start gap-8">
              {[...quoteNotes, ...quoteNotes].map((quote, index) => (
                <figure key={`${quote.person}-${index}`} className="group flex w-[21rem] shrink-0 items-start gap-3 py-2">
                  <div className="relative mt-0.5 size-9 shrink-0 rounded-full bg-background p-[2px]">
                    <img
                      src={quote.avatarUrl}
                      alt=""
                      className="size-full rounded-full border border-foreground/[0.12] object-cover grayscale transition duration-300 group-hover:grayscale-0"
                    />
                  </div>
                  <div className="min-w-0 max-w-[16.5rem] whitespace-normal">
                    <blockquote className="text-pretty text-[14px] italic leading-6 text-foreground/68">
                      <span aria-hidden className="text-foreground/28">“</span>{quote.note}<span aria-hidden className="text-foreground/28">”</span>
                    </blockquote>
                    <figcaption className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/34">
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
          <img src={logoPath} alt="Artifacts" className="size-[18px] opacity-75" />
          <Link href="/pricing" className="transition-colors hover:text-foreground/70">Pricing</Link>
          <Link href={docsHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/70">Docs</Link>
          <Link href="mailto:support@agent-artifacts.com" className="transition-colors hover:text-foreground/70">Support</Link>
          <Link href={githubUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground/70">GitHub</Link>
        </div>
        <div className="font-mono">© 2026 Artifacts</div>
      </footer>
    </main>
  );
}
