import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";

import { docsLayoutOptions } from "@/lib/docs-layout";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={source.pageTree} {...docsLayoutOptions()}>
      {children}
    </DocsLayout>
  );
}
