import type { NextConfig } from "next";
import fs from 'node:fs';

const mlbCertificates=['docs/CERTIFICATION/MLB_DATA_02R_R2T_R3_LIVE_REENABLEMENT_CERTIFICATION.json','docs/CERTIFICATION/MLB_PRE_NONEMPTY_LIVE_READINESS.json'];
const mlbRuntimeFiles=[...new Set([...mlbCertificates,...mlbCertificates.flatMap(file=>Object.keys(JSON.parse(fs.readFileSync(file,'utf8')).sourceHashes??{})),'docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json'])].map(file=>`./${file}`);

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
    '/api/cron/mlb-operational': mlbRuntimeFiles,
    '/': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'],
    '/today': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'],
    '/mlb-value-board': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'],
    '/api/mlb/operations': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json'],
    '/data-health': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json', './docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json', './docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json'],
    '/api/mlb/operations/health': ['./docs/CERTIFICATION/mlb-data-02p-official-pick-policy-prep.json', './docs/CERTIFICATION/MLB_OPERATIONAL_MISSION_STATUS.json', './docs/CERTIFICATION/MLB_OPERATIONAL_AUTOMATION_ACTIVATION.json'],
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
