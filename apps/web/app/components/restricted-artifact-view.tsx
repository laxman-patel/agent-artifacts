import Link from "next/link";

export function RestrictedArtifactView(props: { message: string; loginHref: string }) {
  return (
    <main className="shell narrow">
      <h1>Restricted artifact</h1>
      <p className="muted">{props.message}</p>
      <Link className="primary-button" href={props.loginHref}>
        Sign in with Google
      </Link>
    </main>
  );
}
