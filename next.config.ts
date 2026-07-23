import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 50,
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig;
