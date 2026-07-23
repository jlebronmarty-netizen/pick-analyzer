import 'server-only'

type AiPerformanceCenterOptions = {
  sportKey?: string | null
  dryRun?: boolean
}

export async function getSportsDataIoNbaIntegrationReadinessLazy() {
  const { getSportsDataIoNbaIntegrationReadiness } = await import(
    '@/services/sportsdataio-nba-integration-readiness.service'
  )

  return getSportsDataIoNbaIntegrationReadiness()
}

export async function getAiPerformanceCenterLazy(options: AiPerformanceCenterOptions = {}) {
  const { getAiPerformanceCenter } = await import('@/services/ai-performance-center.service')

  return getAiPerformanceCenter(options)
}

export async function getAiPerformanceCenterDailyUpdateLazy(
  options: { dryRun?: boolean; validationMode?: boolean } = {}
) {
  const { getAiPerformanceCenterDailyUpdate } = await import('@/services/ai-performance-center.service')

  return getAiPerformanceCenterDailyUpdate(options)
}

export async function validateAiBrainLazy() {
  const { validateAiBrain } = await import('@/services/ai-performance-center.service')

  return validateAiBrain()
}

export async function loadSportsDataIoHistoricalImportReadiness() {
  return import('@/services/sportsdataio-historical-import-readiness.service')
}

export async function loadAutonomousDailyOperations() {
  return import('@/services/autonomous-daily-operations.service')
}

export async function loadAdaptiveRefreshOrchestrator() {
  return import('@/services/adaptive-refresh-orchestrator.service')
}

export async function loadMlbMarketExpansionRoadmap() {
  return import('@/services/mlb-market-expansion-roadmap.service')
}

export async function loadMlbOperationsCenter() {
  return import('@/services/mlb-operations-center.service')
}

export async function loadMlbTemporalHealth() {
  return import('@/services/mlb-temporal-health.service')
}

export async function loadOperationsHealth() {
  return import('@/services/operations-health.service')
}

export async function getProductionReadinessAuditLazy() {
  const { getProductionReadinessAudit } = await import('@/services/production-readiness-audit.service')

  return getProductionReadinessAudit()
}

export async function getRuntimeObservabilityLazy() {
  const { getRuntimeObservability } = await import('@/services/runtime-observability.service')

  return getRuntimeObservability()
}

export async function loadDashboardService() {
  return import('@/services/dashboard.service')
}

export async function loadDashboardTodayService() {
  return import('@/services/dashboard-today.service')
}

export async function loadOperatingDayService() {
  return import('@/services/operating-day.service')
}

export async function loadNbaPredictionEngine() {
  return import('@/services/nba-prediction-engine.service')
}

export async function loadNbaPredictionSettlement() {
  return import('@/services/nba-prediction-settlement.service')
}

export async function loadBsnCoreCertification() {
  return import('@/services/bsn-core-certification.service')
}

export async function loadBsnModelMaturity() {
  return import('@/services/bsn-model-maturity.service')
}
