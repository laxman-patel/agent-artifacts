import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CliLoginAuthorize } from "./cli-login-authorize";

interface CliLoginPageProps {
  searchParams: Promise<{ port?: string; state?: string }>;
}

function isValidPort(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const port = Number.parseInt(value, 10);
  return Number.isInteger(port) && port >= 1024 && port <= 65_535;
}

function isValidState(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value);
}

export default async function CliLoginPage({ searchParams }: CliLoginPageProps) {
  const params = await searchParams;
  const port = params.port;
  const state = params.state;

  if (!isValidPort(port) || !isValidState(state)) {
    return (
      <main className="shell narrow">
        <section className="card">
          <h1>CLI sign-in</h1>
          <p className="error">Invalid CLI login request. Run `artifacts login` from your terminal.</p>
        </section>
      </main>
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("better-auth.session_token")?.value;

  const nextPath = `/cli/login?port=${encodeURIComponent(port)}&state=${encodeURIComponent(state)}`;

  if (!sessionToken) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <CliLoginAuthorize port={port} state={state} />;
}
