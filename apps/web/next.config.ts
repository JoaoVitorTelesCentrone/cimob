import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@c1imob/ui", "@c1imob/three"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
