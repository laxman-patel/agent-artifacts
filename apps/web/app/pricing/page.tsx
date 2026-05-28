import Link from "next/link";
import { BILLING_PLANS, DODO_USAGE_METERS } from "@agent-artifacts/billing";
import { BillingCheckoutButton } from "../components/billing-actions";

const planFeatures = {
  free: [
    "3 projects and 25 active public artifacts",
    "100 MiB stored version history",
    "100 version writes per month",
    "Basic CLI and MCP usage"
  ],
  builder: [
    "Private artifacts, email allowlists, and share links",
    "5 GiB stored version history included",
    "2,000 version writes and 50 GiB delivery per month",
    "Overages billed automatically through Dodo"
  ],
  studio: [
    "Shared workspace plan foundation with 3 included seats",
    "50 GiB stored version history included",
    "10,000 version writes and 250 GiB delivery per month",
    "$3 per additional seat when team workspaces are enabled"
  ]
} as const;

export default function PricingPage() {
  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Pricing</p>
          <h1>Plans for public sharing, private work, and teams.</h1>
          <p className="subtle">
            Free is capped with no overages. Builder and Studio use Dodo subscription billing with metered overage for storage,
            delivery, and version writes.
          </p>
        </div>
      </header>

      <section className="pricing-grid">
        {Object.values(BILLING_PLANS).map((plan) => (
          <article className={`card flat pricing-card ${plan.id === "builder" ? "featured" : ""}`} key={plan.id}>
            <div className="stack">
              <div>
                <p className="eyebrow">{plan.name}</p>
                <h2>{plan.monthlyPriceUsd === 0 ? "Free" : `$${plan.monthlyPriceUsd}/mo`}</h2>
                <p className="muted">{plan.description}</p>
              </div>
              <ul className="feature-list">
                {planFeatures[plan.id].map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {plan.id === "free" ? (
                <Link className="ghost-button" href="/dashboard">
                  Start free
                </Link>
              ) : (
                <BillingCheckoutButton planId={plan.id}>{plan.id === "builder" ? "Upgrade to Builder" : "Start Studio"}</BillingCheckoutButton>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="card flat stack">
        <div>
          <p className="eyebrow">Usage overage</p>
          <h2>Metered only after included limits</h2>
          <p className="muted">Dodo usage meters attach to paid subscriptions and apply free thresholds before charging overage.</p>
        </div>
        <div className="usage-grid">
          {DODO_USAGE_METERS.map((meter) => (
            <div className="usage-tile" key={meter.eventName}>
              <strong>{meter.unit}</strong>
              <span className="muted small">{meter.eventName}</span>
              <span>${meter.overagePriceUsd.toFixed(meter.overagePriceUsd < 0.01 ? 4 : 2)} per unit</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
