import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ClaimUsernameForm } from "../../components/claim-username-form";
import { cookieHeader, fetchProfileMe } from "../../../lib/server-api";

export default async function AccountSettingsPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const profile = await fetchProfileMe(header);

  if (!profile.ok || !profile.body) {
    redirect("/login?next=/settings/account");
  }

  const { user, profile: profileRow } = profile.body;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Profile</h1>
          <p className="subtle">Signed in as {user.email}</p>
        </div>
        <Link className="ghost-button" href="/dashboard">
          Dashboard
        </Link>
        <Link className="ghost-button" href="/settings/billing">
          Billing
        </Link>
      </header>

      <section className="card flat stack">
        <div>
          <h2>Username namespace</h2>
          <p className="muted">Claim once to unlock URLs shaped like /you/slug.</p>
          {profileRow ? (
            <p className="pill success">
              Active username · <strong>{profileRow.username}</strong>
            </p>
          ) : (
            <ClaimUsernameForm />
          )}
        </div>
      </section>
    </main>
  );
}
