import type { Metadata } from "next";
import { Suspense } from "react";

import { MarketingFooter, MarketingNav, SectionShell } from "../components/marketing-chrome";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in or sign up",
  description: "Sign in or create an Artifacts account with Google. Claim your namespace once at signup."
};

function LoginPanelFallback() {
  return (
    <div className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]" aria-busy="true">
      <div className="h-6 w-6 bg-foreground/[0.08]" />
      <div className="mt-7 h-8 w-28 bg-foreground/[0.08]" />
      <div className="mt-4 h-4 w-48 bg-foreground/[0.06]" />
      <div className="mt-8 h-11 w-full border border-foreground/[0.12] bg-foreground/[0.04]" />
      <div className="mt-3 h-11 w-full border border-foreground/[0.08] bg-foreground/[0.025]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main id="signin" className="marketing dark flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
        Skip to sign in
      </a>
      <MarketingNav />

      <SectionShell id="content" last className="flex-1" contentClassName="grid min-h-[calc(100dvh-9.75rem)] place-items-center pb-16 pt-24 sm:pt-28 lg:pb-20 lg:pt-32">
        <Suspense fallback={<LoginPanelFallback />}>
          <LoginForm />
        </Suspense>
      </SectionShell>

      <MarketingFooter />
    </main>
  );
}
