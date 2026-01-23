import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@voxpe/db-banking'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

export default nextConfig;
