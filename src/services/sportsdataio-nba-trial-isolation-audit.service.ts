import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const NBA_SPORT_KEY = 'basketball_nba'
const PROVIDER = 'sportsdataio'

type AuditedRow = {
  table: string
  id: string
  metadata: Record<string, unknown>
  providerIds: Record<string, unknown>
}

type TableAudit = {
  table: string
  status: 'audited' | 'unavailable'
  rowsScanned: number
  sportsDataIoRows: number
  trialRows: number
  isolationViolations: number
  productionEligibleViolations: number
  unavailableReason: string | null
  sampleViolationIds: string[]
}

type PredictionRow = {
  id: string
  game_id: string | null
  status: string | null
  result: string | null
  lifecycle_status: string | null
  feature_snapshot: Record<string, unknown> | null
}

const TABLES = [
  { table: 'sports_teams', select: 'id, provider_ids, metadata' },
  { table: 'sport_events', select: 'id, provider_ids, metadata' },
  { table: 'sport_standings', select: 'id, provider_ids, metadata' },
  { table: 'sport_game_stats', select: 'id, provider_ids, metadata' },
  { table: 'sport_injuries', select: 'id, provider_ids, metadata' },
  { table: 'sport_players', select: 'id, provider_ids, metadata' },
  { table: 'sport_lineups', select: 'id, provider_ids, metadata' },
  { table: 'sport_player_stats', select: 'id, provider_ids, metadata', optional: true },
  { table: 'sports_odds_snapshots', select: 'id, metadata' },
  { table: 'provider_entity_mappings', select: 'id, provider_id, metadata' },
] as const

