import { loadMonorepoEnv } from "../../packages/config/src/load-monorepo-env";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

loadMonorepoEnv();

const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";
const isDev = process.env.NODE_ENV === "development";

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
      "connect-src 'self'",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'"
    ].join("; ")
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
