import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@supabase/supabase-js'],
  experimental: {
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 50,
    memoryBasedWorkersCount: true,
  },
  outputFileTracingIncludes: {
    '/api/system/pick2/r1f-manifest-authority': [
      './config/pick2/mlb/r1f-deployment-certification-manifest.json',
      './docs/CERTIFICATION/mlb-data-01c-r5b-2025-native-identity-backfill.json',
      './docs/CERTIFICATION/mlb-data-01d-2025-feature-build-dry-run.json',
      './scripts/mlb-data-01d-2025-feature-persistence.mjs',
    ],
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && isServer) {
      config.optimization.minimize = false;
    }

    return config;
  },
};

export default nextConfig;