function generatedAt() {
  return new Date().toISOString()
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function nestedPilot(metadata: Record<string, unknown>) {
  return objectValue(metadata.sportsdataioPilotV1)
}

function hasSportsDataIoMarker(row: AuditedRow) {
  const metadata = row.metadata
  const pilot = nestedPilot(metadata)
  return (
    metadata.source === PROVIDER ||
    metadata.provider === PROVIDER ||
    String(metadata.importModule ?? '').startsWith('sportsdataio_') ||
    pilot.trial === true ||
    PROVIDER in row.providerIds
  )
}

function isTrialIsolated(row: AuditedRow) {
  const metadata = row.metadata
  const pilot = nestedPilot(metadata)
  const trial = metadata.trial === true || pilot.trial === true
  const scrambled = metadata.scrambled === true || pilot.scrambled === true
  const productionEligible =
    metadata.production_eligible === false || pilot.production_eligible === false

  return trial && scrambled && productionEligible
}

function isTrial(row: AuditedRow) {
  const metadata = row.metadata
  const pilot = nestedPilot(metadata)
  return metadata.trial === true || metadata.scrambled === true || pilot.trial === true || pilot.scrambled === true
}

function productionEligibleViolation(row: AuditedRow) {
  const metadata = row.metadata
  const pilot = nestedPilot(metadata)
  return isTrial(row) && metadata.production_eligible !== false && pilot.production_eligible !== false
}

function rowId(row: Record<string, unknown>) {
  return String(row.id ?? row.provider_id ?? 'unknown')
}

async function loadAuditRows(table: string, select: string, optional = false) {
  const query = supabaseAdmin.from(table).select(select).limit(5000)
  const scoped =
    table === 'provider_entity_mappings'
      ? query.eq('sport_key', NBA_SPORT_KEY).eq('provider', PROVIDER)
      : table === 'sports_odds_snapshots'
        ? query.eq('sport_key', NBA_SPORT_KEY).eq('provider', PROVIDER)
        : query.eq('sport_key', NBA_SPORT_KEY)
  const result = await scoped

  if (result.error) {
    if (optional) {
      return {
        rows: [] as AuditedRow[],
        unavailableReason: result.error.message,
      }
    }
    throw new Error(`${table} audit query failed: ${result.error.message}`)
  }

  return {
    rows: ((result.data ?? []) as unknown[]).map((row) => {
      const record = row as Record<string, unknown>
      return {
        table,
        id: rowId(record),
        metadata: objectValue(record.metadata),
        providerIds: objectValue(record.provider_ids),
      }
    }),
    unavailableReason: null,
  }
}

function auditTable(table: string, rows: AuditedRow[], unavailableReason: string | null): TableAudit {
  if (unavailableReason) {
    return {
      table,
      status: 'unavailable',
      rowsScanned: 0,
      sportsDataIoRows: 0,
      trialRows: 0,
      isolationViolations: 0,
      productionEligibleViolations: 0,
      unavailableReason,
      sampleViolationIds: [],
    }
  }

  const sportsDataIoRows = rows.filter(hasSportsDataIoMarker)
  const isolationViolations = sportsDataIoRows.filter((row) => !isTrialIsolated(row))
  const productionEligibleViolations = sportsDataIoRows.filter(productionEligibleViolation)

  return {
    table,
    status: 'audited',
    rowsScanned: rows.length,
    sportsDataIoRows: sportsDataIoRows.length,
    trialRows: sportsDataIoRows.filter(isTrial).length,
    isolationViolations: isolationViolations.length,
    productionEligibleViolations: productionEligibleViolations.length,
    unavailableReason: null,
    sampleViolationIds: [...isolationViolations, ...productionEligibleViolations]
      .slice(0, 10)
      .map((row) => row.id),
  }
}

function snapshotHasTrialMarker(snapshot: Record<string, unknown> | null) {
  if (!snapshot || Object.keys(snapshot).length === 0) return false
  const serialized = JSON.stringify(snapshot).toLowerCase()
  return (
    serialized.includes('"trial":true') ||
    serialized.includes('"scrambled":true') ||
    serialized.includes('"production_eligible":false') ||
    serialized.includes('trial/scrambled')
  )
}

async function loadPredictionRows() {
  const result = await supabaseAdmin
    .from('prediction_history')
    .select('id, game_id, status, result, lifecycle_status, feature_snapshot')
    .eq('sport_key', NBA_SPORT_KEY)
    .limit(5000)

  if (result.error) {
    return {
      rows: [] as PredictionRow[],
      warning: `prediction_history unavailable: ${result.error.message}`,
    }
  }

  return {
    rows: (result.data ?? []) as PredictionRow[],
    warning: null,
  }
}

export async function getSportsDataIoNbaTrialIsolationAudit() {
  const loaded = await Promise.all(
    TABLES.map(async (item) => ({
      table: item.table,
      ...(await loadAuditRows(item.table, item.select, 'optional' in item && item.optional === true)),
    }))
  )
  const tableAudits = loaded.map((item) => auditTable(item.table, item.rows, item.unavailableReason))
  const trialEventIds = new Set(
    loaded
      .find((item) => item.table === 'sport_events')
      ?.rows.filter((row) => hasSportsDataIoMarker(row) && isTrial(row))
      .map((row) => row.id) ?? []
  )
  const predictions = await loadPredictionRows()
  const predictionsReferencingTrialEvents = predictions.rows.filter(
    (row) => row.game_id !== null && trialEventIds.has(row.game_id)
  )
  const predictionsWithTrialSnapshots = predictions.rows.filter((row) =>
    snapshotHasTrialMarker(row.feature_snapshot)
  )
  const errors = [
    ...tableAudits
      .filter((audit) => audit.isolationViolations > 0)
      .map((audit) => `${audit.table} has ${audit.isolationViolations} SportsDataIO trial isolation violations.`),
    ...tableAudits
      .filter((audit) => audit.productionEligibleViolations > 0)
      .map((audit) => `${audit.table} has ${audit.productionEligibleViolations} trial rows not marked production_eligible=false.`),
    ...(predictionsReferencingTrialEvents.length > 0
      ? [`${predictionsReferencingTrialEvents.length} NBA prediction rows reference SportsDataIO trial events.`]
      : []),
    ...(predictionsWithTrialSnapshots.length > 0
      ? [`${predictionsWithTrialSnapshots.length} NBA prediction rows contain trial/scrambled feature markers.`]
      : []),
  ]
  const warnings = [
    ...(predictions.warning ? [predictions.warning] : []),
    ...tableAudits
      .filter((audit) => audit.status === 'unavailable')
      .map((audit) => `${audit.table} unavailable during trial isolation audit: ${audit.unavailableReason}`),
  ]
  const totals = tableAudits.reduce(
    (acc, audit) => ({
      rowsScanned: acc.rowsScanned + audit.rowsScanned,
      sportsDataIoRows: acc.sportsDataIoRows + audit.sportsDataIoRows,
      trialRows: acc.trialRows + audit.trialRows,
      isolationViolations: acc.isolationViolations + audit.isolationViolations,
      productionEligibleViolations:
        acc.productionEligibleViolations + audit.productionEligibleViolations,
    }),
    {
      rowsScanned: 0,
      sportsDataIoRows: 0,
      trialRows: 0,
      isolationViolations: 0,
      productionEligibleViolations: 0,
    }
  )

  return {
    success: errors.length === 0,
    mode: 'sportsdataio_nba_trial_isolation_audit_v1',
    generatedAt: generatedAt(),
    providerUsage: {
      externalProviderCallsMade: 0,
      source: 'stored_supabase_trial_isolation_audit',
    },
    status: errors.length === 0 ? 'trial_isolation_preserved' : 'trial_isolation_violation',
    totals,
    tables: tableAudits,
    predictionLeakage: {
      predictionRowsScanned: predictions.rows.length,
      trialEventIds: trialEventIds.size,
      predictionsReferencingTrialEvents: predictionsReferencingTrialEvents.length,
      predictionsWithTrialSnapshots: predictionsWithTrialSnapshots.length,
      samplePredictionIds: [
        ...predictionsReferencingTrialEvents,
        ...predictionsWithTrialSnapshots,
      ]
        .slice(0, 10)
        .map((row) => row.id),
    },
    safetyInvariants: {
      noProviderCalls: true,
      trialRowsProductionEligibleFalse: totals.productionEligibleViolations === 0,
      sportsDataIoRowsTrialIsolated: totals.isolationViolations === 0,
      productionPredictionsExcludeTrialEvents: predictionsReferencingTrialEvents.length === 0,
      productionFeatureSnapshotsExcludeTrialMarkers: predictionsWithTrialSnapshots.length === 0,
      predictionPersistenceEnabledByAudit: false,
      backtestingEnabledByAudit: false,
      modelTrainingEnabledByAudit: false,
    },
    errors,
    warnings,
  }
}
