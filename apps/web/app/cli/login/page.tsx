import { readSessionCookie } from "@agent-artifacts/shared";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HeroDitherShader } from "../../components/hero-dither-shader";
import { MarketingFooter, MarketingNav, SectionShell } from "../../components/marketing-chrome";
import { CliLoginAuthorize } from "./cli-login-authorize";

export const metadata: Metadata = {
  title: "Authorize CLI",
  description: "Authorize the Artifacts CLI running on your machine to access your account."
};

interface CliLoginPageProps {
  searchParams: Promise<{ port?: string; state?: string }>;
}

function isValidPort(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port >= 1024 && port <= 65_535;
}

function isValidState(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value);
}

function CliLoginShell({ children }: { children: ReactNode }) {
  return (
    <main id="cli-login" className="marketing dark flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to authorization
      </a>
      <MarketingNav />

      <SectionShell
        id="content"
        last
        className="flex flex-1 flex-col"
        contentClassName="grid flex-1 min-h-[calc(100dvh-9.75rem)] place-items-center pb-16 pt-24 sm:pt-28 lg:pb-20 lg:pt-32"
      >
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18] mix-blend-screen" aria-hidden>
          <HeroDitherShader className="h-full min-h-[28rem]" fieldClassName="auth-shader-field" frontColor="#FF570A" speed={0.18} />
        </div>
        {children}
      </SectionShell>

      <MarketingFooter />
    </main>
  );
}

export default async function CliLoginPage({ searchParams }: CliLoginPageProps) {
  const params = await searchParams;
  const port = params.port;
  const state = params.state;

  if (!isValidPort(port) || !isValidState(state)) {
    return (
      <CliLoginShell>
        <section className="relative z-10 w-full max-w-[24rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
          <h1 className="!m-0 flex items-start gap-2 font-pixel !text-[1.9rem] !font-normal !leading-[1.05] tracking-[-0.045em] text-foreground/95">
            <span>CLI sign-in</span>
            <img src="/brand/artifacts-logo.svg" alt="" className="mt-1.5 size-3 shrink-0 opacity-90" />
          </h1>
          <p role="alert" className="mt-5 border border-[#FF570A]/30 bg-[#FF570A]/10 px-3 py-2 text-[13px] leading-5 text-foreground/78">
            This authorization link is invalid or expired.
          </p>
          <p className="mt-4 text-[13px] leading-6 text-foreground/50">
            Start again by running <code className="font-mono text-foreground/75">artifacts login</code> in your terminal.
          </p>
        </section>
      </CliLoginShell>
    );
  }

  const cookieStore = await cookies();
  const sessionToken = readSessionCookie(cookieStore);

  const nextPath = `/cli/login?port=${encodeURIComponent(port)}&state=${encodeURIComponent(state)}`;

  if (!sessionToken) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <CliLoginShell>
      <CliLoginAuthorize port={port} state={state} />
    </CliLoginShell>
  );
}
