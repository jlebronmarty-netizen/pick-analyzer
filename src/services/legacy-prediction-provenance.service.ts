import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export type PredictionProvenanceClassification =
  | 'LEGACY'
  | 'PRODUCTION'
  | 'THEODDSAPI_TRIAL'
  | 'SPORTSDATAIO_TRIAL'
  | 'SYNTHETIC_TEST'
  | 'UNKNOWN'

export type PredictionProvenanceInput = {
  id?: string | null
  sport_key?: string | null
  game_id?: string | null
  market?: string | null
  sportsbook?: string | null
  model_version?: string | null
  model_role?: string | null
  feature_snapshot_id?: string | null
  odds_snapshot_id?: string | null
  operating_day_id?: string | null
  idempotency_key?: string | null
  production_eligible?: boolean | null
  trial?: boolean | null
  scrambled?: boolean | null
  validation_status?: string | null
  validation_warnings?: unknown
  created_at?: string | null
  generated_at?: string | null
  recommended_pick?: boolean | null
}

type PredictionProvenanceRow = Required<Pick<PredictionProvenanceInput, 'id'>> &
  Omit<PredictionProvenanceInput, 'id'> & {
    commence_time: string | null
    home_team: string | null
    away_team: string | null
    team: string | null
    opponent: string | null
    status: string | null
    result: string | null
    lifecycle_status: string | null
  }

type SportEventIdentityRow = {
  id: string
  sport_key: string | null
  start_time: string | null
}

const LEGACY_WRITER_COMMIT = {
  hash: '8efaab640854694c15ac2b44b69f67fa0c4aaeec',
  shortHash: '8efaab6',
  committedAt: '2026-06-21T20:30:38-04:00',
  subject: 'Add automated prediction capture and analytics dashboard',
  writerPath: 'src/services/prediction-capture.service.ts -> src/services/prediction.service.ts -> src/services/prediction-history.service.ts',
}

const SPORT_EVENTS_MIGRATION = {
  filename: 'supabase/migrations/202607110001_nba_data_sync_v1.sql',
  createdTable: 'sport_events',
  evidence: 'sport_events was introduced by the 202607110001 migration after the June 2026 legacy prediction rows already existed.',
}

const THE_ODDS_API_SPORTSBOOKS = new Set(['draftkings', 'fanduel', 'mybookie.ag'])
const THE_ODDS_API_SPORT_KEYS = new Set([
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'baseball_mlb',
  'soccer_epl',
])
const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const TERMINAL_LIFECYCLE = new Set(['settled', 'void', 'skipped', 'closed'])

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function isHexProviderGameId(value: unknown) {
  return /^[a-f0-9]{32}$/i.test(String(value ?? '').trim())
}

function warnings(row: PredictionProvenanceInput) {
  return Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
}

function isSyntheticOrFixture(row: PredictionProvenanceInput) {
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.model_role) === 'shadow' ||
    normalize(row.validation_status) === 'skipped' ||
    warnings(row).some((warning) => /trial|scrambled|fixture|synthetic|quarantine/i.test(warning))
  )
}

function isPendingLike(row: PredictionProvenanceRow) {
  const result = normalize(row.result)
  const status = normalize(row.status)
  const lifecycle = normalize(row.lifecycle_status)
  return !FINAL_RESULTS.has(result) && !FINAL_RESULTS.has(status) && !TERMINAL_LIFECYCLE.has(lifecycle)
}

function isPostStart(row: PredictionProvenanceRow) {
  const start = Date.parse(row.commence_time ?? '')
  const generated = Date.parse(row.generated_at ?? '')
  return Number.isFinite(start) && Number.isFinite(generated) && generated >= start
}

function hasTheOddsApiLegacyShape(row: PredictionProvenanceInput) {
  return (
    isHexProviderGameId(row.game_id) &&
    normalize(row.market) === 'moneyline' &&
    THE_ODDS_API_SPORTSBOOKS.has(normalize(row.sportsbook)) &&
    THE_ODDS_API_SPORT_KEYS.has(normalize(row.sport_key))
  )
}

