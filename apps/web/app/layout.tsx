import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BetterStackWebVitals } from "@logtail/next/webVitals";
import { SessionNav } from "./components/session-nav";
import { cookieHeader, fetchWorkspaces } from "../lib/server-api";
import "./styles.css";

export const metadata: Metadata = {
  title: "Agent Artifacts",
  description: "Versioned, access-controlled artifact hosting for humans and agents."
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);
  const workspaces = workspacesResult.ok ? workspacesResult.body.workspaces : [];

  return (
    <html lang="en">
      <body className="site-body">
        <BetterStackWebVitals />
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand" href="/">
              Agent Artifacts
            </Link>
            <SessionNav workspaces={workspaces} />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
