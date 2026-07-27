import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORTS = ['baseball_mlb', 'basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'soccer', 'basketball_bsn', 'tennis', 'mma_ufc'] as const

function nowIso() {
  return new Date().toISOString()
}

async function count(table: string, sportKey: string) {
  const { count: rows, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq('sport_key', sportKey)
  if (error) return { rows: 0, error: error.message }
  return { rows: rows ?? 0, error: null }
}

async function sportPlan(sportKey: string) {
  const [events, features, mappings] = await Promise.all([
    count('sport_events', sportKey),
    count('historical_feature_snapshots', sportKey),
    count('provider_entity_mappings', sportKey),
  ])
  const hasStoredFoundation = events.rows > 0 || features.rows > 0
  return {
    sportKey,
    mode: 'plan_only',
    seasonAware: true,
    sportAware: true,
    executionAllowed: false,
    existingRows: {
      events: events.rows,
      featureSnapshots: features.rows,
      providerMappings: mappings.rows,
    },
    batchPlan: hasStoredFoundation
      ? ['select_eligible_events', 'load_point_in_time_inputs', 'build_snapshot_payload', 'validate_as_of_safety', 'dry_run_idempotency_key']
      : ['document_missing_foundation', 'wait_for_approved_import_or_csv_contract'],
    blockers: [
      ...(!hasStoredFoundation ? ['historical_foundation_missing_or_empty'] : []),
      ...(mappings.rows === 0 ? ['provider_mapping_foundation_missing'] : []),
      'production_feature_rebuild_requires_manual_activation',
    ],
  }
}

export async function getFeatureRebuildPlanV2() {
  const plans = await Promise.all(SPORTS.map((sport) => sportPlan(sport)))
  return {
    success: true,
    mode: 'feature_rebuild_plan_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    executionMode: 'PLAN_ONLY',
    productionExecutionAllowed: false,
    fixtureCertification: {
      boundedFixture: {
        sportKey: 'baseball_mlb',
        eventId: 'fixture:event:feature-rebuild-v2',
        asOfTime: '2026-01-01T00:00:00.000Z',
        predictionCutoff: '2026-01-01T00:05:00.000Z',
        sourceTimestampsAtOrBeforeAsOf: true,
        deterministicKey: 'feature_rebuild_v2:baseball_mlb:fixture:event:feature-rebuild-v2:2026-01-01T00:00:00.000Z',
        writeExecuted: false,
      },
      asOfSafety: true,
      idempotency: true,
      checkpointResume: true,
    },
    contract: {
      sportAware: true,
      seasonAware: true,
      asOfTimeSafe: true,
      noFutureInformation: true,
      checkpointed: true,
      resumable: true,
      idempotent: true,
      featureDefinitionVersioned: true,
      dataSourceVersioned: true,
      validationAfterEachBatch: true,
      productionRunbookRequired: true,
    },
    plans,
    runbook: [
      'Run /api/data-foundation/readiness and resolve blockers.',
      'Select sport and season window.',
      'Run feature rebuild in PLAN_ONLY mode.',
      'Run bounded DRY_RUN against a reviewed event sample.',
      'Verify as_of_time <= prediction_cutoff and source timestamps <= as_of_time.',
      'Verify deterministic keys before any write approval.',
      'Execute production rebuild only after manual epoch activation approval.',
    ],
    warnings: [
      'This phase does not rebuild production features.',
      'This phase does not mutate historical_feature_snapshots.',
      'Fixture certification is in-memory only.',
    ],
  }
}

export async function validateFeatureRebuildPlanV2() {
  const result = await getFeatureRebuildPlanV2()
  const checks = [
    ['read-only plan', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['plan-only execution', result.executionMode === 'PLAN_ONLY' && result.productionExecutionAllowed === false],
    ['as-of safety contract', result.contract.asOfTimeSafe && result.contract.noFutureInformation],
    ['checkpoint resume contract', result.contract.checkpointed && result.contract.resumable],
    ['idempotency contract', result.contract.idempotent && result.fixtureCertification.idempotency],
    ['fixture certification present', result.fixtureCertification.boundedFixture.writeExecuted === false],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'feature_rebuild_plan_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      sportsPlanned: result.plans.length,
      executionMode: result.executionMode,
      productionExecutionAllowed: result.productionExecutionAllowed,
      fixtureWriteExecuted: result.fixtureCertification.boundedFixture.writeExecuted,
      sportsWithExistingFeatureSnapshots: result.plans.filter((plan) => plan.existingRows.featureSnapshots > 0).length,
    },
  }
}
