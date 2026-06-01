import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieHeader, fetchWorkspaces } from "../../lib/server-api";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect("/login?next=/dashboard");
  }

  if (!workspacesResult.ok) {
    throw new Error(workspacesResult.message ?? "Workspaces could not be loaded.");
  }

  const personal = workspacesResult.body.workspaces.find((workspace) => workspace.kind === "personal");
  const target = personal ?? workspacesResult.body.workspaces[0];

  if (!target) {
    redirect("/settings/account");
  }

  redirect(`/dashboard/${target.slug}`);
}
