import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  experimental: {
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
