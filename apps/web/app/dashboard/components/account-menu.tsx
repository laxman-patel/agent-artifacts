"use client";

import Link from "next/link";
import { CreditCard, LogOut, MoreHorizontal, UserRound, Users } from "lucide-react";
import { useRef, useState } from "react";
import type { ProfileMeResponse, WorkspaceSummary } from "../../../lib/server-api";
import { useDismiss } from "../../../lib/use-dismiss";

async function signOut() {
  await fetch(`${window.location.origin}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include"
  });
  window.location.href = "/";
}

function initials(profile: ProfileMeResponse): string {
  const source = (profile.user.name || profile.profile?.username || profile.user.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const combined = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    if (combined) return combined;
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function Avatar({ profile }: { profile: ProfileMeResponse }) {
  if (profile.user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote OAuth avatar, no loader needed
      <img
        src={profile.user.image}
        alt=""
        className="size-6 shrink-0 rounded-[0.3rem] border border-[var(--wb-line-strong)] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] font-pixel text-[10px] leading-none text-foreground/70"
    >
      {initials(profile)}
    </span>
  );
}

function MenuLink({ href, icon: Icon, label, onClick }: { href: string; icon: typeof UserRound; label: string; onClick: () => void }) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <Icon className="size-3.5 shrink-0 text-foreground/50" />
      {label}
    </Link>
  );
}

export function AccountMenu({
  profile,
  workspace
}: {
  profile: ProfileMeResponse;
  workspace: WorkspaceSummary;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const displayName = profile.profile?.displayName || profile.user.name || profile.profile?.username || "Account";
  const handle = profile.profile?.username ? `@${profile.profile.username}` : profile.user.email;

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] py-1 shadow-[0_14px_36px_oklch(0.08_0_0/0.55)]"
        >
          <div className="px-2.5 pb-1.5 pt-1">
            <p className="truncate text-sm font-medium text-foreground/90">{displayName}</p>
            <p className="truncate font-mono text-[10px] text-foreground/40">{profile.user.email}</p>
          </div>
          <div className="mb-1 h-px bg-[var(--wb-line)]" />
          <MenuLink href="/settings/account" icon={UserRound} label="Account settings" onClick={() => setOpen(false)} />
          <MenuLink href="/settings/billing" icon={CreditCard} label="Plan & billing" onClick={() => setOpen(false)} />
          {workspace.kind === "team" ? (
            <MenuLink
              href={`/dashboard/${workspace.slug}/settings`}
              icon={Users}
              label="Team settings"
              onClick={() => setOpen(false)}
            />
          ) : null}
          <div className="my-1 h-px bg-[var(--wb-line)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <LogOut className="size-3.5 shrink-0 text-foreground/50" />
            Sign out
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]"
      >
        <Avatar profile={profile} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground/90">{displayName}</span>
          <span className="block truncate font-mono text-[10px] text-foreground/40">{handle}</span>
        </span>
        <MoreHorizontal className="size-3.5 shrink-0 text-foreground/40" />
      </button>
    </div>
  );
}
