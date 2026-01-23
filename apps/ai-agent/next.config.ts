import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@voxpe/db-ai'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
};

export default nextConfig;
