"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

export function ArtifactPublishForm({
  artifactId,
  artifactType,
  base,
  initialContent,
  expectedLatestVersion
}: {
  artifactId: string;
  artifactType: "html" | "md" | "jsx";
  base: string;
  initialContent: string;
  expectedLatestVersion: number | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [changelog, setChangelog] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiFormError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const body = {
      content,
      changelog: changelog.trim() || undefined,
      expectedLatestVersion: expectedLatestVersion ?? undefined
    };

    try {
      const response = await fetch(`/api/artifacts/${encodeURIComponent(artifactId)}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        setError(await readApiFormError(response, "Could not publish a new version."));
        return;
      }

      const result = (await response.json().catch(() => ({}))) as { url?: string; versionNumber?: number };
      setChangelog("");
      setSuccess(result.versionNumber ? `Published v${result.versionNumber}.` : "Published new version.");
      router.replace(result.url ?? base);
      router.refresh();
    } catch (error) {
      setError({
        message: error instanceof Error ? `Could not publish a new version: ${error.message}` : "Could not publish a new version."
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="workbench dark fixed right-2 top-2 z-40 w-[min(420px,calc(100vw-1rem))] rounded-[0.5rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)]/92 p-3 shadow-[0_16px_38px_oklch(0.08_0_0/0.52)] backdrop-blur-sm">
      <form className="stack tight" onSubmit={(event) => void onSubmit(event)}>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Edit source</p>
          <h2 className="text-sm font-medium text-foreground/90">Publish new version</h2>
        </div>
        <label className="stack tight">
          <span className="label">{artifactType.toUpperCase()} source</span>
          <textarea
            className="input min-h-[240px] resize-y font-mono text-xs"
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            value={content}
          />
        </label>
        <label className="stack tight">
          <span className="label">Changelog</span>
          <input
            className="input"
            maxLength={1000}
            onChange={(event) => setChangelog(event.target.value)}
            placeholder="What changed?"
            value={changelog}
          />
        </label>
        <FormErrorMessage error={error} className="error small" />
        {success ? <p className="pill success">{success}</p> : null}
        <button className="primary-button" disabled={pending || content.trim().length === 0} type="submit">
          {pending ? "Publishing..." : "Publish version"}
        </button>
      </form>
    </aside>
  );
}
