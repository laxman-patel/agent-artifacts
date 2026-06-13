import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function docsLayoutOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2 font-mono text-[13px] font-semibold uppercase tracking-[0.045em]">
          <img src="/brand/artifacts-logo.svg" alt="" className="size-[18px]" />
          ARTIFACTS
        </span>
      ),
      url: "/"
    },
    links: [
      {
        text: "Pricing",
        url: "/pricing"
      },
      {
        text: "GitHub",
        url: "https://github.com/laxman-patel/agent-artifacts",
        external: true
      }
    ]
  };
}
