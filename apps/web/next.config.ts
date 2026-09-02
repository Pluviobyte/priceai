import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@price-radar/classifier",
    "@price-radar/ranking",
    "@price-radar/schema",
  ],
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
