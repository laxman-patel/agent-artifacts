import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Agent Artifacts",
  description: "Versioned, access-controlled artifact hosting for humans and agents."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
