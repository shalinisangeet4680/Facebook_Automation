import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  devIndicators: { position: "bottom-right" },
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/mcp", destination: `${backendUrl}/mcp` },
      { source: "/media/:key", destination: `${backendUrl}/media/:key` },
      { source: "/.well-known/:path*", destination: `${backendUrl}/.well-known/:path*` },
      { source: "/oauth/token", destination: `${backendUrl}/oauth/token` },
      { source: "/oauth/register", destination: `${backendUrl}/oauth/register` },
      { source: "/oauth/revoke", destination: `${backendUrl}/oauth/revoke` },
    ];
  },
};

export default nextConfig;