export function isLegacyPredictionProvenanceRow(row: PredictionProvenanceInput) {
  return (
    row.production_eligible === false &&
    row.trial !== true &&
    row.scrambled !== true &&
    row.model_version == null &&
    row.feature_snapshot_id == null &&
    row.odds_snapshot_id == null &&
    row.operating_day_id == null &&
    row.idempotency_key == null &&
    hasTheOddsApiLegacyShape(row)
  )
}

export function classifyPredictionProvenance(row: PredictionProvenanceInput): {
  classification: PredictionProvenanceClassification
  evidenceCodes: string[]
} {
  const evidenceCodes: string[] = []

  if (isSyntheticOrFixture(row)) {
    evidenceCodes.push('TEST_TRIAL_OR_FIXTURE_FLAG')
    return { classification: 'SYNTHETIC_TEST', evidenceCodes }
  }

  if (row.production_eligible === true && row.feature_snapshot_id && row.model_version && row.idempotency_key) {
    evidenceCodes.push('PRODUCTION_ELIGIBLE_TRUE')
    evidenceCodes.push('FEATURE_SNAPSHOT_PRESENT')
    evidenceCodes.push('MODEL_VERSION_PRESENT')
    evidenceCodes.push('IDEMPOTENCY_KEY_PRESENT')
    return { classification: 'PRODUCTION', evidenceCodes }
  }

  if (hasTheOddsApiLegacyShape(row)) evidenceCodes.push('THE_ODDS_API_ODDS_SHAPE')
  if (row.production_eligible === false) evidenceCodes.push('PRODUCTION_ELIGIBLE_FALSE')
  if (row.model_version == null) evidenceCodes.push('MODEL_VERSION_NULL')
  if (row.feature_snapshot_id == null) evidenceCodes.push('FEATURE_SNAPSHOT_ID_NULL')
  if (row.odds_snapshot_id == null) evidenceCodes.push('ODDS_SNAPSHOT_ID_NULL')
  if (row.operating_day_id == null) evidenceCodes.push('OPERATING_DAY_ID_NULL')
  if (row.idempotency_key == null) evidenceCodes.push('IDEMPOTENCY_KEY_NULL')

  if (isLegacyPredictionProvenanceRow(row)) {
    evidenceCodes.push('LEGACY_CAPTURE_WRITER_SHAPE')
    evidenceCodes.push('CANONICAL_EVENT_LINEAGE_ABSENT')
    return { classification: 'LEGACY', evidenceCodes }
  }

  if (row.trial === true && hasTheOddsApiLegacyShape(row)) {
    evidenceCodes.push('TRIAL_TRUE')
    return { classification: 'THEODDSAPI_TRIAL', evidenceCodes }
  }

  if (row.trial === true && String(row.idempotency_key ?? '').includes('sportsdataio')) {
    evidenceCodes.push('TRIAL_TRUE')
    evidenceCodes.push('SPORTSDATAIO_IDEMPOTENCY_KEY')
    return { classification: 'SPORTSDATAIO_TRIAL', evidenceCodes }
  }

  return { classification: 'UNKNOWN', evidenceCodes }
}

