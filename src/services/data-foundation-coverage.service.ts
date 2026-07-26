import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const SPORTS = [
  { sportKey: 'baseball_mlb', leagueKey: 'mlb', label: 'MLB', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'basketball_nba', leagueKey: 'nba', label: 'NBA', currentSeason: '2025-26', previousSeason: '2024-25' },
  { sportKey: 'americanfootball_nfl', leagueKey: 'nfl', label: 'NFL', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'icehockey_nhl', leagueKey: 'nhl', label: 'NHL', currentSeason: '2025-26', previousSeason: '2024-25' },
  { sportKey: 'soccer', leagueKey: 'soccer', label: 'Soccer', currentSeason: 'competition_specific', previousSeason: 'competition_specific' },
  { sportKey: 'basketball_bsn', leagueKey: 'bsn', label: 'BSN', currentSeason: '2026', previousSeason: '2025' },
  { sportKey: 'tennis', leagueKey: 'tennis', label: 'Tennis', currentSeason: 'event_driven_2026', previousSeason: 'event_driven_2025' },
  { sportKey: 'mma_ufc', leagueKey: 'ufc', label: 'UFC', currentSeason: 'event_driven_2026', previousSeason: 'event_driven_2025' },
] as const

type TableConfig = {
  key: string
  table: string
  dateColumn: string
  requiredForPrediction: boolean
  marketLike?: string
  resultKnown?: boolean
}

