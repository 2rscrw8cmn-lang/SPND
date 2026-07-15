import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    typedEnv: true,
  },
};

export default nextConfig;
