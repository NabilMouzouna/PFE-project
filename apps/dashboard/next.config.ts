import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@appbase-pfe/types", "@appbase-pfe/sdk"],
};

export default nextConfig;