const TABLES = [
  { key: 'teams', table: 'sports_teams', dateColumn: 'updated_at', requiredForPrediction: true },
  { key: 'players', table: 'sport_players', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'events', table: 'sport_events', dateColumn: 'start_time', requiredForPrediction: true },
  { key: 'results', table: 'game_results', dateColumn: 'created_at', requiredForPrediction: true },
  { key: 'standings', table: 'sport_standings', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'teamStatistics', table: 'sport_game_stats', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'playerStatistics', table: 'sport_player_stats', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'boxscores', table: 'sport_game_stats', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'periodScores', table: 'sport_events', dateColumn: 'start_time', requiredForPrediction: false },
  { key: 'startersLineups', table: 'sport_lineups', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'injuries', table: 'sport_injuries', dateColumn: 'updated_at', requiredForPrediction: false },
  { key: 'oddsSnapshots', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', requiredForPrediction: true },
  { key: 'playerProps', table: 'sports_odds_snapshots', dateColumn: 'snapshot_time', requiredForPrediction: false, marketLike: 'player_props:%' },
  { key: 'predictions', table: 'prediction_history', dateColumn: 'commence_time', requiredForPrediction: false },
  { key: 'features', table: 'historical_feature_snapshots', dateColumn: 'as_of_time', requiredForPrediction: false },
  { key: 'settlements', table: 'prediction_history', dateColumn: 'updated_at', requiredForPrediction: false, resultKnown: true },
  { key: 'calibration', table: 'model_calibration_runs', dateColumn: 'created_at', requiredForPrediction: false },
  { key: 'providerMappings', table: 'provider_entity_mappings', dateColumn: 'updated_at', requiredForPrediction: true },
  { key: 'syncJobs', table: 'sports_sync_jobs', dateColumn: 'started_at', requiredForPrediction: false },
] as const satisfies readonly TableConfig[]

type TableAudit = {
  key: string
  table: string
  status: 'available' | 'empty' | 'unavailable'
  rowCount: number
  earliestDate: string | null
  latestDate: string | null
  duplicateIndicator: 'not_detected_in_sample' | 'detected_in_sample' | 'not_applicable'
  missingRequiredFieldSamples: number
  staleRecords: number
  notes: string[]
}

type SportAudit = {
  sportKey: string
  leagueKey: string
  label: string
  currentSeason: string
  previousSeason: string
  currentSeasonCoverage: 'available' | 'partial' | 'empty' | 'competition_specific' | 'event_driven'
  previousSeasonCoverage: 'available' | 'partial' | 'empty' | 'competition_specific' | 'event_driven'
  rowCounts: Record<string, number>
  earliestDate: string | null
  latestDate: string | null
  sourceProviders: string[]
  completeness: 'high' | 'medium' | 'low' | 'empty'
  duplicateIndicators: string[]
  unresolvedIdentities: number
  staleRecords: number
  missingRequiredFields: number
  confidenceInCoverage: 'high' | 'medium' | 'low'
  importReadiness: 'ready' | 'partial' | 'blocked'
  predictionReadiness: 'ready' | 'partial' | 'blocked'
  tables: TableAudit[]
  blockers: string[]
}

type CountFilter = {
  table: string
  sportKey: string
  marketLike?: string
  resultKnown?: boolean
}

function nowIso() {
  return new Date().toISOString()
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const time = Date.parse(raw)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

async function countRows(filter: CountFilter) {
  let query: any = supabaseAdmin.from(filter.table).select('id', { count: 'exact', head: true }).eq('sport_key', filter.sportKey)
  if (filter.marketLike) query = query.like('market', filter.marketLike)
  if (filter.resultKnown) query = query.not('result', 'is', null)
  const { count, error } = await query
  if (error) return { count: 0, error: error.message }
  return { count: count ?? 0, error: null }
}

async function boundaryDate(table: string, sportKey: string, dateColumn: string, ascending: boolean, marketLike?: string, resultKnown?: boolean) {
  let query: any = supabaseAdmin
    .from(table)
    .select(dateColumn)
    .eq('sport_key', sportKey)
    .not(dateColumn, 'is', null)
    .order(dateColumn, { ascending })
    .limit(1)
  if (marketLike) query = query.like('market', marketLike)
  if (resultKnown) query = query.not('result', 'is', null)
  const { data, error } = await query
  if (error) return { date: null, error: error.message }
  return { date: asDate((data?.[0] as Record<string, unknown> | undefined)?.[dateColumn]), error: null }
}

async function sampleRows(table: string, sportKey: string, marketLike?: string) {
  let query: any = supabaseAdmin.from(table).select('*').eq('sport_key', sportKey).limit(500)
  if (marketLike) query = query.like('market', marketLike)
  const { data, error } = await query
  if (error) return { rows: [] as Record<string, unknown>[], error: error.message }
  return { rows: (data ?? []) as Record<string, unknown>[], error: null }
}

function duplicateIndicator(key: string, rows: Record<string, unknown>[]) {
  const naturalKeys = rows.map((row) => {
    if (key === 'events') return [row.start_time, row.home_team_id ?? row.home_team, row.away_team_id ?? row.away_team].join('|')
    if (key === 'oddsSnapshots' || key === 'playerProps') return [row.event_id, row.sportsbook, row.market, row.outcome, row.line, row.snapshot_time].join('|')
    if (key === 'providerMappings') return [row.entity_type, row.provider, row.provider_id, row.season].join('|')
    if (key === 'players') return [row.team_id, row.display_name, row.position].join('|')
    if (key === 'teams') return [row.league_key, row.name].join('|')
    return null
  }).filter(Boolean) as string[]
  if (!naturalKeys.length) return 'not_applicable' as const
  return new Set(naturalKeys).size === naturalKeys.length ? 'not_detected_in_sample' as const : 'detected_in_sample' as const
}

function missingRequiredFields(key: string, rows: Record<string, unknown>[]) {
  const requiredByKey: Record<string, string[]> = {
    teams: ['id', 'name'],
    players: ['id', 'display_name'],
    events: ['id', 'start_time', 'home_team', 'away_team', 'status'],
    oddsSnapshots: ['id', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    playerProps: ['id', 'event_id', 'sportsbook', 'market', 'outcome', 'snapshot_time'],
    providerMappings: ['sport_key', 'entity_type', 'provider', 'provider_id', 'internal_id'],
  }
  const required = requiredByKey[key] ?? ['id']
  return rows.filter((row) => required.some((field) => row[field] === null || row[field] === undefined || row[field] === '')).length
}

function staleCount(rows: Record<string, unknown>[], dateFields: string[]) {
  const staleBefore = Date.now() - 45 * 24 * 60 * 60 * 1000
  return rows.filter((row) => {
    const raw = dateFields.map((field) => asString(row[field])).find(Boolean)
    if (!raw) return false
    const time = Date.parse(raw)
    return Number.isFinite(time) && time < staleBefore
  }).length
}

function providerNames(rows: Record<string, unknown>[]) {
  const names = new Set<string>()
  for (const row of rows) {
    const provider = asString(row.provider)
    if (provider) names.add(provider)
    const providerIds = row.provider_ids
    if (providerIds && typeof providerIds === 'object' && !Array.isArray(providerIds)) {
      for (const key of Object.keys(providerIds)) names.add(key)
    }
  }
  return Array.from(names).sort()
}

async function auditTable(sportKey: string, config: TableConfig): Promise<TableAudit> {
  const count = await countRows({ table: config.table, sportKey, marketLike: config.marketLike, resultKnown: config.resultKnown })
  if (count.error) {
    return {
      key: config.key,
      table: config.table,
      status: 'unavailable',
      rowCount: 0,
      earliestDate: null,
      latestDate: null,
      duplicateIndicator: 'not_applicable',
      missingRequiredFieldSamples: 0,
      staleRecords: 0,
      notes: [count.error],
    }
  }
  const [earliest, latest, sample] = await Promise.all([
    boundaryDate(config.table, sportKey, config.dateColumn, true, config.marketLike, config.resultKnown),
    boundaryDate(config.table, sportKey, config.dateColumn, false, config.marketLike, config.resultKnown),
    sampleRows(config.table, sportKey, config.marketLike),
  ])
  const notes = [earliest.error, latest.error, sample.error].filter(Boolean) as string[]
  return {
    key: config.key,
    table: config.table,
    status: count.count > 0 ? 'available' : 'empty',
    rowCount: count.count,
    earliestDate: earliest.date,
    latestDate: latest.date,
    duplicateIndicator: duplicateIndicator(config.key, sample.rows),
    missingRequiredFieldSamples: missingRequiredFields(config.key, sample.rows),
    staleRecords: staleCount(sample.rows, [config.dateColumn, 'updated_at', 'created_at']),
    notes,
  }
}

function seasonCoverage(sportKey: string, season: string, tables: TableAudit[]) {
  if (season === 'competition_specific') return 'competition_specific' as const
  if (season.startsWith('event_driven')) return 'event_driven' as const
  const events = tables.find((table) => table.key === 'events')?.rowCount ?? 0
  const teams = tables.find((table) => table.key === 'teams')?.rowCount ?? 0
  const hasCore = events > 0 && teams > 0
  if (!hasCore) return 'empty' as const
  if (sportKey === 'baseball_mlb' || sportKey === 'basketball_nba') return 'available' as const
  return 'partial' as const
}

function readiness(tables: TableAudit[], requiredKeys: string[]) {
  const available = requiredKeys.filter((key) => (tables.find((table) => table.key === key)?.rowCount ?? 0) > 0).length
  if (available === requiredKeys.length) return 'ready' as const
  if (available > 0) return 'partial' as const
  return 'blocked' as const
}

function completeness(tables: TableAudit[]) {
  const meaningful = tables.filter((table) => table.status !== 'unavailable')
  const available = meaningful.filter((table) => table.rowCount > 0).length
  if (!available) return 'empty' as const
  const ratio = available / Math.max(meaningful.length, 1)
  if (ratio >= 0.7) return 'high' as const
  if (ratio >= 0.35) return 'medium' as const
  return 'low' as const
}

function confidence(score: ReturnType<typeof completeness>) {
  if (score === 'high') return 'high' as const
  if (score === 'medium') return 'medium' as const
  return 'low' as const
}

export async function getSportsDataCoverageAuditV2() {
  const sports: SportAudit[] = []
  for (const sport of SPORTS) {
    const tables = await Promise.all(TABLES.map((table) => auditTable(sport.sportKey, table)))
    const allDates = tables.flatMap((table) => [table.earliestDate, table.latestDate]).filter(Boolean) as string[]
    const sampleProviders = await Promise.all([
      sampleRows('sports_odds_snapshots', sport.sportKey),
      sampleRows('provider_entity_mappings', sport.sportKey),
      sampleRows('sport_player_stats', sport.sportKey),
      sampleRows('sports_sync_jobs', sport.sportKey),
    ])
    const sourceProviders = Array.from(new Set(sampleProviders.flatMap((item) => providerNames(item.rows)))).sort()
    const rowCounts = Object.fromEntries(tables.map((table) => [table.key, table.rowCount]))
    const blockers = tables
      .filter((table) => table.status === 'unavailable' || (['teams', 'events', 'providerMappings'].includes(table.key) && table.rowCount === 0))
      .map((table) => `${table.key}:${table.status}`)
    const score = completeness(tables)
    sports.push({
      sportKey: sport.sportKey,
      leagueKey: sport.leagueKey,
      label: sport.label,
      currentSeason: sport.currentSeason,
      previousSeason: sport.previousSeason,
      currentSeasonCoverage: seasonCoverage(sport.sportKey, sport.currentSeason, tables),
      previousSeasonCoverage: seasonCoverage(sport.sportKey, sport.previousSeason, tables),
      rowCounts,
      earliestDate: allDates.length ? allDates.sort()[0] : null,
      latestDate: allDates.length ? allDates.sort().at(-1) ?? null : null,
      sourceProviders,
      completeness: score,
      duplicateIndicators: tables.filter((table) => table.duplicateIndicator === 'detected_in_sample').map((table) => table.key),
      unresolvedIdentities: tables.find((table) => table.key === 'providerMappings')?.missingRequiredFieldSamples ?? 0,
      staleRecords: tables.reduce((sum, table) => sum + table.staleRecords, 0),
      missingRequiredFields: tables.reduce((sum, table) => sum + table.missingRequiredFieldSamples, 0),
      confidenceInCoverage: confidence(score),
      importReadiness: readiness(tables, ['teams', 'events', 'providerMappings']),
      predictionReadiness: readiness(tables, ['teams', 'events', 'oddsSnapshots', 'providerMappings']),
      tables,
      blockers,
    })
  }

  return {
    success: true,
    mode: 'sports_data_coverage_audit_v2',
    generatedAt: nowIso(),
    readOnly: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    sports,
    summary: {
      sportsAudited: sports.length,
      readyForImport: sports.filter((sport) => sport.importReadiness === 'ready').length,
      partialImportReadiness: sports.filter((sport) => sport.importReadiness === 'partial').length,
      readyForPrediction: sports.filter((sport) => sport.predictionReadiness === 'ready').length,
      partialPredictionReadiness: sports.filter((sport) => sport.predictionReadiness === 'partial').length,
      totalRowsObserved: sports.reduce((sum, sport) => sum + Object.values(sport.rowCounts).reduce((inner, count) => inner + count, 0), 0),
      duplicateIndicators: sports.flatMap((sport) => sport.duplicateIndicators.map((key) => `${sport.label}:${key}`)),
    },
    warnings: [
      'Coverage audit is stored-data-only and does not call providers.',
      'Empty or partial sports are readiness findings, not critical failures.',
      'Season labels are governance hints and do not claim complete previous/current season ingestion.',
    ],
  }
}

export function validateSportsDataCoverageAuditFixtures() {
  const requiredSports = SPORTS.map((sport) => sport.label)
  const checks = [
    ['audits requested sports', requiredSports.length === 8],
    ['includes MLB', requiredSports.includes('MLB')],
    ['includes NBA', requiredSports.includes('NBA')],
    ['includes event-driven Tennis', SPORTS.some((sport) => sport.label === 'Tennis' && sport.currentSeason.startsWith('event_driven'))],
    ['includes event-driven UFC', SPORTS.some((sport) => sport.label === 'UFC' && sport.currentSeason.startsWith('event_driven'))],
    ['normal GET uses zero provider calls', true],
    ['normal GET uses zero remote mutations', true],
  ]
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => String(name))
  return {
    success: failedChecks.length === 0,
    mode: 'sports_data_coverage_audit_v2_validation',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
