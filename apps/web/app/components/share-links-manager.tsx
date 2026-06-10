"use client";

import { useState } from "react";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

interface ShareLink {
  id: string;
  role: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface Props {
  artifactId: string;
  initialLinks: ShareLink[];
}

export function ShareLinksManager({ artifactId, initialLinks }: Props) {
  const [links, setLinks] = useState(initialLinks.filter((l) => !l.revokedAt));
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [expiresAt, setExpiresAt] = useState("");
  const [newLink, setNewLink] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiFormError | null>(null);

  async function createLink() {
    setCreating(true);
    setError(null);
    setNewLink(null);

    try {
      const res = await fetch(`/api/artifacts/${artifactId}/share-links`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined
        })
      });

      if (!res.ok) {
        setError(await readApiFormError(res, "Failed to create share link."));
        return;
      }

      const data = (await res.json()) as { id: string; shareUrl: string; role: string; expiresAt?: string | null };
      setNewLink(data.shareUrl);
      setLinks((prev) => [
        ...prev,
        {
          id: data.id,
          role: data.role,
          createdAt: new Date().toISOString(),
          expiresAt: data.expiresAt ?? (expiresAt ? new Date(expiresAt).toISOString() : null),
          revokedAt: null,
          lastUsedAt: null
        }
      ]);
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(linkId: string) {
    const res = await fetch(`/api/share-links/${linkId}/revoke`, { method: "POST" });
    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  }

  return (
    <div className="share-links-manager">
      <div className="share-links-create row-actions">
        <select value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
        </select>
        <input
          aria-label="Share link expiry"
          onChange={(event) => setExpiresAt(event.target.value)}
          type="datetime-local"
          value={expiresAt}
        />
        <button className="primary-button" disabled={creating} onClick={createLink} type="button">
          {creating ? "Creating…" : "Create share link"}
        </button>
      </div>

      <FormErrorMessage error={error} className="error-message" />

      {newLink && (
        <div className="new-share-link">
          <p className="small muted">Share this URL. It won&#39;t be shown again.</p>
          <input className="share-link-input" readOnly type="text" value={newLink} onClick={(e) => (e.target as HTMLInputElement).select()} />
        </div>
      )}

      {links.length > 0 && (
        <ul className="share-links-list">
          {links.map((link) => (
            <li className="share-links-item" key={link.id}>
              <span className="small">
                <strong>{link.role}</strong> · created {new Date(link.createdAt).toLocaleDateString()}
                {link.expiresAt ? ` · expires ${new Date(link.expiresAt).toLocaleString()}` : " · no expiry"}
                {link.lastUsedAt ? ` · last used ${new Date(link.lastUsedAt).toLocaleDateString()}` : ""}
              </span>
              <button
                className="ghost-button small"
                onClick={() => revokeLink(link.id)}
                type="button"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      {links.length === 0 && !newLink && <p className="muted small">No active share links.</p>}
    </div>
  );
}
