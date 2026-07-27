import 'server-only'

import { getSportsDataCoverageAuditV2 } from '@/services/data-foundation-coverage.service'

function nowIso() {
  return new Date().toISOString()
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Number((numerator / denominator).toFixed(4))
}

async function baseReport() {
  const coverage = await getSportsDataCoverageAuditV2()
  return { coverage, sports: coverage.sports }
}

function qualityForSport(sport: Awaited<ReturnType<typeof getSportsDataCoverageAuditV2>>['sports'][number]) {
  const required = ['teams', 'events', 'providerMappings']
  const predictionRequired = ['teams', 'events', 'oddsSnapshots', 'providerMappings']
  const requiredPresent = required.filter((key) => (sport.rowCounts[key] ?? 0) > 0).length
  const predictionPresent = predictionRequired.filter((key) => (sport.rowCounts[key] ?? 0) > 0).length
  const duplicateCount = sport.duplicateIndicators.length
  const orphanIndicators = [
    ...(sport.rowCounts.events > 0 && sport.rowCounts.teams === 0 ? ['events_without_team_foundation'] : []),
    ...(sport.rowCounts.predictions > 0 && sport.rowCounts.events === 0 ? ['predictions_without_events'] : []),
    ...(sport.rowCounts.oddsSnapshots > 0 && sport.rowCounts.events === 0 ? ['odds_without_events'] : []),
    ...(sport.rowCounts.playerStatistics > 0 && sport.rowCounts.players === 0 ? ['player_stats_without_players'] : []),
  ]
  return {
    sportKey: sport.sportKey,
    leagueKey: sport.leagueKey,
    label: sport.label,
    coverage: {
      currentSeason: sport.currentSeasonCoverage,
      previousSeason: sport.previousSeasonCoverage,
      completeness: sport.completeness,
      confidence: sport.confidenceInCoverage,
      earliestDate: sport.earliestDate,
      latestDate: sport.latestDate,
    },
    metrics: {
      completenessScore: ratio(requiredPresent, required.length),
      predictionReadinessScore: ratio(predictionPresent, predictionRequired.length),
      missingRequiredFields: sport.missingRequiredFields,
      staleRecords: sport.staleRecords,
      duplicateIndicatorCount: duplicateCount,
      unresolvedIdentities: sport.unresolvedIdentities,
      orphanIndicatorCount: orphanIndicators.length,
    },
    issues: {
      duplicateIndicators: sport.duplicateIndicators,
      orphanIndicators,
      blockers: sport.blockers,
      missingResults: (sport.rowCounts.events ?? 0) > 0 && (sport.rowCounts.results ?? 0) === 0,
      missingStats: (sport.rowCounts.teamStatistics ?? 0) === 0 && (sport.rowCounts.playerStatistics ?? 0) === 0,
      invalidTimestampSamples: sport.tables.filter((table) => table.notes.some((note) => note.toLowerCase().includes('timestamp') || note.toLowerCase().includes('date'))).map((table) => table.key),
    },
  }
}

export async function getDataFoundationQualityV2() {
  const { coverage, sports } = await baseReport()
  const quality = sports.map(qualityForSport)
  return {
    success: true,
    mode: 'global_data_quality_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    quality,
    summary: {
      sportsAudited: quality.length,
      highCompleteness: quality.filter((sport) => sport.coverage.completeness === 'high').length,
      mediumCompleteness: quality.filter((sport) => sport.coverage.completeness === 'medium').length,
      lowOrEmptyCompleteness: quality.filter((sport) => sport.coverage.completeness === 'low' || sport.coverage.completeness === 'empty').length,
      duplicateIndicators: quality.reduce((sum, sport) => sum + sport.metrics.duplicateIndicatorCount, 0),
      orphanIndicators: quality.reduce((sum, sport) => sum + sport.metrics.orphanIndicatorCount, 0),
      unresolvedIdentities: quality.reduce((sum, sport) => sum + sport.metrics.unresolvedIdentities, 0),
      staleRecords: quality.reduce((sum, sport) => sum + sport.metrics.staleRecords, 0),
      totalRowsObserved: coverage.summary.totalRowsObserved,
    },
    warnings: [
      'Quality V2 is read-only and uses stored coverage evidence only.',
      'Missing or empty sports are readiness findings, not fabricated failures.',
      'No reconciliation mutations are performed by this endpoint.',
    ],
  }
}

