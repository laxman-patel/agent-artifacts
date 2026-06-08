import { redirect } from "next/navigation";

export default async function WorkspaceInvitePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  redirect(`/team-invite/${encodeURIComponent(token)}`);
}
