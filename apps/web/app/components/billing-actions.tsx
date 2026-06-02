"use client";

import { useState } from "react";

type PaidPlanId = "builder" | "studio";

export function BillingCheckoutButton({
  planId,
  children,
  className,
  wrapperClassName = "stack tight",
  errorClassName = "error small"
}: {
  planId: PaidPlanId;
  children: React.ReactNode;
  className?: string;
  wrapperClassName?: string;
  errorClassName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId })
      });

      if (response.status === 401 || response.status === 403) {
        window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
        return;
      }

      const payload = (await response.json()) as { checkoutUrl?: string; message?: string };
      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.message ?? "Checkout could not be started.");
      }

      window.location.href = payload.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={wrapperClassName}>
      <button type="button" className={className ?? "primary-button"} disabled={loading} onClick={() => void startCheckout()}>
        {loading ? "Opening checkout..." : children}
      </button>
      {error ? <p className={errorClassName}>{error}</p> : null}
    </div>
  );
}

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include"
      });

      if (response.status === 401 || response.status === 403) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }

      const payload = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.message ?? "Billing portal could not be opened.");
      }
      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Billing portal could not be opened.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack tight">
      <button type="button" className="ghost-button" disabled={loading} onClick={() => void openPortal()}>
        {loading ? "Opening portal..." : "Manage billing"}
      </button>
      {error ? <p className="error small">{error}</p> : null}
    </div>
  );
}
