import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@c1imob/ui", "@c1imob/three", "@c1imob/core", "@c1imob/reports"],
  // DuckDB (relatório mensal, T4.6) é binário nativo: fica fora do bundle e roda direto no Node.
  serverExternalPackages: ["@duckdb/node-api"],
  cacheComponents: true,
  partialPrefetching: true,
  // PDF da incorporadora (T4.5) passa pela Server Action e pelo proxy: mesmo limite do services/ingest.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
    proxyClientMaxBodySize: "20mb",
  },
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
