// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark native packages as external - they'll be loaded at runtime, not bundled
  serverExternalPackages: ["@napi-rs/canvas"],

  // Webpack configuration for handling native modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't try to bundle native .node files
      config.externals = config.externals || [];
      config.externals.push({
        "@napi-rs/canvas": "commonjs @napi-rs/canvas",
      });
    }

    // Ignore .node binary files
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
      type: "javascript/auto",
    });

    return config;
  },

  // Disable static optimization for API routes using native modules
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;