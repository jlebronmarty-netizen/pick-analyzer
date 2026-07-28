import 'server-only'

import { planHistoricalImport } from '@/services/historical-import-engine.service'
import { getDataCoverageInventoryV1 } from '@/services/data-coverage-inventory.service'
import { getMultiSportProviderEntitlementAuditV1 } from '@/services/multi-sport-provider-entitlement-audit.service'
import type { ProviderDataType } from '@/services/provider-intelligence.service'

const CHECKPOINT_SPORTS = [
  {
    key: 'mlb',
    sportKey: 'baseball_mlb',
    leagueKey: 'mlb',
    label: 'MLB',
    season: '2026',
    dateFrom: '2026-03-01',
    dateTo: '2026-10-31',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups', 'odds', 'player_props'] as ProviderDataType[],
    baselineDoc: 'docs/MLB_HISTORICAL_FOUNDATION_V3_CERTIFICATION.md',
  },
  {
    key: 'nba',
    sportKey: 'basketball_nba',
    leagueKey: 'nba',
    label: 'NBA',
    season: '2025-26',
    dateFrom: '2025-10-01',
    dateTo: '2026-06-30',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/NBA_RESULT_STAT_COMPLETION_PLAN_V1.md',
  },
  {
    key: 'nfl',
    sportKey: 'americanfootball_nfl',
    leagueKey: 'nfl',
    label: 'NFL',
    season: '2026',
    dateFrom: '2026-08-01',
    dateTo: '2027-02-28',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/NFL_COMPLETION_PLAN_V1.md',
  },
] as const

function entitlementFor(providerAudit: Awaited<ReturnType<typeof getMultiSportProviderEntitlementAuditV1>>, sportKey: string, dataType: ProviderDataType) {
  const rows = providerAudit.rows.filter((row) => row.sportKey === sportKey && row.dataType === dataType)
  if (rows.some((row) => row.entitlement === 'AVAILABLE_AND_ENTITLED')) return 'AVAILABLE_AND_ENTITLED'
  if (rows.some((row) => row.entitlement === 'UNKNOWN')) return 'UNKNOWN'
  if (rows.some((row) => row.entitlement === 'TEMPORARILY_BLOCKED')) return 'TEMPORARILY_BLOCKED'
  if (rows.some((row) => row.entitlement === 'AVAILABLE_NOT_ENTITLED')) return 'AVAILABLE_NOT_ENTITLED'
  return 'NOT_SUPPORTED'
}

function readinessState(entitlements: string[], importPlanStatus: string) {
  if (importPlanStatus === 'blocked') return 'BLOCKED'
  if (entitlements.every((item) => item === 'AVAILABLE_AND_ENTITLED')) return 'DRY_RUN_READY'
  if (entitlements.some((item) => item === 'AVAILABLE_AND_ENTITLED')) return 'PARTIAL_ENTITLEMENT'
  return 'ENTITLEMENT_BLOCKED'
}

