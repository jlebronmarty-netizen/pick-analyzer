import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export type PredictionEpochMigrationState =
  | 'NOT_APPLIED'
  | 'APPLIED_EMPTY'
  | 'APPLIED_UNSEEDED'
  | 'APPLIED_INACTIVE'
  | 'APPLIED_ACTIVE'
  | 'PARTIALLY_APPLIED'
  | 'SCHEMA_CACHE_PENDING'
  | 'VERIFICATION_ERROR'

type ProbeError = {
  code?: string
  message?: string
  details?: string
}

type EpochProbeRow = {
  id: string | null
  epoch_key: string | null
  status: string | null
  activated_at: string | null
  archived_at: string | null
}

export type PredictionEpochMigrationProbeInput = {
  epochTable: {
    ok: boolean
    rowCount: number
    rows: EpochProbeRow[]
    error: ProbeError | null
  }
  predictionHistoryColumns: {
    ok: boolean
    error: ProbeError | null
  }
}

function cleanError(error: unknown): ProbeError | null {
  if (!error || typeof error !== 'object') return null
  const record = error as Record<string, unknown>
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
    details: typeof record.details === 'string' ? record.details : undefined,
  }
}

function isMissingRelation(error: ProbeError | null) {
  return error?.code === 'PGRST205'
    || String(error?.message ?? '').toLowerCase().includes('could not find the table')
    || String(error?.message ?? '').toLowerCase().includes('relation') && String(error?.message ?? '').toLowerCase().includes('does not exist')
}

function isMissingColumn(error: ProbeError | null) {
  return error?.code === 'PGRST204'
    || String(error?.message ?? '').toLowerCase().includes('column')
    || String(error?.details ?? '').toLowerCase().includes('column')
}

