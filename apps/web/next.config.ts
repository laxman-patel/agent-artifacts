import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";

const securityHeaders = [
  { key: "x-content-type-options", value: "nosniff" },
  { key: "x-frame-options", value: "SAMEORIGIN" },
  { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
  { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "content-security-policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
