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
    <main className="mx-auto w-full max-w-[980px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 border-b border-[var(--wb-line)] pb-6">
        <div>
          <h1 className="font-pixel text-[2rem] font-normal leading-none tracking-[-0.045em] text-foreground/95">
            Account settings
          </h1>
          <p className="mt-3 text-sm text-foreground/50">Signed in as {user.email}</p>
        </div>
      </header>

      <section className="card flat stack">
        <div className="section-header">
          <h2>Username namespace</h2>
          <p className="muted">Claimed once at signup. Unlocks URLs shaped like /you/slug.</p>
        </div>
        <div>
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
