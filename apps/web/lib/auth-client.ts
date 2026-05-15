"use client";

import { createAuthClient } from "better-auth/react";

const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const client = createAuthClient({
  baseURL
});

export interface ArtifactSessionSnapshot {
  data: { user?: { id: string; email?: string } } | null;
  isPending: boolean;
}

export function useArtifactSession(): ArtifactSessionSnapshot {
  return client.useSession() as ArtifactSessionSnapshot;
}

export async function signInWithGoogle(callbackURL: string) {
  await client.signIn.social({
    provider: "google",
    callbackURL
  });
}
