import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@voxpe/db-ai'],
  serverExternalPackages: ['@prisma/client'],
};

export default nextConfig;
