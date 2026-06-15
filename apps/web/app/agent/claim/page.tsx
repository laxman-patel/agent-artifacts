import { readSessionCookie } from "@agent-artifacts/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AgentClaimConfirm } from "./agent-claim-confirm";

interface AgentClaimPageProps {
  searchParams: Promise<{ user_code?: string }>;
}

function isValidUserCode(value: string | undefined): value is string {
  return typeof value === "string" && /^[A-F0-9]{8}$/i.test(value);
}

export default async function AgentClaimPage({ searchParams }: AgentClaimPageProps) {
  const params = await searchParams;
  const userCode = params.user_code?.trim().toUpperCase();

  if (!isValidUserCode(userCode)) {
    return (
      <main className="shell narrow">
        <section className="card">
          <h1>Claim agent</h1>
          <p className="error">Invalid agent claim request. Ask the agent to start the auth.md flow again.</p>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  const sessionToken = readSessionCookie(cookieStore);
  const nextPath = `/agent/claim?user_code=${encodeURIComponent(userCode)}`;

  if (!sessionToken) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <AgentClaimConfirm userCode={userCode} />;
}
