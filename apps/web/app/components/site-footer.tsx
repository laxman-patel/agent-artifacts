import Link from "next/link";

const columns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Features", href: "#features" },
      { label: "Create", href: "#create" },
      { label: "Quotes", href: "#quotes" }
    ]
  },
  {
    heading: "Developers",
    links: [
      { label: "CLI", href: "#how" },
      { label: "MCP server", href: "#how" },
      { label: "REST API", href: "#features" },
      { label: "Sandboxing", href: "#features" }
    ]
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/login" }
    ]
  }
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/60 bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <img src="/brand/artifacts-logo.svg" alt="" className="size-6" />
              <span className="text-base font-semibold tracking-tight text-foreground">Artifacts</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              A home for everything your agents build. Permanent URLs, versions, and access control for the HTML,
              Markdown, and JSX they produce.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="flex flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
                {column.heading}
              </span>
              {column.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm text-foreground/75 transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Artifacts</span>
          <span className="font-mono text-muted-foreground/80">built for humans and agents</span>
        </div>
      </div>
    </footer>
  );
}
