"use client";

import type { ReactNode } from "react";

import { HeroDitherShader } from "../../components/hero-dither-shader";

export function CliAuthPanel({ children }: { children: ReactNode }) {
  return (
    <section className="relative z-10 w-full max-w-[24rem] overflow-hidden border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.18] mix-blend-screen" aria-hidden>
        <HeroDitherShader className="!h-full w-full" fieldClassName="auth-shader-field" frontColor="#FF570A" speed={0.18} />
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
