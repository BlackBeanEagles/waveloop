import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-rendered images read these font files from disk; make sure Vercel bundles them.
  outputFileTracingIncludes: {
    "/api/og/[code]": ["./src/assets/fonts/**"],
    "/opengraph-image": ["./src/assets/fonts/**"],
    "/twitter-image": ["./src/assets/fonts/**"],
  },
};

export default nextConfig;