export async function getDataFoundationReconciliationV2() {
  const report = await getDataFoundationQualityV2()
  const items = report.quality.flatMap((sport) => {
    const rows = []
    if (sport.issues.duplicateIndicators.length) rows.push({ sportKey: sport.sportKey, issue: 'duplicate_indicator', affected: sport.issues.duplicateIndicators, action: 'manual_review_before_persistence' })
    if (sport.issues.orphanIndicators.length) rows.push({ sportKey: sport.sportKey, issue: 'orphan_indicator', affected: sport.issues.orphanIndicators, action: 'reconcile_identity_or_event_foundation' })
    if (sport.issues.missingResults) rows.push({ sportKey: sport.sportKey, issue: 'missing_results', affected: ['game_results'], action: 'approved_result_import_or_csv_contract' })
    if (sport.issues.missingStats) rows.push({ sportKey: sport.sportKey, issue: 'missing_stats', affected: ['sport_game_stats', 'sport_player_stats'], action: 'approved_stats_import_or_contract' })
    if (sport.metrics.unresolvedIdentities > 0) rows.push({ sportKey: sport.sportKey, issue: 'unresolved_identity', affected: ['provider_entity_mappings'], action: 'deterministic_identity_review' })
    return rows
  })
  return {
    success: true,
    mode: 'global_reconciliation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    items,
    summary: {
      sportsAudited: report.summary.sportsAudited,
      reconciliationItems: items.length,
      mutationPlan: 'none_read_only_report',
      providerCallsRequiredNow: 0,
    },
    guardrails: {
      noAutomaticDeletes: true,
      noAutomaticIdentityPersistence: true,
      noProductionMutation: true,
      noProviderCalls: true,
    },
  }
}

export async function getDataFoundationReadinessV2() {
  const report = await getDataFoundationQualityV2()
  const readiness = report.quality.map((sport) => ({
    sportKey: sport.sportKey,
    leagueKey: sport.leagueKey,
    label: sport.label,
    importReadiness: sport.metrics.completenessScore >= 1 ? 'ready' : sport.metrics.completenessScore > 0 ? 'partial' : 'blocked',
    predictionReadiness: sport.metrics.predictionReadinessScore >= 1 ? 'ready' : sport.metrics.predictionReadinessScore > 0 ? 'partial' : 'blocked',
    dataQualityStatus: sport.coverage.completeness,
    blockers: sport.issues.blockers,
    nextSafeAction: sport.metrics.completenessScore >= 1
      ? 'use_plan_only_or_dry_run_orchestrator_for_gap_review'
      : 'document_or_prepare_approved_source_contract',
  }))
  return {
    success: true,
    mode: 'data_readiness_report_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    readiness,
    summary: {
      sportsAudited: readiness.length,
      importReady: readiness.filter((sport) => sport.importReadiness === 'ready').length,
      importPartial: readiness.filter((sport) => sport.importReadiness === 'partial').length,
      importBlocked: readiness.filter((sport) => sport.importReadiness === 'blocked').length,
      predictionReady: readiness.filter((sport) => sport.predictionReadiness === 'ready').length,
      predictionPartial: readiness.filter((sport) => sport.predictionReadiness === 'partial').length,
      predictionBlocked: readiness.filter((sport) => sport.predictionReadiness === 'blocked').length,
    },
  }
}

export async function validateDataFoundationQualityV2() {
  const [quality, reconciliation, readiness] = await Promise.all([
    getDataFoundationQualityV2(),
    getDataFoundationReconciliationV2(),
    getDataFoundationReadinessV2(),
  ])
  const checks = [
    ['quality read-only', quality.readOnly],
    ['reconciliation read-only', reconciliation.readOnly],
    ['readiness read-only', readiness.readOnly],
    ['zero provider calls', quality.providerCallsMade === 0 && reconciliation.providerCallsMade === 0 && readiness.providerCallsMade === 0],
    ['zero remote mutations', quality.remoteMutationsMade === 0 && reconciliation.remoteMutationsMade === 0 && readiness.remoteMutationsMade === 0],
    ['audits eight sports', quality.summary.sportsAudited === 8],
    ['reconciliation has no mutation plan', reconciliation.summary.mutationPlan === 'none_read_only_report'],
    ['readiness covers eight sports', readiness.summary.sportsAudited === 8],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'data_foundation_quality_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      sportsAudited: quality.summary.sportsAudited,
      totalRowsObserved: quality.summary.totalRowsObserved,
      reconciliationItems: reconciliation.summary.reconciliationItems,
      importReady: readiness.summary.importReady,
      predictionReady: readiness.summary.predictionReady,
    },
  }
}
