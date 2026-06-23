import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SettingsHeader({
  title,
  description,
  actions
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">{title}</h1>
        {description ? <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-foreground/50">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SettingsPanel({
  title,
  description,
  actions,
  children,
  className
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[0.625rem] border border-[var(--wb-line)] bg-[var(--wb-tile)]", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[var(--wb-line)] px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground/90">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-foreground/45">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SettingsRow({
  label,
  hint,
  children
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-5 py-4">
      <div className="min-w-0">
        <p className="text-[13px] text-foreground/55">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/35">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-right text-sm text-foreground/85">{children}</div>
    </div>
  );
}