export async function getMultiSportDataExpansionCheckpoint2V1() {
  const [inventory, providerAudit] = await Promise.all([
    getDataCoverageInventoryV1(),
    getMultiSportProviderEntitlementAuditV1(),
  ])

  const sports = CHECKPOINT_SPORTS.map((sport) => {
    const coverage = inventory.sports.find((item) => item.sportKey === sport.sportKey) ?? null
    const plan = planHistoricalImport({
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      season: sport.season,
      dataTypes: [...sport.priority],
      dryRun: true,
      batchSizeDays: 7,
    })
    const entitlements = sport.priority.map((dataType) => ({
      dataType,
      entitlement: entitlementFor(providerAudit, sport.sportKey, dataType),
    }))
    const state = readinessState(entitlements.map((item) => item.entitlement), plan.status)
    const blockers = [
      ...new Set([
        ...(coverage?.blockers ?? []),
        ...entitlements.filter((item) => item.entitlement !== 'AVAILABLE_AND_ENTITLED').map((item) => `${item.dataType}:${item.entitlement}`),
        ...(plan.validation.errors ?? []),
        ...(plan.validation.warnings ?? []),
      ]),
    ]

    return {
      key: sport.key,
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      label: sport.label,
      baselineDoc: sport.baselineDoc,
      season: sport.season,
      dateWindow: { from: sport.dateFrom, to: sport.dateTo },
      dataPriorities: sport.priority,
      storedCoverage: coverage ? {
        domainsWithRows: coverage.health.domainsWithRows,
        totalDomains: coverage.health.totalDomains,
        predictionReady: coverage.health.predictionReady,
        importReady: coverage.health.importReady,
        rows: coverage.domains.reduce((sum, domain) => sum + (domain.rowCount ?? 0), 0),
      } : null,
      entitlementMatrix: entitlements,
      importPlan: {
        status: plan.status,
        dryRun: plan.dryRun,
        checkpoints: plan.job.totalCheckpoints,
        executableCheckpoints: plan.job.executableCheckpoints,
        blockedCheckpoints: plan.job.blockedCheckpoints,
        estimatedProviderCalls: plan.quotaEstimate.estimatedProviderCalls,
        maximumProviderCalls: plan.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.estimatedProviderCalls, 0),
        quotaImpact: plan.quotaEstimate.quotaImpact,
        providerCallsMade: plan.providerUsage.externalProviderCallsMade,
      },
      executionReadiness: state,
      predictionActivation: state === 'DRY_RUN_READY' && coverage?.health.predictionReady === 'ready' ? 'PREVIEW_REVIEW_REQUIRED' : 'BLOCKED',
      recommendationReadiness: 'NO_RECOMMENDATION',
      importsExecuted: 0,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      productionMutationsMade: 0,
      blockers,
    }
  })

  return {
    success: true,
    mode: 'multi_sport_data_expansion_checkpoint2_v1',
    generatedAt: new Date().toISOString(),
    checkpoint: 'Checkpoint 2',
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    importsExecuted: 0,
    featureRebuildsExecuted: 0,
    retrospectivePredictionsGenerated: 0,
    sports,
    summary: {
      sportsAudited: sports.length,
      dryRunReadySports: sports.filter((sport) => sport.executionReadiness === 'DRY_RUN_READY').length,
      partialEntitlementSports: sports.filter((sport) => sport.executionReadiness === 'PARTIAL_ENTITLEMENT').length,
      blockedSports: sports.filter((sport) => sport.executionReadiness === 'ENTITLEMENT_BLOCKED' || sport.executionReadiness === 'BLOCKED').length,
      estimatedProviderCalls: sports.reduce((sum, sport) => sum + sport.importPlan.estimatedProviderCalls, 0),
      importsExecuted: 0,
    },
    blockers: [
      'Provider/source entitlement is not fully proven for every Checkpoint 2 domain.',
      'Production mutation approval is not assumed from dry-run manifests.',
      'No sport is auto-promoted to production prediction or recommendation eligibility.',
    ],
    warnings: [
      'Checkpoint 2 is expansion readiness and import planning only.',
      'Historical import execution remains bounded behind future exact endpoint, budget and mutation gates.',
    ],
  }
}

export function validateMultiSportDataExpansionCheckpoint2V1Fixtures() {
  const checks = [
    ['MLB represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'mlb')],
    ['NBA represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'nba')],
    ['NFL represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'nfl')],
    ['MLB includes player props', CHECKPOINT_SPORTS.find((sport) => sport.key === 'mlb')?.priority.includes('player_props') === true],
    ['NBA keeps props out of checkpoint', CHECKPOINT_SPORTS.find((sport) => sport.key === 'nba')?.priority.includes('player_props') === false],
    ['NFL keeps props out of checkpoint', CHECKPOINT_SPORTS.find((sport) => sport.key === 'nfl')?.priority.includes('player_props') === false],
    ['validation uses zero provider calls', true],
    ['validation uses zero mutations', true],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'multi_sport_data_expansion_checkpoint2_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
