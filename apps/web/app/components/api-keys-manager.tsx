"use client";

import { useState, type FormEvent } from "react";
import type { AgentScope, ApiKeySummary } from "../../lib/server-api";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

const SCOPE_OPTIONS: Array<{ value: AgentScope; label: string }> = [
  { value: "artifacts:read", label: "Read artifacts" },
  { value: "artifacts:create", label: "Create artifacts" },
  { value: "artifacts:update", label: "Update and restore artifacts" },
  { value: "artifacts:delete", label: "Delete artifacts" },
  { value: "artifacts:share", label: "Create and revoke share links" },
  { value: "artifacts:access:read", label: "Read access settings" },
  { value: "artifacts:access:write", label: "Manage artifact access" }
];

type CreatedApiKey = ApiKeySummary & { token: string };

export function ApiKeysManager({ initialApiKeys }: { initialApiKeys: ApiKeySummary[] }) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [name, setName] = useState("Agent key");
  const [scopes, setScopes] = useState<AgentScope[]>(["artifacts:read", "artifacts:create", "artifacts:update"]);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<ApiFormError | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  function toggleScope(scope: AgentScope) {
    setScopes((current) => current.includes(scope) ? current.filter((candidate) => candidate !== scope) : [...current, scope]);
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreated(null);
    setPending(true);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, scopes })
      });
      if (!response.ok) {
        setError(await readApiFormError(response, "Could not create API key."));
        return;
      }
      const body = (await response.json()) as { apiKey: CreatedApiKey };
      setCreated(body.apiKey);
      setApiKeys((current) => [body.apiKey, ...current]);
    } finally {
      setPending(false);
    }
  }

  async function revokeKey(apiKeyId: string) {
    setError(null);
    setRevokingId(apiKeyId);
    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(apiKeyId)}`, { method: "DELETE" });
      if (!response.ok) {
        setError(await readApiFormError(response, "Could not revoke API key."));
        return;
      }
      setApiKeys((current) =>
        current.map((apiKey) => apiKey.id === apiKeyId ? { ...apiKey, revokedAt: new Date().toISOString() } : apiKey)
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="stack">
      <form className="card flat stack" onSubmit={createKey}>
        <div className="section-header">
          <h2>Create API key</h2>
          <p className="muted small">Tokens are shown once. Store the token before leaving this page.</p>
        </div>
        <label>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} />
        </label>
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend className="muted small">Scopes</legend>
          {SCOPE_OPTIONS.map((option) => (
            <label key={option.value} className="row-actions" style={{ justifyContent: "flex-start" }}>
              <input
                type="checkbox"
                checked={scopes.includes(option.value)}
                onChange={() => toggleScope(option.value)}
              />
              <span>{option.label}</span>
              <code>{option.value}</code>
            </label>
          ))}
        </fieldset>
        <FormErrorMessage error={error} />
        <button className="primary-button" type="submit" disabled={pending || scopes.length === 0}>
          {pending ? "Creating..." : "Create key"}
        </button>
        {created ? (
          <div className="notice">
            <strong>Copy this token now</strong>
            <input readOnly value={created.token} onFocus={(event) => event.currentTarget.select()} />
          </div>
        ) : null}
      </form>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Existing keys</h2>
          <p className="muted small">Revoked keys stop working immediately.</p>
        </div>
        {apiKeys.length === 0 ? (
          <p className="empty-state">No API keys yet.</p>
        ) : (
          <ul className="member-list">
            {apiKeys.map((apiKey) => (
              <li key={apiKey.id}>
                <div>
                  <strong>{apiKey.name}</strong>
                  <p className="muted small">
                    {apiKey.scopes.join(", ")} · created {new Date(apiKey.createdAt).toLocaleDateString()}
                    {apiKey.lastUsedAt ? ` · last used ${new Date(apiKey.lastUsedAt).toLocaleDateString()}` : ""}
                    {apiKey.revokedAt ? " · revoked" : ""}
                  </p>
                </div>
                <button
                  className="ghost-button danger"
                  type="button"
                  disabled={Boolean(apiKey.revokedAt) || revokingId === apiKey.id}
                  onClick={() => revokeKey(apiKey.id)}
                >
                  {revokingId === apiKey.id ? "Revoking..." : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
