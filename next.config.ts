import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 50,
    memoryBasedWorkersCount: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && isServer) {
      config.optimization.minimize = false;
    }

    return config;
  },
};

export default nextConfig;
