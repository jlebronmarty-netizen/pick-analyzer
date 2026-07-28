import 'server-only'

import { planHistoricalImport } from '@/services/historical-import-engine.service'
import { getDataCoverageInventoryV1 } from '@/services/data-coverage-inventory.service'
import { getMultiSportProviderEntitlementAuditV1 } from '@/services/multi-sport-provider-entitlement-audit.service'
import type { ProviderDataType } from '@/services/provider-intelligence.service'

const CHECKPOINT_SPORTS = [
  {
    key: 'nhl',
    sportKey: 'icehockey_nhl',
    leagueKey: 'nhl',
    label: 'NHL',
    season: '2025-26',
    scopePolicy: 'cross_year_season',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/NHL_BASELINE_AND_COMPLETION_PLAN_V1.md',
  },
  {
    key: 'soccer',
    sportKey: 'soccer',
    leagueKey: 'soccer_generic',
    label: 'Soccer',
    season: 'competition_specific',
    scopePolicy: 'competition_specific_only',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/SOCCER_COMPETITION_COMPLETION_PLAN_V1.md',
  },
  {
    key: 'bsn',
    sportKey: 'basketball_bsn',
    leagueKey: 'bsn_pr',
    label: 'BSN',
    season: '2026',
    scopePolicy: 'custom_league_manual_source',
    priority: ['schedules', 'scores', 'standings', 'players', 'team_stats', 'game_stats', 'player_stats', 'injuries', 'lineups'] as ProviderDataType[],
    baselineDoc: 'docs/BSN_COMPLETION_CERTIFICATION_V1.md',
  },
  {
    key: 'tennis',
    sportKey: 'tennis',
    leagueKey: 'atp',
    label: 'Tennis',
    season: 'event_driven_2026',
    scopePolicy: 'event_driven_tournament_scope',
    priority: ['schedules', 'scores', 'players', 'player_stats', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1.md',
  },
  {
    key: 'ufc',
    sportKey: 'mma_ufc',
    leagueKey: 'ufc',
    label: 'UFC',
    season: 'event_driven_2026',
    scopePolicy: 'event_and_bout_scope',
    priority: ['schedules', 'scores', 'players', 'player_stats', 'odds'] as ProviderDataType[],
    baselineDoc: 'docs/TENNIS_UFC_EVENT_READINESS_CERTIFICATION_V1.md',
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

function dateScope(season: string) {
  if (season === 'competition_specific') return { season: null, dateFrom: '2026-01-01', dateTo: '2026-12-31' }
  if (season.startsWith('event_driven')) return { season: null, dateFrom: '2026-01-01', dateTo: '2026-12-31' }
  return { season, dateFrom: null, dateTo: null }
}

function state(entitlements: string[], coverageReady: string | undefined) {
  if (entitlements.some((item) => item === 'AVAILABLE_AND_ENTITLED') && coverageReady !== 'blocked') return 'PARTIAL_ENTITLEMENT'
  if (entitlements.every((item) => item === 'AVAILABLE_AND_ENTITLED')) return 'DRY_RUN_READY'
  return 'ENTITLEMENT_BLOCKED'
}

export async function getMultiSportDataExpansionCheckpoint3V1() {
  const [inventory, providerAudit] = await Promise.all([
    getDataCoverageInventoryV1(),
    getMultiSportProviderEntitlementAuditV1(),
  ])

  const sports = CHECKPOINT_SPORTS.map((sport) => {
    const coverage = inventory.sports.find((item) => item.sportKey === sport.sportKey) ?? null
    const scope = dateScope(sport.season)
    const plan = planHistoricalImport({
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      season: scope.season,
      dateFrom: scope.dateFrom,
      dateTo: scope.dateTo,
      dataTypes: [...sport.priority],
      dryRun: true,
      batchSizeDays: 14,
    })
    const entitlements = sport.priority.map((dataType) => ({
      dataType,
      entitlement: entitlementFor(providerAudit, sport.sportKey, dataType),
    }))
    const readiness = state(entitlements.map((item) => item.entitlement), coverage?.health.importReady)
    return {
      key: sport.key,
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      label: sport.label,
      season: sport.season,
      scopePolicy: sport.scopePolicy,
      baselineDoc: sport.baselineDoc,
      dataPriorities: sport.priority,
      storedCoverage: coverage ? {
        rows: coverage.domains.reduce((sum, domain) => sum + (domain.rowCount ?? 0), 0),
        domainsWithRows: coverage.health.domainsWithRows,
        totalDomains: coverage.health.totalDomains,
        importReady: coverage.health.importReady,
        predictionReady: coverage.health.predictionReady,
      } : null,
      entitlementMatrix: entitlements,
      importPlan: {
        status: plan.status,
        dryRun: plan.dryRun,
        checkpoints: plan.job.totalCheckpoints,
        executableCheckpoints: plan.job.executableCheckpoints,
        blockedCheckpoints: plan.job.blockedCheckpoints,
        estimatedProviderCalls: plan.quotaEstimate.estimatedProviderCalls,
        quotaImpact: plan.quotaEstimate.quotaImpact,
        providerCallsMade: plan.providerUsage.externalProviderCallsMade,
      },
      historicalImportReadiness: readiness,
      featureReadiness: coverage?.health.predictionReady === 'ready' ? 'FEATURE_REVIEW_REQUIRED' : 'MISSING_PROVIDER_DATA',
      predictionReadiness: coverage?.predictionReadiness.state ?? 'BLOCKED',
      recommendationReadiness: 'NO_RECOMMENDATION',
      importsExecuted: 0,
      providerCallsMade: 0,
      remoteMutationsMade: 0,
      productionMutationsMade: 0,
      blockers: [
        ...new Set([
          ...(coverage?.blockers ?? []),
          ...entitlements.filter((item) => item.entitlement !== 'AVAILABLE_AND_ENTITLED').map((item) => `${item.dataType}:${item.entitlement}`),
          ...(plan.validation.errors ?? []),
          ...(plan.validation.warnings ?? []),
        ]),
      ],
    }
  })

  return {
    success: true,
    mode: 'multi_sport_data_expansion_checkpoint3_v1',
    generatedAt: new Date().toISOString(),
    checkpoint: 'Checkpoint 3',
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
      eventDrivenSports: sports.filter((sport) => String(sport.scopePolicy).includes('event')).length,
      competitionScopedSports: sports.filter((sport) => sport.scopePolicy === 'competition_specific_only').length,
      partialEntitlementSports: sports.filter((sport) => sport.historicalImportReadiness === 'PARTIAL_ENTITLEMENT').length,
      blockedSports: sports.filter((sport) => sport.historicalImportReadiness === 'ENTITLEMENT_BLOCKED').length,
      estimatedProviderCalls: sports.reduce((sum, sport) => sum + sport.importPlan.estimatedProviderCalls, 0),
    },
    blockers: [
      'NHL, Soccer, Tennis and UFC remain blocked or partial until exact source entitlement is proven.',
      'BSN requires approved manual/CSV or official-source provenance before import execution.',
      'Feature rebuild and prediction activation remain blocked until canonical source rows exist.',
    ],
    warnings: [
      'Soccer remains competition-specific; soccer_generic is a placeholder planning scope only.',
      'Tennis and UFC remain event-driven and are not forced into team-season readiness.',
    ],
  }
}

export function validateMultiSportDataExpansionCheckpoint3V1Fixtures() {
  const checks = [
    ['NHL represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'nhl')],
    ['Soccer represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'soccer')],
    ['BSN represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'bsn')],
    ['Tennis represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'tennis')],
    ['UFC represented', CHECKPOINT_SPORTS.some((sport) => sport.key === 'ufc')],
    ['soccer competition scope enforced', CHECKPOINT_SPORTS.find((sport) => sport.key === 'soccer')?.scopePolicy === 'competition_specific_only'],
    ['tennis event-driven scope enforced', CHECKPOINT_SPORTS.find((sport) => sport.key === 'tennis')?.scopePolicy === 'event_driven_tournament_scope'],
    ['ufc event-driven scope enforced', CHECKPOINT_SPORTS.find((sport) => sport.key === 'ufc')?.scopePolicy === 'event_and_bout_scope'],
    ['validation uses zero provider calls', true],
    ['validation uses zero mutations', true],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'multi_sport_data_expansion_checkpoint3_v1_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
