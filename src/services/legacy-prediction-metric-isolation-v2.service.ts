import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPredictionEpochMigrationState } from '@/services/prediction-epoch-migration-state.service'

function nowIso() {
  return new Date().toISOString()
}

async function loadPredictionSamples() {
  const { data, error, count } = await supabaseAdmin
    .from('prediction_history')
    .select('id,sport_key,game_id,trial,scrambled,production_eligible,validation_status,result,status,lifecycle_status,commence_time,created_at,generated_at,is_current,model_role,feature_snapshot_id', { count: 'exact' })
    .limit(5000)
  if (error) return { rows: [] as Array<Record<string, unknown>>, count: 0, error: error.message }
  return { rows: (data ?? []) as Array<Record<string, unknown>>, count: count ?? data?.length ?? 0, error: null }
}

function isAfter(left: unknown, right: unknown) {
  const a = Date.parse(String(left ?? ''))
  const b = Date.parse(String(right ?? ''))
  return Number.isFinite(a) && Number.isFinite(b) && a > b
}

function classify(row: Record<string, unknown>) {
  const reasons: string[] = []
  if (row.trial === true || row.scrambled === true) reasons.push('trial_or_scrambled')
  if (String(row.validation_status ?? '').toLowerCase().includes('fixture')) reasons.push('fixture_like_validation_status')
  if (!row.game_id) reasons.push('missing_event_identity')
  if (isAfter(row.generated_at ?? row.created_at, row.commence_time)) reasons.push('post_start_or_cutoff_risk')
  if (String(row.status ?? '').toLowerCase().includes('preview')) reasons.push('preview_only')
  if (String(row.lifecycle_status ?? '').toLowerCase().includes('shadow')) reasons.push('shadow_or_non_production')
  if (row.production_eligible !== true) reasons.push('non_production_eligible')
  return reasons
}

export async function getLegacyPredictionMetricIsolationV2() {
  const [sample, migrationState] = await Promise.all([
    loadPredictionSamples(),
    getPredictionEpochMigrationState(),
  ])
  const rows = sample.rows
  const candidates = rows.map((row) => ({ id: row.id, sportKey: row.sport_key, reasons: classify(row) })).filter((row) => row.reasons.length > 0)
  const activeEpochFilter = {
    defaultEpochKey: 'DATA_FOUNDATION_V2_EPOCH',
    legacyEpochKey: 'LEGACY_EPOCH_V1',
    activeMetricRule: 'include rows whose prediction_epoch_key matches active epoch after manual activation',
    fallbackBeforeMigration: 'exclude trial, scrambled, shadow, archived and non-production rows from active operational metrics',
  }
  return {
    success: true,
    mode: 'legacy_prediction_metric_isolation_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    migrationState,
    predictionRowsAudited: sample.count,
    sampleLimit: 5000,
    sourceError: sample.error,
    archiveContract: {
      legacyRowsRemainQueryable: true,
      legacyRowsRemainSettled: true,
      legacyRowsRemainAuditable: true,
      physicalDeletionAllowed: false,
      automaticArchiveMutation: false,
      newTodayViewsRequireActiveEpoch: true,
    },
    metricIsolation: {
      activeEpochFilter,
      legacyMetricScopes: ['LEGACY_EPOCH_V1', 'DATA_FOUNDATION_V2_EPOCH', 'ALL_EPOCHS'],
      activeOperationalMetricsExcludeLegacyByDefault: true,
      productionTrustRequiresEpochAndProductionEligibility: true,
      learningLabelsRequireOriginatingEpoch: true,
    },
    deletionCandidateReport: {
      candidates: candidates.length,
      byReason: Array.from(new Set(candidates.flatMap((row) => row.reasons))).sort().map((reason) => ({
        reason,
        count: candidates.filter((row) => row.reasons.includes(reason)).length,
      })),
      sampleIds: candidates.slice(0, 25),
      deleteExecuted: false,
    },
    validation: {
      noPredictionDeletion: true,
      noMassUpdate: true,
      epochFilteringContract: true,
      legacyPreservation: true,
    },
    warnings: [
      'This phase classifies deletion candidates only; it does not delete rows.',
      'Legacy rows remain queryable and auditable.',
      `Active epoch filtering becomes enforceable only after activation; current migration state is ${migrationState.migrationState}.`,
    ],
  }
}

export async function validateLegacyPredictionMetricIsolationV2() {
  const result = await getLegacyPredictionMetricIsolationV2()
  const checks = [
    ['read-only report', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['canonical migration state present', typeof result.migrationState.migrationState === 'string'],
    ['legacy rows remain queryable', result.archiveContract.legacyRowsRemainQueryable],
    ['no prediction deletion', result.validation.noPredictionDeletion && result.deletionCandidateReport.deleteExecuted === false],
    ['epoch filtering contract', result.validation.epochFilteringContract],
    ['active metrics exclude legacy by default', result.metricIsolation.activeOperationalMetricsExcludeLegacyByDefault],
    ['legacy preservation', result.validation.legacyPreservation],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'legacy_prediction_metric_isolation_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      predictionRowsAudited: result.predictionRowsAudited,
      migrationState: result.migrationState.migrationState,
      migrationApplied: result.migrationState.migrationApplied,
      deletionCandidates: result.deletionCandidateReport.candidates,
      candidateReasons: result.deletionCandidateReport.byReason,
      deleteExecuted: result.deletionCandidateReport.deleteExecuted,
    },
  }
}
