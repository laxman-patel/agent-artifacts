"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, History, KeyRound, UserRound, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const tabs: SettingsTab[] = [
  { href: "/settings/account", label: "Account", icon: UserRound },
  { href: "/settings/billing", label: "Plan & billing", icon: CreditCard },
  { href: "/settings/keys", label: "API keys", icon: KeyRound },
  { href: "/settings/audit", label: "Audit log", icon: History }
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="wb-scroll -mx-1 mb-8 flex items-stretch gap-1 overflow-x-auto border-b border-[var(--wb-line)]">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-[var(--wb-accent-orange)] text-foreground"
                : "border-transparent text-foreground/45 hover:text-foreground/80"
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-[var(--wb-accent-orange)]" : "text-foreground/35")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
