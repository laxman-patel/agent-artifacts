"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

function safeNextPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

function signupLoginUrl(nextPath: string, username: string, error: string): string {
  const params = new URLSearchParams({
    mode: "signup",
    next: nextPath,
    error
  });
  if (username) params.set("username", username);
  return `/login?${params.toString()}`;
}

export function LoginCompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const username = searchParams.get("username") ?? "";
  const nextPath = safeNextPath(searchParams.get("next"));
  const [message, setMessage] = useState("Preparing your namespace…");

  useEffect(() => {
    let cancelled = false;

    async function completeLogin() {
      const profileResponse = await fetch("/api/profile/me", { credentials: "include" });
      if (!profileResponse.ok) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
        return;
      }

      const profileBody = (await profileResponse.json()) as { profile?: { username: string } | null };
      if (profileBody.profile?.username) {
        router.replace(nextPath);
        return;
      }

      if (!username) {
        router.replace(
          signupLoginUrl(nextPath, "", "Sign up and choose a username to continue.")
        );
        return;
      }

      const claimResponse = await fetch("/api/profile/username", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username })
      });

      if (claimResponse.ok) {
        router.replace(nextPath);
        return;
      }

      const claimBody = (await claimResponse.json().catch(() => ({}))) as { message?: string; issues?: { message: string }[] };
      const error = claimBody.issues?.[0]?.message ?? claimBody.message ?? "Could not claim that username.";
      if (!cancelled) setMessage(error);
      router.replace(signupLoginUrl(nextPath, username, error));
    }

    void completeLogin().catch((error) => {
      const detail = error instanceof Error ? error.message : "Could not complete sign up.";
      if (!cancelled) setMessage(detail);
      router.replace(signupLoginUrl(nextPath, username, detail));
    });

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, username]);

  return (
    <section className="relative z-10 w-full max-w-[22rem] border border-border bg-background p-6 shadow-[0_18px_48px_oklch(0.08_0_0_/_0.28)]">
      <h1 className="!m-0 flex items-start gap-2 whitespace-nowrap font-pixel !text-[2.35rem] !font-normal !leading-none tracking-[-0.045em] text-foreground/95">
        <span>Sign up</span>
        <img src="/brand/artifacts-logo.svg" alt="" className="mt-1 size-3.5 opacity-90" />
      </h1>
      <p className="mt-3 text-[13px] leading-6 text-foreground/50">{message}</p>
    </section>
  );
}
