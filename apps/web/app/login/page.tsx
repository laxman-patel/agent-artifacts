import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="shell narrow">
          <p className="muted">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