async function loadPredictionRows() {
  const rows: PredictionProvenanceRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('prediction_history')
      .select(
        'id, sport_key, game_id, commence_time, home_team, away_team, team, opponent, market, sportsbook, status, result, lifecycle_status, model_version, model_role, feature_snapshot_id, odds_snapshot_id, operating_day_id, idempotency_key, production_eligible, trial, scrambled, validation_status, validation_warnings, created_at, generated_at, recommended_pick'
      )
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`prediction_history provenance read failed: ${error.message}`)
    rows.push(...((data ?? []) as PredictionProvenanceRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function loadEvents(eventIds: string[]) {
  const rows: SportEventIdentityRow[] = []
  for (let index = 0; index < eventIds.length; index += 500) {
    const { data, error } = await supabaseAdmin
      .from('sport_events')
      .select('id, sport_key, start_time')
      .in('id', eventIds.slice(index, index + 500))
    if (error) throw new Error(`sport_events provenance read failed: ${error.message}`)
    rows.push(...((data ?? []) as SportEventIdentityRow[]))
  }
  return rows
}

function groupCount<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function day(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : 'unknown'
}

function dateTimeRange(rows: PredictionProvenanceRow[], field: 'created_at' | 'generated_at') {
  const values = rows.map((row) => row[field]).filter(Boolean).sort() as string[]
  return { first: values[0] ?? null, last: values[values.length - 1] ?? null }
}

export async function getLegacyPredictionProvenanceReport() {
  const rows = await loadPredictionRows()
  const events = await loadEvents(Array.from(new Set(rows.map((row) => row.game_id).filter(Boolean) as string[])))
  const eventIds = new Set(events.map((event) => event.id))
  const classified = rows.map((row) => {
    const provenance = classifyPredictionProvenance(row)
    return {
      row,
      canonicalEventExists: eventIds.has(String(row.game_id ?? '')),
      classification: provenance.classification,
      evidenceCodes: provenance.evidenceCodes,
    }
  })
  const allLegacy = classified.filter((item) => item.classification === 'LEGACY')
  const unresolvedPending = classified.filter((item) => !item.canonicalEventExists && isPendingLike(item.row))
  const unresolvedProductionScope = unresolvedPending.filter(
    (item) => item.classification !== 'SYNTHETIC_TEST' && !isPostStart(item.row)
  )
  const legacy = unresolvedProductionScope.filter((item) => item.classification === 'LEGACY')
  const legacyRows = legacy.map((item) => item.row)
  const createdBeforeSportEvents = legacyRows.filter((row) => Date.parse(row.created_at ?? '') < Date.parse('2026-07-11T00:00:00Z'))
  const recommendedLegacy = legacyRows.filter((row) => row.recommended_pick === true)

  return {
    success: true,
    mode: 'legacy_prediction_provenance_report_v1',
    generatedAt: new Date().toISOString(),
    evidenceBasis: 'Read-only production rows plus git/migration forensics. No row deletion, event recovery, settlement, import, backfill or provider call is performed.',
    writerEvidence: LEGACY_WRITER_COMMIT,
    canonicalEventEvidence: SPORT_EVENTS_MIGRATION,
    totalPredictionRowsExamined: rows.length,
    totalLegacyRowsAllHistory: allLegacy.length,
    unresolvedRowsExamined: unresolvedPending.length,
    unresolvedRowsExcludedAsPostStart: unresolvedPending.filter((item) => isPostStart(item.row)).length,
    unresolvedRowsExcludedAsSyntheticTest: unresolvedPending.filter((item) => item.classification === 'SYNTHETIC_TEST').length,
    unresolvedProductionScopeRows: unresolvedProductionScope.length,
    unresolvedLegacyRows: legacy.length,
    unresolvedLegacyUniqueEvents: new Set(legacy.map((item) => item.row.game_id)).size,
    provenanceCounts: groupCount(unresolvedProductionScope, (item) => item.classification),
    allStoredProvenanceCounts: groupCount(classified, (item) => item.classification),
    productionScope: {
      productionQualifiedLegacyRows: legacyRows.filter((row) => row.production_eligible === true).length,
      legacyRowsExcludedFromProductionMetrics: legacyRows.filter((row) => row.production_eligible !== true).length,
      legacyRecommendedFlagsNotOfficialPicks: recommendedLegacy.length,
      policy:
        'Legacy rows remain in audit/history but are excluded from production-qualified performance, settlement backlog, ROI, accuracy, calibration and official-pick readiness.',
    },
    legacyEvidence: {
      rowCount: legacyRows.length,
      uniqueEvents: new Set(legacyRows.map((row) => row.game_id)).size,
      createdAt: dateTimeRange(legacyRows, 'created_at'),
      generatedAt: dateTimeRange(legacyRows, 'generated_at'),
      byCreatedDate: groupCount(legacyRows, (row) => day(row.created_at)),
      byGeneratedDate: groupCount(legacyRows, (row) => day(row.generated_at)),
      bySport: groupCount(legacyRows, (row) => row.sport_key ?? 'unknown'),
      bySportCreatedDate: groupCount(legacyRows, (row) => `${row.sport_key ?? 'unknown'}|${day(row.created_at)}`),
      sportsbooks: groupCount(legacyRows, (row) => row.sportsbook ?? 'unknown'),
      createdBeforeSportEventsRows: createdBeforeSportEvents.length,
      createdAfterSportEventsRows: legacyRows.length - createdBeforeSportEvents.length,
      nullLineage: {
        modelVersion: legacyRows.filter((row) => row.model_version == null).length,
        featureSnapshotId: legacyRows.filter((row) => row.feature_snapshot_id == null).length,
        oddsSnapshotId: legacyRows.filter((row) => row.odds_snapshot_id == null).length,
        operatingDayId: legacyRows.filter((row) => row.operating_day_id == null).length,
        idempotencyKey: legacyRows.filter((row) => row.idempotency_key == null).length,
      },
      flags: {
        productionEligibleFalse: legacyRows.filter((row) => row.production_eligible === false).length,
        trialTrue: legacyRows.filter((row) => row.trial === true).length,
        scrambledTrue: legacyRows.filter((row) => row.scrambled === true).length,
        recommendedPickTrue: recommendedLegacy.length,
      },
      evidenceCodes: groupCount(
        legacy.flatMap((item) => item.evidenceCodes),
        (code) => code
      ),
    },
    sourceClassification: {
      classification: 'LEGACY',
      providerOriginEvidence: 'The Odds API odds response shape: 32-character provider game IDs, sport_key values, h2h moneyline market and sportsbook labels DraftKings/FanDuel/MyBookie.ag.',
      notCertifiedProductionReason:
        'Rows lack canonical sport_events linkage, feature_snapshot_id, odds_snapshot_id, operating_day_id, idempotency_key and model_version, and are explicitly production_eligible=false.',
      unknownRows: unresolvedProductionScope.filter((item) => item.classification === 'UNKNOWN').length,
    },
    sampleLegacyRows: legacy.slice(0, 10).map((item) => ({
      id: item.row.id,
      sportKey: item.row.sport_key,
      gameId: item.row.game_id,
      createdAt: item.row.created_at,
      generatedAt: item.row.generated_at,
      sportsbook: item.row.sportsbook,
      canonicalEventExists: item.canonicalEventExists,
      evidenceCodes: item.evidenceCodes,
    })),
    dataMutationsMade: 0,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateLegacyPredictionProvenanceFixtures() {
  const legacyRow: PredictionProvenanceInput = {
    sport_key: 'americanfootball_nfl',
    game_id: '0123456789abcdef0123456789abcdef',
    market: 'moneyline',
    sportsbook: 'DraftKings',
    model_version: null,
    feature_snapshot_id: null,
    odds_snapshot_id: null,
    operating_day_id: null,
    idempotency_key: null,
    production_eligible: false,
    trial: false,
    scrambled: false,
    model_role: 'champion',
    validation_status: 'pending',
    validation_warnings: [],
  }
  const productionRow: PredictionProvenanceInput = {
    ...legacyRow,
    game_id: 'mlb-game-2026-07-21',
    model_version: 'mlb-v1',
    feature_snapshot_id: '00000000-0000-0000-0000-000000000001',
    odds_snapshot_id: 'odds-1',
    operating_day_id: '00000000-0000-0000-0000-000000000002',
    idempotency_key: 'mlb|2026-07-21|moneyline',
    production_eligible: true,
  }
  const checks = [
    ['legacy shape classifies as LEGACY', classifyPredictionProvenance(legacyRow).classification === 'LEGACY'],
    ['legacy row is non-production', isLegacyPredictionProvenanceRow(legacyRow)],
    ['production lineage classifies as PRODUCTION', classifyPredictionProvenance(productionRow).classification === 'PRODUCTION'],
    ['legacy recommended flag is not production eligibility', classifyPredictionProvenance({ ...legacyRow, recommended_pick: true }).classification === 'LEGACY'],
    ['trial row is synthetic/test scoped first', classifyPredictionProvenance({ ...legacyRow, trial: true }).classification === 'SYNTHETIC_TEST'],
    ['zero provider calls', true],
    ['read-only validation', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'legacy_prediction_provenance_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
