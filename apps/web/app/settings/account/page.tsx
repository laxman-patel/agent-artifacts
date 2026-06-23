import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";

import { publicAppUrl } from "@/lib/site-metadata";
import { cookieHeader, fetchProfileMe } from "../../../lib/server-api";
import { SettingsHeader, SettingsPanel, SettingsRow } from "../components/settings-chrome";
import type { ProfileMeResponse } from "../../../lib/server-api";

function initials(profile: ProfileMeResponse): string {
  const source = (profile.user.name || profile.profile?.username || profile.user.email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const combined = `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    if (combined) return combined;
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

export default async function AccountSettingsPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const profile = await fetchProfileMe(header);

  if (!profile.ok || !profile.body) {
    redirect("/login?next=/settings/account");
  }

  const { user, profile: profileRow } = profile.body;
  const displayName = profileRow?.displayName || user.name || profileRow?.username || "Your account";
  const host = publicAppUrl().replace(/^https?:\/\//, "");

  return (
    <>
      <SettingsHeader title="Account" description="Your Artifacts identity and the namespace your public URLs are built on." />

      <SettingsPanel className="overflow-hidden">
        <div className="flex items-center gap-4 px-5 py-5">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote OAuth avatar, no loader needed
            <img
              src={user.image}
              alt=""
              className="size-12 shrink-0 rounded-lg border border-[var(--wb-line-strong)] object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-lg border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] font-pixel text-base leading-none text-foreground/70"
            >
              {initials(profile.body)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground/90">{displayName}</p>
            <p className="truncate font-mono text-[12px] text-foreground/45">{user.email}</p>
          </div>
        </div>

        <div className="divide-y divide-[var(--wb-line)] border-t border-[var(--wb-line)]">
          <SettingsRow label="Email">
            <span className="font-mono text-[13px] text-foreground/80">{user.email}</span>
            {user.emailVerified ? (
              <span className="inline-flex items-center gap-1 rounded-[0.25rem] border border-[color-mix(in_oklch,var(--wb-accent-jsx)_38%,var(--wb-line-strong))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color-mix(in_oklch,var(--wb-accent-jsx)_72%,white)]">
                <BadgeCheck className="size-3" aria-hidden />
                Verified
              </span>
            ) : (
              <span className="rounded-[0.25rem] border border-[var(--wb-line-strong)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">
                Unverified
              </span>
            )}
          </SettingsRow>

          <SettingsRow
            label="Username"
            hint={profileRow ? "Claimed once at signup. It cannot be changed." : "Reserve your namespace to unlock public URLs."}
          >
            {profileRow ? (
              <span className="inline-flex items-baseline gap-1.5 font-mono text-[13px]">
                <span className="text-foreground/35">{host}/</span>
                <span className="text-foreground/90">{profileRow.username}</span>
              </span>
            ) : (
              <Link className="primary-button" href="/login?mode=signup&next=/settings/account">
                Finish signup
              </Link>
            )}
          </SettingsRow>

          {profileRow ? (
            <SettingsRow label="Member since">
              <span className="text-[13px] text-foreground/70">{formatDate(profileRow.createdAt)}</span>
            </SettingsRow>
          ) : null}
        </div>
      </SettingsPanel>
    </>
  );
}
