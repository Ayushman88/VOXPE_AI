import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@voxpe/db-banking'],
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
