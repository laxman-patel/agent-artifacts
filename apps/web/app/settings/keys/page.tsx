import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiKeysManager } from "../../components/api-keys-manager";
import { cookieHeader, fetchApiKeys } from "../../../lib/server-api";
import { SettingsHeader } from "../components/settings-chrome";

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
    <>
      <SettingsHeader
        title="API keys"
        description="Scoped keys authenticate the CLI, agents, and automation. Tokens are shown once at creation."
      />
      <ApiKeysManager initialApiKeys={keys.body.apiKeys} />
    </>
  );
}
