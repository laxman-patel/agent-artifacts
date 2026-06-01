import type { Metadata } from "next";
import { Suspense } from "react";

import { MarketingFooter, MarketingNav, SectionShell } from "../../components/marketing-chrome";
import { LoginCompleteClient } from "./login-complete-client";

export const metadata: Metadata = {
  title: "Complete sign in",
  description: "Complete your Artifacts sign-in and claim your personal namespace."
};

function Fallback() {
  return (
    <section className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <div className="h-8 w-28 bg-foreground/[0.08]" />
      <div className="mt-4 h-4 w-48 bg-foreground/[0.06]" />
    </section>
  );
}

export default function LoginCompletePage() {
  return (
    <main id="signin-complete" className="marketing dark flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <MarketingNav />
      <SectionShell id="content" last className="flex-1" contentClassName="grid min-h-[calc(100dvh-9.75rem)] place-items-center pb-16 pt-24 sm:pt-28 lg:pb-20 lg:pt-32">
        <Suspense fallback={<Fallback />}>
          <LoginCompleteClient />
        </Suspense>
      </SectionShell>
      <MarketingFooter />
    </main>
  );
}
