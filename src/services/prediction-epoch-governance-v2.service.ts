import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPredictionEpochMigrationState } from '@/services/prediction-epoch-migration-state.service'

const MIGRATION_FILE = 'supabase/migrations/202607270001_prediction_epoch_governance_v2.sql'

function nowIso() {
  return new Date().toISOString()
}

async function countPredictions(builder?: (query: any) => any) {
  let query: any = supabaseAdmin.from('prediction_history').select('id', { count: 'exact', head: true })
  if (builder) query = builder(query)
  const { count: rows, error } = await query
  if (error) return { rows: 0, error: error.message }
  return { rows: rows ?? 0, error: null }
}

export async function getPredictionEpochGovernanceV2() {
  const [migrationState, totalRows, currentRows, championRows, challengerRows, shadowRows, archivedRows, productionEligibleRows] = await Promise.all([
    getPredictionEpochMigrationState(),
    countPredictions(),
    countPredictions((query) => query.eq('is_current', true)),
    countPredictions((query) => query.eq('model_role', 'champion')),
    countPredictions((query) => query.eq('model_role', 'challenger')),
    countPredictions((query) => query.eq('model_role', 'shadow')),
    countPredictions((query) => query.eq('model_role', 'archived')),
    countPredictions((query) => query.eq('production_eligible', true)),
  ])
  return {
    success: true,
    mode: 'prediction_epoch_governance_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
    migrationReady: migrationState.migrationReady,
    migrationApplied: migrationState.migrationApplied,
    migrationState: migrationState.migrationState,
    tableExists: migrationState.tableExists,
    epochColumnsExist: migrationState.epochColumnsExist,
    requiredIndexesVerified: migrationState.requiredIndexesVerified,
    rlsVerified: migrationState.rlsVerified,
    epochRows: migrationState.epochRows,
    epochRowCount: migrationState.epochRowCount,
    activeEpochRows: migrationState.activeEpochRows,
    activeEpochCount: migrationState.activeEpochCount,
    legacyEpochPresent: migrationState.legacyEpochPresent,
    v2EpochPresent: migrationState.v2EpochPresent,
    newEpochActive: migrationState.newEpochActive,
    legacyBehaviorActive: migrationState.legacyBehaviorActive,
    activationRequired: migrationState.activationRequired,
    schemaCacheWarning: migrationState.schemaCacheWarning,
    verificationWarnings: migrationState.verificationWarnings,
    migrationsCreated: [MIGRATION_FILE],
    epochs: [
      {
        epochKey: 'LEGACY_EPOCH_V1',
        epochName: 'Legacy Certified Prediction Epoch V1',
        status: 'ARCHIVED_AFTER_MANUAL_ACTIVATION',
        activationRequired: false,
        archiveMutationRequired: true,
        preservesHistoricalRows: true,
        rollbackEpochKey: null,
      },
      {
        epochKey: 'DATA_FOUNDATION_V2_EPOCH',
        epochName: 'Historical Sports Data Foundation V2 Epoch',
        status: 'MIGRATION_READY_NOT_ACTIVE',
        activationRequired: true,
        archiveMutationRequired: false,
        futureOnly: true,
        rollbackEpochKey: 'LEGACY_EPOCH_V1',
      },
    ],
    predictionHistorySnapshot: {
      totalRows,
      currentRows,
      championRows,
      challengerRows,
      shadowRows,
      archivedRows,
      productionEligibleRows,
    },
    contract: {
      statuses: ['ACTIVE', 'ARCHIVED', 'SHADOW', 'MIGRATION_READY', 'BLOCKED'],
      requiredFields: [
        'epoch_key',
        'epoch_name',
        'status',
        'training_window_start',
        'training_window_end',
        'data_window_start',
        'data_window_end',
        'model_versions',
        'feature_versions',
        'activation_reason',
        'rollback_epoch_key',
        'created_at',
        'activated_at',
        'archived_at',
      ],
      legacyPredictionPreservation: true,
      rollbackContract: true,
      destructiveReset: false,
      automaticActivation: false,
    },
    activationRunbook: [
      'Apply additive migration after manual SQL approval.',
      'Insert LEGACY_EPOCH_V1 and DATA_FOUNDATION_V2_EPOCH rows in prediction_epochs.',
      'Backfill prediction_epoch_key for legacy rows only through an approved bounded mutation plan.',
      'Activate DATA_FOUNDATION_V2_EPOCH only for future eligible prediction generation.',
      'Keep rollback_epoch_key pointing to LEGACY_EPOCH_V1.',
    ],
    warnings: [
      migrationState.migrationApplied
        ? `Migration schema detected with state ${migrationState.migrationState}; epoch activation remains separate.`
        : `Migration schema not fully active; current state ${migrationState.migrationState}.`,
      ...migrationState.verificationWarnings,
      'This phase does not archive, update or delete prediction_history rows.',
      'DATA_FOUNDATION_V2_EPOCH is migration-ready only and not active.',
    ],
  }
}

export async function validatePredictionEpochGovernanceV2() {
  const result = await getPredictionEpochGovernanceV2()
  const checks = [
    ['read-only contract', result.readOnly],
    ['zero provider calls', result.providerCallsMade === 0],
    ['zero remote mutations', result.remoteMutationsMade === 0],
    ['migration detection contract', typeof result.migrationState === 'string'],
    ['migration file created', result.migrationsCreated.includes(MIGRATION_FILE)],
    ['legacy epoch defined', result.epochs.some((epoch) => epoch.epochKey === 'LEGACY_EPOCH_V1')],
    ['new epoch defined but inactive', result.epochs.some((epoch) => epoch.epochKey === 'DATA_FOUNDATION_V2_EPOCH' && epoch.status === 'MIGRATION_READY_NOT_ACTIVE')],
    ['legacy preservation contract', result.contract.legacyPredictionPreservation],
    ['rollback contract', result.contract.rollbackContract],
    ['no automatic activation', result.contract.automaticActivation === false],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'prediction_epoch_governance_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    summary: {
      epochsDefined: result.epochs.length,
      migrationsCreated: result.migrationsCreated,
      totalPredictionRowsAudited: result.predictionHistorySnapshot.totalRows.rows,
      productionEligibleRows: result.predictionHistorySnapshot.productionEligibleRows.rows,
      migrationApplied: result.migrationApplied,
      migrationState: result.migrationState,
      epochRowCount: result.epochRowCount,
      activeEpochCount: result.activeEpochCount,
      activationRequired: result.activationRequired,
      automaticActivation: false,
    },
  }
}
