"use client";

import { useState } from "react";

interface AgentClaimConfirmProps {
  userCode: string;
}

export function AgentClaimConfirm({ userCode }: AgentClaimConfirmProps) {
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function claimAgent() {
    setError(null);
    setClaiming(true);

    try {
      const response = await fetch("/api/agent/identity/claim/complete", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_code: userCode })
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Could not claim this agent.");
        setClaiming(false);
        return;
      }

      setClaimed(true);
    } catch {
      setError("Network error while claiming this agent.");
      setClaiming(false);
    }
  }

  return (
    <main className="shell narrow">
      <section className="card stack">
        <div className="section-header">
          <p className="eyebrow">auth.md</p>
          <h1>Claim agent</h1>
        </div>
        <p>
          An agent is requesting access to your Artifacts account with code <code>{userCode}</code>. Continue only if
          you started this flow.
        </p>
        {claimed ? (
          <p>
            Agent claimed. Return to the agent so it can exchange its claim token for a fresh post-claim access token.
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {!claimed ? (
          <button type="button" className="primary-button" disabled={claiming} onClick={() => void claimAgent()}>
            {claiming ? "Claiming…" : "Claim agent"}
          </button>
        ) : null}
      </section>
    </main>
  );
}
