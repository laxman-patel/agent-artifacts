import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiKeysManager } from "../../components/api-keys-manager";
import { cookieHeader, fetchApiKeys } from "../../../lib/server-api";

export default async function ApiKeysSettingsPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const keys = await fetchApiKeys(header);

  if (!keys.ok && (keys.status === 401 || keys.status === 403)) {
    redirect("/login?next=/settings/keys");
  }
  if (!keys.ok) {
    throw new Error(keys.message);
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            API keys
          </h1>
          <p className="mt-3 text-sm text-foreground/50">
            Create scoped keys for CLI use, agents, and automation.
          </p>
        </div>
        <Link className="ghost-button" href="/settings/account">
          Account
        </Link>
      </header>

      <ApiKeysManager initialApiKeys={keys.body.apiKeys} />
    </main>
  );
}
