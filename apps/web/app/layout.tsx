import type { Metadata } from "next";
import { BetterStackWebVitals } from "@logtail/next/webVitals";
import {
  genericOpenGraphMetadata,
  publicAppUrl,
  SITE_DESCRIPTION,
  SITE_TITLE
} from "../lib/site-metadata";
import { SiteHeader } from "./components/site-header";
import "./styles.css";
import "./tailwind.css";

const defaultSocialMetadata = genericOpenGraphMetadata("/");

export const metadata: Metadata = {
  metadataBase: new URL(publicAppUrl()),
  title: {
    default: SITE_TITLE,
    template: "Artifacts | %s"
  },
  description: SITE_DESCRIPTION,
  ...defaultSocialMetadata,
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
