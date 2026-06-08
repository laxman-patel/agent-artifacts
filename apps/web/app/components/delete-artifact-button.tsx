"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  artifactId: string;
  artifactTitle: string;
  workspaceSlug: string;
}

export function DeleteArtifactButton({ artifactId, artifactTitle, workspaceSlug }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText !== artifactTitle) {
      setError(`Type the artifact title exactly to confirm: ${artifactTitle}`);
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/artifacts/${artifactId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setError(data.message ?? `Delete failed (HTTP ${res.status}).`);
        setDeleting(false);
        return;
      }
      router.push(`/dashboard/${workspaceSlug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button className="danger-button" onClick={() => setConfirming(true)} type="button">
        Delete artifact
      </button>
    );
  }

  return (
    <div className="delete-confirm">
      <p className="muted small">
        This permanently hides the artifact and all versions. Type the title <code>{artifactTitle}</code> to confirm.
      </p>
      <input
        autoFocus
        className="confirm-input"
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={artifactTitle}
        type="text"
        value={confirmText}
      />
      <div className="row-actions">
        <button className="ghost-button" disabled={deleting} onClick={() => { setConfirming(false); setError(null); setConfirmText(""); }} type="button">
          Cancel
        </button>
        <button
          className="danger-button"
          disabled={deleting || confirmText !== artifactTitle}
          onClick={handleDelete}
          type="button"
        >
          {deleting ? "Deleting…" : "Permanently delete"}
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}
