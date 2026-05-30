import type { Metadata } from "next";
import { BetterStackWebVitals } from "@logtail/next/webVitals";
import { SiteHeader } from "./components/site-header";
import "./styles.css";
import "./tailwind.css";

export const metadata: Metadata = {
  title: "Artifacts: Agent-native artifact hosting",
  description:
    "Publish HTML reports, Markdown specs, JSX prototypes, and agent-built tools with permanent URLs, immutable versions, access control, and MCP automation."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="site-body">
        <BetterStackWebVitals />
        <div className="site-shell">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
