import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
        <div className="row-actions">
          <Link className="ghost-button" href="/dashboard">
            Dashboard
          </Link>
          <Link className="ghost-button" href="/settings/billing">
            Billing
          </Link>
        </div>
      </header>

      <section className="card flat stack">
        <div>
          <h2>Username namespace</h2>
          <p className="muted">Claimed once at signup. Unlocks URLs shaped like /you/slug.</p>
          {profileRow ? (
            <p className="pill success">
              Active username · <strong>{profileRow.username}</strong>
            </p>
          ) : (
            <div className="stack tight">
              <p className="muted">Your account does not have a namespace yet.</p>
              <Link className="primary-button" href="/login?mode=signup&next=/settings/account">
                Finish signup
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
