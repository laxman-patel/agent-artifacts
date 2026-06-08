"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function WorkspaceCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, slug })
      });

      const body = (await response.json().catch(() => ({}))) as {
        workspace?: { slug: string };
        message?: string;
      };

      if (!response.ok || !body.workspace) {
        setError(body.message ?? "Could not create team.");
        return;
      }

      router.push(`/dashboard/${body.workspace.slug}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? `Could not create team: ${error.message}` : "Could not create team.");
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void onSubmit(event)}>
      <label className="stack tight">
        <span className="label">Team name</span>
        <input
          autoComplete="organization"
          className="input"
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Acme Studio"
          required
          value={name}
        />
      </label>
      <label className="stack tight">
        <span className="label">Team slug</span>
        <input
          autoCapitalize="none"
          autoComplete="off"
          className="input"
          name="slug"
          onChange={(event) => setSlug(event.target.value)}
          pattern="[a-z0-9][a-z0-9_-]*[a-z0-9]"
          minLength={3}
          maxLength={32}
          placeholder="acme"
          required
          value={slug}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary-button" type="submit">
        Create team
      </button>
    </form>
  );
}
