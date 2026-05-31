import type { Metadata } from "next";
import { BetterStackWebVitals } from "@logtail/next/webVitals";
import { SiteHeader } from "./components/site-header";
import "./styles.css";
import "./tailwind.css";

export const metadata: Metadata = {
  title: {
    default: "Artifacts | Agent-native artifact hosting",
    template: "Artifacts | %s"
  },
  description:
    "Publish HTML reports, Markdown specs, JSX prototypes, and agent-built tools with permanent URLs, immutable versions, access control, and MCP automation.",
  icons: {
    icon: [{ url: "/brand/artifacts-logo.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/brand/artifacts-logo.svg", type: "image/svg+xml" }]
  }
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
