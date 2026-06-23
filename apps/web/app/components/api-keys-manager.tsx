"use client";

import { Check, Copy, KeyRound, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";
import type { AgentScope, ApiKeySummary } from "../../lib/server-api";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";
import { SettingsPanel } from "../settings/components/settings-chrome";

const SCOPE_OPTIONS: Array<{ value: AgentScope; label: string }> = [
  { value: "artifacts:read", label: "Read artifacts" },
  { value: "artifacts:create", label: "Create artifacts" },
  { value: "artifacts:update", label: "Update and restore" },
  { value: "artifacts:delete", label: "Delete artifacts" },
  { value: "artifacts:share", label: "Manage share links" },
  { value: "artifacts:access:read", label: "Read access settings" },
  { value: "artifacts:access:write", label: "Manage access" }
];

const DEFAULT_SCOPES: AgentScope[] = ["artifacts:read", "artifacts:create", "artifacts:update"];

type CreatedApiKey = ApiKeySummary & { token: string };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy token"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-[var(--wb-line-strong)] px-3 text-[12px] font-medium text-foreground/75 transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-[color-mix(in_oklch,var(--wb-accent-jsx)_75%,white)]" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ApiKeysManager({ initialApiKeys }: { initialApiKeys: ApiKeySummary[] }) {
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("Agent key");
  const [scopes, setScopes] = useState<AgentScope[]>(DEFAULT_SCOPES);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [error, setError] = useState<ApiFormError | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeCount = apiKeys.filter((key) => !key.revokedAt).length;

  function toggleScope(scope: AgentScope) {
    setScopes((current) =>
      current.includes(scope) ? current.filter((candidate) => candidate !== scope) : [...current, scope]
    );
  }

  function openForm() {
    setError(null);
    setName("Agent key");
    setScopes(DEFAULT_SCOPES);
    setCreating(true);
  }

  function closeForm() {
    setCreating(false);
    setError(null);
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
      setCreating(false);
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
        current.map((apiKey) => (apiKey.id === apiKeyId ? { ...apiKey, revokedAt: new Date().toISOString() } : apiKey))
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {created ? (
        <section className="overflow-hidden rounded-[0.625rem] border border-[color-mix(in_oklch,var(--wb-accent-orange)_40%,var(--wb-line-strong))] bg-[color-mix(in_oklch,var(--wb-accent-orange)_6%,var(--wb-tile))]">
          <div className="flex items-start justify-between gap-4 px-5 pt-4">
            <div>
              <h2 className="text-[14px] font-semibold text-foreground/90">Copy your token now</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-foreground/55">
                This is the only time <code className="font-mono text-foreground/75">{created.name}</code> is shown. Store it somewhere safe.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreated(null)}
              aria-label="Dismiss"
              className="-mr-1 shrink-0 rounded-md p-1 text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/80"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="flex items-center gap-2 px-5 pb-5 pt-3">
            <input
              readOnly
              value={created.token}
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] px-3 py-2 font-mono text-[12px] text-foreground/90 outline-none"
            />
            <CopyButton value={created.token} />
          </div>
        </section>
      ) : null}

      <SettingsPanel
        title="Your keys"
        description={activeCount === 1 ? "1 active key" : `${activeCount} active keys`}
        actions={
          !creating ? (
            <button
              type="button"
              onClick={openForm}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color-mix(in_oklch,var(--wb-accent-orange)_44%,var(--wb-line-strong))] bg-[color-mix(in_oklch,var(--wb-accent-orange)_16%,var(--wb-tile-raised))] px-3 text-[13px] font-medium text-[color-mix(in_oklch,var(--wb-accent-orange)_22%,white)] transition-colors hover:bg-[color-mix(in_oklch,var(--wb-accent-orange)_22%,var(--wb-tile-raised))] hover:text-foreground"
            >
              <Plus className="size-4 text-[var(--wb-accent-orange)]" strokeWidth={2} aria-hidden />
              New key
            </button>
          ) : null
        }
      >
        {creating ? (
          <form onSubmit={createKey} className="space-y-4 border-b border-[var(--wb-line)] bg-[var(--wb-canvas)]/40 px-5 py-5">
            <label className="block space-y-1.5">
              <span className="text-[13px] text-foreground/70">Key name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={100}
                placeholder="Agent key"
                className="w-full rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] px-3 py-2 text-sm text-foreground/90 outline-none placeholder:text-foreground/30"
              />
            </label>

            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="mb-1 p-0 text-[13px] text-foreground/70">Scopes</legend>
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {SCOPE_OPTIONS.map((option) => {
                  const checked = scopes.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors",
                        checked
                          ? "border-[color-mix(in_oklch,var(--wb-accent-orange)_36%,var(--wb-line-strong))] bg-[color-mix(in_oklch,var(--wb-accent-orange)_7%,transparent)]"
                          : "border-[var(--wb-line)] hover:border-[var(--wb-line-strong)]"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleScope(option.value)}
                        className="size-3.5 shrink-0 accent-[#ff570a]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-tight text-foreground/85">{option.label}</span>
                        <code className="block truncate font-mono text-[11px] leading-tight text-foreground/35">{option.value}</code>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <FormErrorMessage error={error} className="text-[13px] text-[color-mix(in_oklch,oklch(0.68_0.09_15)_80%,white)]" />

            <div className="flex items-center gap-2">
              <button className="primary-button" type="submit" disabled={pending || scopes.length === 0}>
                {pending ? "Creating…" : "Create key"}
              </button>
              <button className="ghost-button" type="button" onClick={closeForm} disabled={pending}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {apiKeys.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-lg border border-[var(--wb-line)] bg-[var(--wb-tile-raised)] text-foreground/40">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-[14px] font-medium text-foreground/80">No API keys yet</p>
            <p className="mx-auto mt-1.5 max-w-[42ch] text-[13px] leading-relaxed text-foreground/45">
              Create a scoped key to authenticate <code className="font-mono text-foreground/65">artifacts</code> CLI runs, agents, or REST and MCP automation.
            </p>
          </div>
        ) : (
          <div role="list" className="divide-y divide-[var(--wb-line)]">
            {apiKeys.map((apiKey) => {
              const revoked = Boolean(apiKey.revokedAt);
              return (
                <div role="listitem" key={apiKey.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[14px] font-medium", revoked ? "text-foreground/45 line-through" : "text-foreground/90")}>
                        {apiKey.name}
                      </span>
                      {revoked ? (
                        <span className="rounded-[0.25rem] border border-[var(--wb-line-strong)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/45">
                          Revoked
                        </span>
                      ) : (
                        <span className="rounded-[0.25rem] border border-[color-mix(in_oklch,var(--wb-accent-jsx)_38%,var(--wb-line-strong))] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[color-mix(in_oklch,var(--wb-accent-jsx)_72%,white)]">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {apiKey.scopes.map((scope) => (
                        <code
                          key={scope}
                          className="rounded-[0.25rem] border border-[var(--wb-line)] bg-[var(--wb-canvas)] px-1.5 py-0.5 font-mono text-[10px] text-foreground/55"
                        >
                          {scope}
                        </code>
                      ))}
                    </div>
                    <p className="font-mono text-[11px] text-foreground/35">
                      Created {formatDate(apiKey.createdAt)}
                      {apiKey.lastUsedAt ? ` · Last used ${formatDate(apiKey.lastUsedAt)}` : " · Never used"}
                    </p>
                  </div>
                  <button
                    className="ghost-button danger"
                    type="button"
                    disabled={revoked || revokingId === apiKey.id}
                    onClick={() => revokeKey(apiKey.id)}
                  >
                    {revokingId === apiKey.id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
