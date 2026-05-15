import type { Metadata } from "next";
import Link from "next/link";
import { SessionNav } from "./components/session-nav";
import "./styles.css";

export const metadata: Metadata = {
  title: "Agent Artifacts",
  description: "Versioned, access-controlled artifact hosting for humans and agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="site-body">
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand" href="/">
              Agent Artifacts
            </Link>
            <SessionNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
