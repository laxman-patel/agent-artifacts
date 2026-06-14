import { withBetterStack } from "@logtail/next";
import { loadMonorepoEnv } from "../../packages/config/src/load-monorepo-env";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

loadMonorepoEnv();

if (process.env.BETTER_STACK_WEB_SOURCE_TOKEN && !process.env.BETTER_STACK_SOURCE_TOKEN) {
  process.env.BETTER_STACK_SOURCE_TOKEN = process.env.BETTER_STACK_WEB_SOURCE_TOKEN;
}

const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";
const isDev = process.env.NODE_ENV === "development";

function betterStackConnectSrc(): string {
  const ingestUrl = process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_URL;
  if (ingestUrl) {
    try {
      return `https://${new URL(ingestUrl).hostname}`;
    } catch {
      // fall through
    }
  }

  return "https://*.betterstackdata.com";
}

const securityHeaders = [
  { key: "x-content-type-options", value: "nosniff" },
  { key: "x-frame-options", value: "SAMEORIGIN" },
  { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
  { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "content-security-policy",
    value: [
      "default-src 'self'",
      // React dev tooling needs eval(); production builds do not.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      `connect-src 'self' ${betterStackConnectSrc()}`,
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'"
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: process.env.CI === "true",
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: securityHeaders
      }
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/.well-known/oauth-protected-resource",
          destination: `${internalApiUrl.replace(/\/+$/, "")}/.well-known/oauth-protected-resource`
        },
        {
          source: "/.well-known/oauth-authorization-server",
          destination: `${internalApiUrl.replace(/\/+$/, "")}/.well-known/oauth-authorization-server`
        },
        {
          source: "/api/:path*",
          destination: `${internalApiUrl.replace(/\/+$/, "")}/api/:path*`
        },
        {
          source: "/mcp",
          destination: `${internalApiUrl.replace(/\/+$/, "")}/mcp`
        }
      ]
    };
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url))
  }
};

export default withBetterStack(nextConfig);