export function classifyPredictionEpochMigrationState(input: PredictionEpochMigrationProbeInput) {
  const tableMissing = isMissingRelation(input.epochTable.error)
  const columnsMissing = isMissingColumn(input.predictionHistoryColumns.error)
  const tableOk = input.epochTable.ok
  const columnsOk = input.predictionHistoryColumns.ok
  const verificationWarnings: string[] = []
  let migrationState: PredictionEpochMigrationState = 'VERIFICATION_ERROR'

  if (tableOk && columnsOk) {
    if (input.epochTable.rowCount === 0) {
      migrationState = 'APPLIED_EMPTY'
    } else {
      const activeV2Rows = input.epochTable.rows.filter((row) => row.epoch_key === 'DATA_FOUNDATION_V2_EPOCH' && String(row.status ?? '').toUpperCase() === 'ACTIVE').length
      migrationState = activeV2Rows > 0 ? 'APPLIED_ACTIVE' : 'APPLIED_INACTIVE'
    }
  } else if (tableMissing && columnsMissing) {
    migrationState = 'NOT_APPLIED'
  } else if ((tableMissing && columnsOk) || (tableOk && columnsMissing)) {
    migrationState = tableMissing ? 'SCHEMA_CACHE_PENDING' : 'PARTIALLY_APPLIED'
    verificationWarnings.push(tableMissing
      ? 'prediction_history epoch columns are visible but prediction_epochs is not visible through PostgREST; schema cache may still be refreshing.'
      : 'prediction_epochs is visible but prediction_history epoch columns are missing.')
  } else if (tableMissing || columnsMissing) {
    migrationState = 'PARTIALLY_APPLIED'
  } else {
    migrationState = 'VERIFICATION_ERROR'
    verificationWarnings.push('Migration state could not be verified from read-only PostgREST probes.')
  }

  const epochRows = tableOk ? input.epochTable.rowCount : 0
  const activeEpochRows = tableOk
    ? input.epochTable.rows.filter((row) => String(row.status ?? '').toUpperCase() === 'ACTIVE').length
    : 0
  const activeEpochRow = tableOk
    ? input.epochTable.rows.find((row) => String(row.status ?? '').toUpperCase() === 'ACTIVE') ?? null
    : null
  const activeV2Rows = tableOk
    ? input.epochTable.rows.filter((row) => row.epoch_key === 'DATA_FOUNDATION_V2_EPOCH' && String(row.status ?? '').toUpperCase() === 'ACTIVE').length
    : 0
  const legacyEpochRow = tableOk
    ? input.epochTable.rows.find((row) => row.epoch_key === 'LEGACY_EPOCH_V1') ?? null
    : null
  const v2EpochRow = tableOk
    ? input.epochTable.rows.find((row) => row.epoch_key === 'DATA_FOUNDATION_V2_EPOCH') ?? null
    : null
  const legacyEpochPresent = tableOk
    ? Boolean(legacyEpochRow)
    : false
  const v2EpochPresent = tableOk
    ? Boolean(v2EpochRow)
    : false
  const migrationApplied = ['APPLIED_EMPTY', 'APPLIED_UNSEEDED', 'APPLIED_INACTIVE', 'APPLIED_ACTIVE'].includes(migrationState)

  return {
    migrationReady: true,
    migrationApplied,
    migrationState,
    tableExists: tableOk,
    epochColumnsExist: columnsOk,
    requiredIndexesVerified: 'NOT_VERIFIABLE_THROUGH_POSTGREST',
    rlsVerified: tableOk ? 'TABLE_READABLE_WITH_SERVICE_ROLE' : 'NOT_VERIFIED',
    epochRows,
    epochRowCount: epochRows,
    activeEpochRows,
    activeEpochCount: activeEpochRows,
    activeEpochKey: activeEpochRow?.epoch_key ?? null,
    activeEpochStatus: activeEpochRow?.status ?? null,
    legacyEpochPresent,
    legacyEpochStatus: legacyEpochRow?.status ?? null,
    v2EpochPresent,
    v2EpochStatus: v2EpochRow?.status ?? null,
    newEpochActive: activeV2Rows > 0,
    legacyBehaviorActive: activeV2Rows === 0,
    activationRequired: activeV2Rows === 0,
    schemaCacheWarning: migrationState === 'SCHEMA_CACHE_PENDING',
    verificationWarnings,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}

export async function getPredictionEpochMigrationState() {
  const [epochProbe, columnProbe] = await Promise.all([
    supabaseAdmin
      .from('prediction_epochs')
      .select('id,epoch_key,status,activated_at,archived_at', { count: 'exact' })
      .limit(50),
    supabaseAdmin
      .from('prediction_history')
      .select('id,prediction_epoch_id,prediction_epoch_key', { count: 'exact' })
      .limit(1),
  ])

  return classifyPredictionEpochMigrationState({
    epochTable: {
      ok: !epochProbe.error,
      rowCount: epochProbe.count ?? epochProbe.data?.length ?? 0,
      rows: (epochProbe.data ?? []) as EpochProbeRow[],
      error: cleanError(epochProbe.error),
    },
    predictionHistoryColumns: {
      ok: !columnProbe.error,
      error: cleanError(columnProbe.error),
    },
  })
}

export function validatePredictionEpochMigrationStateFixtures() {
  const fixtures: Array<{
    name: string
    input: PredictionEpochMigrationProbeInput
    expectedState: PredictionEpochMigrationState
    expectedApplied: boolean
    expectedNewEpochActive: boolean
  }> = [
    {
      name: 'relation missing',
      input: {
        epochTable: { ok: false, rowCount: 0, rows: [], error: { code: 'PGRST205', message: 'Could not find the table' } },
        predictionHistoryColumns: { ok: false, error: { code: 'PGRST204', message: 'column not found' } },
      },
      expectedState: 'NOT_APPLIED',
      expectedApplied: false,
      expectedNewEpochActive: false,
    },
    {
      name: 'relation exists with zero rows',
      input: {
        epochTable: { ok: true, rowCount: 0, rows: [], error: null },
        predictionHistoryColumns: { ok: true, error: null },
      },
      expectedState: 'APPLIED_EMPTY',
      expectedApplied: true,
      expectedNewEpochActive: false,
    },
    {
      name: 'legacy and v2 rows exist neither active',
      input: {
        epochTable: {
          ok: true,
          rowCount: 2,
          rows: [
            { id: '1', epoch_key: 'LEGACY_EPOCH_V1', status: 'ARCHIVED', activated_at: null, archived_at: '2026-01-01T00:00:00Z' },
            { id: '2', epoch_key: 'DATA_FOUNDATION_V2_EPOCH', status: 'SHADOW', activated_at: null, archived_at: null },
          ],
          error: null,
        },
        predictionHistoryColumns: { ok: true, error: null },
      },
      expectedState: 'APPLIED_INACTIVE',
      expectedApplied: true,
      expectedNewEpochActive: false,
    },
    {
      name: 'legacy active v2 shadow',
      input: {
        epochTable: {
          ok: true,
          rowCount: 2,
          rows: [
            { id: '1', epoch_key: 'LEGACY_EPOCH_V1', status: 'ACTIVE', activated_at: '2026-01-01T00:00:00Z', archived_at: null },
            { id: '2', epoch_key: 'DATA_FOUNDATION_V2_EPOCH', status: 'SHADOW', activated_at: null, archived_at: null },
          ],
          error: null,
        },
        predictionHistoryColumns: { ok: true, error: null },
      },
      expectedState: 'APPLIED_INACTIVE',
      expectedApplied: true,
      expectedNewEpochActive: false,
    },
    {
      name: 'v2 active',
      input: {
        epochTable: {
          ok: true,
          rowCount: 2,
          rows: [
            { id: '1', epoch_key: 'LEGACY_EPOCH_V1', status: 'ARCHIVED', activated_at: null, archived_at: '2026-01-01T00:00:00Z' },
            { id: '2', epoch_key: 'DATA_FOUNDATION_V2_EPOCH', status: 'ACTIVE', activated_at: '2026-01-01T00:00:00Z', archived_at: null },
          ],
          error: null,
        },
        predictionHistoryColumns: { ok: true, error: null },
      },
      expectedState: 'APPLIED_ACTIVE',
      expectedApplied: true,
      expectedNewEpochActive: true,
    },
    {
      name: 'partial schema',
      input: {
        epochTable: { ok: true, rowCount: 0, rows: [], error: null },
        predictionHistoryColumns: { ok: false, error: { code: 'PGRST204', message: 'column not found' } },
      },
      expectedState: 'PARTIALLY_APPLIED',
      expectedApplied: false,
      expectedNewEpochActive: false,
    },
    {
      name: 'schema cache stale',
      input: {
        epochTable: { ok: false, rowCount: 0, rows: [], error: { code: 'PGRST205', message: 'Could not find the table' } },
        predictionHistoryColumns: { ok: true, error: null },
      },
      expectedState: 'SCHEMA_CACHE_PENDING',
      expectedApplied: false,
      expectedNewEpochActive: false,
    },
  ]

  const results = fixtures.map((fixture) => {
    const actual = classifyPredictionEpochMigrationState(fixture.input)
    return {
      name: fixture.name,
      expectedState: fixture.expectedState,
      actualState: actual.migrationState,
      expectedApplied: fixture.expectedApplied,
      actualApplied: actual.migrationApplied,
      expectedNewEpochActive: fixture.expectedNewEpochActive,
      actualNewEpochActive: actual.newEpochActive,
      passed: actual.migrationState === fixture.expectedState
        && actual.migrationApplied === fixture.expectedApplied
        && actual.newEpochActive === fixture.expectedNewEpochActive,
    }
  })

  return {
    success: results.every((result) => result.passed),
    mode: 'prediction_epoch_migration_state_fixture_validation_v1',
    checks: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    productionMutationsMade: 0,
  }
}
