import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import "../workbench.css";

export default function TeamsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell loginNext="/teams/new">
      {children}
    </AppShell>
  );
}
