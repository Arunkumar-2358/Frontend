import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "25mb" }, middlewareClientMaxBodySize: "60mb" },
  poweredByHeader: false,
  outputFileTracingRoot: __dirname,
  async rewrites() {
    return [
      // Browser → API through this origin, so the httpOnly session cookie applies and no CORS is needed.
      { source: "/api/v1/:path*", destination: `${API_URL}/v1/:path*` },
      // Legacy webhook URLs already configured at Exotel / the NT platform.
      { source: "/api/webhooks/:path*", destination: `${API_URL}/v1/webhooks/:path*` },
      { source: "/api/telephony/:path*", destination: `${API_URL}/v1/telephony/:path*` },
      { source: "/api/cron/:path*", destination: `${API_URL}/v1/cron/:path*` },
    ];
  },
};

export default nextConfig;
