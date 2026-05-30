"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceSummary } from "../../lib/server-api";

function workspaceHref(workspace: WorkspaceSummary): string {
  if (workspace.kind === "personal") return "/dashboard";
  return `/w/${workspace.slug}`;
}

function workspaceLabel(workspace: WorkspaceSummary): string {
  if (workspace.kind === "personal") return "Personal";
  return workspace.name;
}

function currentWorkspace(
  workspaces: WorkspaceSummary[],
  pathname: string
): WorkspaceSummary | undefined {
  const teamMatch = pathname.match(/^\/w\/([^/]+)/);
  if (teamMatch) {
    let slug: string;
    try {
      slug = decodeURIComponent(teamMatch[1] ?? "").toLowerCase();
    } catch {
      return undefined;
    }
    return workspaces.find((workspace) => workspace.slug.toLowerCase() === slug);
  }

  if (pathname.startsWith("/dashboard")) {
    return workspaces.find((workspace) => workspace.kind === "personal");
  }

  return undefined;
}

export function WorkspaceSwitcher(props: { workspaces: WorkspaceSummary[] }) {
  const pathname = usePathname();
  const active = currentWorkspace(props.workspaces, pathname);

  if (props.workspaces.length === 0) {
    return null;
  }

  return (
    <details className="workspace-switcher">
      <summary>{active ? workspaceLabel(active) : "Workspaces"}</summary>
      <ul className="workspace-switcher-menu">
        {props.workspaces.map((workspace) => {
          const href = workspaceHref(workspace);
          const isActive =
            (workspace.kind === "personal" && pathname.startsWith("/dashboard")) ||
            active?.id === workspace.id;

          return (
            <li key={workspace.id}>
              <Link className={isActive ? "active" : undefined} href={href}>
                <span>{workspaceLabel(workspace)}</span>
                <span className="muted small">
                  {workspace.kind === "personal" ? "Personal workspace" : `@${workspace.slug}`}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/workspaces/new">
            <span>Create workspace</span>
            <span className="muted small">New team namespace</span>
          </Link>
        </li>
      </ul>
    </details>
  );
}
