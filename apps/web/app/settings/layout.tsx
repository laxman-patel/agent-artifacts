import type { ReactNode } from "react";
import { AppShell } from "../components/app-shell";
import { SettingsNav } from "./components/settings-nav";
import "../workbench.css";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell loginNext="/settings/account">
      <div className="mx-auto w-full max-w-[880px] px-6 pb-24 pt-14 sm:px-10 lg:pt-12">
        <SettingsNav />
        {children}
      </div>
    </AppShell>
  );
}
