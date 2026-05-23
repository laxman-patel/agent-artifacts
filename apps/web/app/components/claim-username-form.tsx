"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClaimUsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/profile/username", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? "Could not claim username.");
      return;
    }

    setUsername("");
    router.refresh();
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <label className="stack tight">
        <span className="label">Username</span>
        <input
          autoComplete="off"
          className="input"
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your-namespace"
          required
          value={username}
        />
        <span className="muted small">Lowercase letters, numbers, underscores, and hyphens (3–32 characters).</span>
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary-button" type="submit">
        Claim username
      </button>
    </form>
  );
}
