import Link from "next/link";

const parts = [
  "Foundation",
  "Artifact core",
  "Web experience",
  "MCP experience",
  "Renderers and hardening"
];

export default function HomePage() {
  return (
    <main className="shell hero-layout">
      <section className="hero">
        <p className="eyebrow">Agent Artifact</p>
        <h1>Durable, versioned artifact hosting for agents.</h1>
        <p className="lede">
          Host HTML, Markdown, and React outputs through app-domain links with immutable history and role-aware access.
        </p>
        <div className="hero-actions">
          <Link className="primary-button" href="/dashboard">
            Open dashboard
          </Link>
          <Link className="ghost-button" href="/login">
            Sign in with Google
          </Link>
          <Link className="ghost-button" href="/pricing">
            See pricing
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>Build Plan</h2>
        <ol>
          {parts.map((part, index) => (
            <li key={part}>
              <span>{index + 1}/5</span>
              {part}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
