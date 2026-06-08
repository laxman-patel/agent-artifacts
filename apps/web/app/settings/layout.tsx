import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import "../workbench.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell loginNext="/settings/account">
      {children}
    </AppShell>
  );
}
