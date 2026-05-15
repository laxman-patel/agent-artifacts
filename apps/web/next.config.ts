import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const internalApiUrl = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${internalApiUrl.replace(/\/+$/, "")}/api/:path*`
        }
      ]
    };
  },
  turbopack: {
    root: fileURLToPath(new URL("../..", import.meta.url))
  }
};

export default nextConfig;
