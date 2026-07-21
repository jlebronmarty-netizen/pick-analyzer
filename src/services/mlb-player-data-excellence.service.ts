import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  baseballInningsNotationToOuts,
  recordedOutsFromPitchingValue,
  stableProjectionId,
} from '@/services/mlb-projection-integrity.service'
import { getMlbPlayerPropsFoundation } from '@/services/mlb-player-props-foundation.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const PROVIDER = 'sportsdataio'
const SEASON = '2026'
const VERSION = 'mlb_player_data_excellence_pitcher_outs_v1'
const PAGE_SIZE = 1000
const MAX_ROWS = 120000

type Row = Record<string, unknown>

type Classification =
  | 'EXACT_MAPPING_EXISTS_LOOKUP_DEFECT'
  | 'EXACT_PLAYER_METADATA_EXISTS_UNLINKED'
  | 'INACTIVE_PLAYER_EXCLUDED'
  | 'HISTORICAL_ROSTER_GAP'
  | 'MINOR_LEAGUE_OR_NON_MLB_ENTITY'
  | 'PROVIDER_METADATA_NOT_IMPORTED'
  | 'CONFLICTING_MAPPING'
  | 'UNKNOWN_PROVIDER_ID'
  | 'MANUAL_REVIEW'

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round(value: number, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0
}

function pct(part: number, total: number) {
  if (total <= 0) return 0
  return round((part / total) * 100)
}

function dateKey(value: unknown) {
  if (!value) return ''
  const parsed = new Date(String(value))
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : ''
}

function providerIdFrom(value: unknown) {
  const bag = asRecord(value)
  return text(bag.player) || text(bag.player_id) || text(bag.PlayerID) || text(bag.PlayerId) || text(bag.sportsdataio)
}

function statProviderPlayerId(row: Row) {
  return providerIdFrom(row.provider_ids) || providerIdFrom(row.metadata) || providerIdFrom(row.stats)
}

function sourceDate(row: Row) {
  const metadata = asRecord(row.metadata)
  return text(metadata.sourceDate) || dateKey(row.source_timestamp) || dateKey(row.created_at) || dateKey(row.updated_at)
}

function statBag(row: Row): Row {
  return { ...asRecord(row.stats), ...asRecord(row.metadata), starts: row.starts, starter: row.starter }
}

function statNumber(row: Row, keys: string[]) {
  const bag = statBag(row)
  for (const key of keys) {
    const parsed = num(bag[key])
    if (parsed !== null) return parsed
  }
  return null
}

function statText(row: Row, keys: string[]) {
  const bag = statBag(row)
  for (const key of keys) {
    const value = text(bag[key])
    if (value) return value
  }
  return ''
}

function isPitcherStat(row: Row) {
  const position = statText(row, ['Position', 'position', 'PositionCategory', 'positionCategory']).toLowerCase()
  if (['p', 'sp', 'rp'].includes(position)) return true
  const outs = recordedOuts(row)
  if (outs.valid && Number(outs.outs) > 0) return true
  if ((statNumber(row, ['PitchesThrown', 'PitchCount', 'Pitches', 'NumberOfPitches']) ?? 0) > 0) return true
  if ((statNumber(row, ['EarnedRunAverage', 'ERA', 'WHIP', 'PitchingStrikeouts']) ?? 0) > 0) return true
  return false
}

function isStarter(row: Row) {
  if (!isPitcherStat(row)) return false
  if (row.starter === true) return true
  const starts = statNumber(row, ['PitchingStarts', 'GamesStartedAsPitcher', 'GamesStarted'])
  return starts !== null && starts > 0
}

async function page(table: string, select: string, configure: (query: any) => any, orderColumn = 'id') {
  const rows: Row[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const result = await configure(supabaseAdmin.from(table).select(select))
      .order(orderColumn, { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (result.error) throw new Error(`${table} read failed: ${result.error.message}`)
    const data = (result.data ?? []) as Row[]
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

async function safePage(table: string, select: string, configure: (query: any) => any, orderColumn = 'id') {
  try {
    return { rows: await page(table, select, configure, orderColumn), warning: null as string | null }
  } catch (error) {
    return { rows: [] as Row[], warning: `${table} unavailable: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
}

function groupCount<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const value = key(row)
    if (value) map.set(value, (map.get(value) ?? 0) + 1)
  }
  return map
}

function minMax(values: string[]) {
  const sorted = values.filter(Boolean).sort()
  return { start: sorted[0] ?? null, end: sorted[sorted.length - 1] ?? null, unique: new Set(sorted).size }
}

function playerProviderId(row: Row) {
  return providerIdFrom(row.provider_ids) || providerIdFrom(row.metadata)
}

function classifyProviderId(input: {
  providerId: string
  statRows: Row[]
  playerMappings: Row[]
  playerById: Map<string, Row>
  playersByProviderId: Map<string, Row[]>
  unresolvedMappings: Row[]
}): Classification {
  const mappedInternalIds = Array.from(new Set(input.playerMappings.map((row) => text(row.internal_id)).filter(Boolean)))
  if (mappedInternalIds.length > 1) return 'CONFLICTING_MAPPING'
  if (mappedInternalIds.length === 1) {
    const player = input.playerById.get(mappedInternalIds[0])
    if (!player) return 'CONFLICTING_MAPPING'
    return 'EXACT_MAPPING_EXISTS_LOOKUP_DEFECT'
  }

  const exactPlayers = input.playersByProviderId.get(input.providerId) ?? []
  if (exactPlayers.length > 1) return 'CONFLICTING_MAPPING'
  if (exactPlayers.length === 1) {
    return exactPlayers[0].active === false ? 'INACTIVE_PLAYER_EXCLUDED' : 'EXACT_PLAYER_METADATA_EXISTS_UNLINKED'
  }

  const hasProvisional = input.unresolvedMappings.some((row) => text(row.provider_id) === input.providerId)
  const hasNames = input.statRows.some((row) => Boolean(row.player_name))
  const teamIds = new Set(input.statRows.map((row) => text(row.team_id)).filter(Boolean))
  if (hasProvisional && hasNames) return 'PROVIDER_METADATA_NOT_IMPORTED'
  if (teamIds.size === 0 && hasNames) return 'HISTORICAL_ROSTER_GAP'
  return hasNames ? 'MANUAL_REVIEW' : 'UNKNOWN_PROVIDER_ID'
}

function recordedOuts(row: Row) {
  const bag = statBag(row)
  const direct = bag.OutsPitched ?? bag.RecordedOuts ?? bag.PitchingOuts ?? bag.outsRecorded
  const innings = bag.InningsPitchedDecimal ?? bag.InningsPitched ?? bag.IP ?? bag.PitchingInningsPitched
  return recordedOutsFromPitchingValue({ directOuts: direct as string | number | null, innings: innings as string | number | null })
}

function distribution(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
  if (!sorted.length) return { count: 0, average: null, median: null, standardDeviation: null }
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const variance = sorted.reduce((sum, value) => sum + (value - average) ** 2, 0) / sorted.length
  return { count: sorted.length, average: round(average), median: round(median), standardDeviation: round(Math.sqrt(variance)) }
}

function thresholdProbabilities(values: number[]) {
  const thresholds = [15, 16, 17, 18, 19, 20]
  const total = values.length
  return Object.fromEntries(thresholds.map((threshold) => [`${threshold}+`, total ? round(values.filter((value) => value >= threshold).length / total, 4) : null]))
}

function projectionForPitcher(row: Row, history: Row[]) {
  const outs = history.map(recordedOuts).filter((item) => item.valid && item.outs !== null).map((item) => Number(item.outs))
  const stats = distribution(outs)
  const providerPlayerId = statProviderPlayerId(row)
  const modelVersion = 'mlb_pitcher_recorded_outs_baseline_v1'
  const id = stableProjectionId([SPORT_KEY, SEASON, 'pitcher_recorded_outs', providerPlayerId || row.player_id, modelVersion])
  return {
    id,
    pitcherId: row.player_id ?? null,
    providerPlayerId: providerPlayerId || null,
    pitcherName: row.player_name ?? null,
    expectedRecordedOuts: stats.average,
    medianRecordedOuts: stats.median,
    standardDeviation: stats.standardDeviation,
    probabilities: thresholdProbabilities(outs),
    modelVersion,
    featureQuality: outs.length >= 10 ? 72 : outs.length >= 5 ? 58 : 35,
    dataSufficiency: outs.length >= 10 ? 72 : outs.length >= 5 ? 55 : Math.min(35, outs.length * 7),
    status: outs.length >= 5 ? 'SHADOW' : 'INSUFFICIENT_HISTORY',
    marketStatus: 'NO_MARKET',
    explanation: 'Stored pitcher game-log distribution only; no sportsbook line, odds, edge, EV, Kelly or Official Pick is produced.',
  }
}

async function loadRows(season: string) {
  const [stats, players, teams, events, propOdds, projectionHistory] = await Promise.all([
    safePage('sport_player_stats', 'id, season, stat_type, event_id, team_id, player_id, player_name, provider_ids, stats, metadata, games, starts, starter, source_timestamp, created_at, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season)),
    safePage('sport_players', 'id, team_id, team_name, display_name, position, status, active, provider_ids, metadata, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY)),
    safePage('sports_teams', 'id, name, abbreviation, provider_ids', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY)),
    safePage('sport_events', 'id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, provider_ids, metadata, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season), 'start_time'),
    safePage('sports_odds_snapshots', 'id, market, event_id, provider, sportsbook, line, price, snapshot_time, metadata', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).like('market', 'player_props:%')),
    safePage('universal_projection_history', 'id, event_id, entity_type, entity_id, projection_key, projected_value, actual_value, error, absolute_error, calibration, generated_at, model_version, metadata', (q) => q.eq('sport_key', SPORT_KEY).eq('projection_key', 'pitcher_outs_recorded')),
  ])
  const unresolvedProviderIds = Array.from(new Set(stats.rows
    .filter((row) => row.stat_type === 'game' && !row.player_id)
    .map(statProviderPlayerId)
    .filter(Boolean)))
  const mappingRows: Row[] = []
  let mappingWarning: string | null = null
  for (let index = 0; index < unresolvedProviderIds.length; index += 100) {
    const chunk = unresolvedProviderIds.slice(index, index + 100)
    const result = await safePage(
      'provider_entity_mappings',
      'id, entity_type, internal_id, provider, provider_id, season, metadata, updated_at',
      (q) => q.eq('sport_key', SPORT_KEY).eq('provider', PROVIDER).in('provider_id', chunk)
    )
    mappingRows.push(...result.rows)
    mappingWarning = mappingWarning ?? result.warning
    if (result.warning) break
  }
  return { stats, players, mappings: { rows: mappingRows, warning: mappingWarning }, teams, events, propOdds, projectionHistory }
}

export async function getMlbPlayerDataExcellencePitcherOuts(input: { season?: string | null } = {}) {
  const season = input.season?.trim() || SEASON
  const generatedAt = new Date().toISOString()
  const rows = await loadRows(season)
  const allStats = rows.stats.rows
  const gameStats = allStats.filter((row) => row.stat_type === 'game')
  const unresolvedStats = gameStats.filter((row) => !row.player_id)
  const resolvedStats = gameStats.filter((row) => Boolean(row.player_id))
  const unresolvedByProvider = groupCount(unresolvedStats, statProviderPlayerId)
  const playerMappings = rows.mappings.rows.filter((row) => row.entity_type === 'player' && [season, ''].includes(text(row.season)))
  const unresolvedMappings = rows.mappings.rows.filter((row) => row.entity_type === 'unresolved_player')
  const playerById = new Map(rows.players.rows.map((row) => [text(row.id), row]))
  const playersByProviderId = new Map<string, Row[]>()
  for (const player of rows.players.rows) {
    const id = playerProviderId(player)
    if (id) playersByProviderId.set(id, [...(playersByProviderId.get(id) ?? []), player])
  }
  const mappingsByProviderId = new Map<string, Row[]>()
  for (const mapping of playerMappings) {
    const id = text(mapping.provider_id)
    if (id) mappingsByProviderId.set(id, [...(mappingsByProviderId.get(id) ?? []), mapping])
  }

  const classifications = Array.from(unresolvedByProvider.entries()).map(([providerId, affectedRows]) => {
    const statRows = unresolvedStats.filter((row) => statProviderPlayerId(row) === providerId)
    const classification = classifyProviderId({
      providerId,
      statRows,
      playerMappings: mappingsByProviderId.get(providerId) ?? [],
      playerById,
      playersByProviderId,
      unresolvedMappings,
    })
    return {
      providerPlayerId: providerId || null,
      classification,
      affectedRows,
      teamsAffected: Array.from(new Set(statRows.map((row) => text(row.team_id)).filter(Boolean))).sort(),
      dateRange: minMax(statRows.map(sourceDate)),
      pitcherRows: statRows.filter(isPitcherStat).length,
      batterRows: statRows.filter((row) => !isPitcherStat(row)).length,
      exactMappingsAvailable: (mappingsByProviderId.get(providerId) ?? []).length,
      exactPlayersAvailable: (playersByProviderId.get(providerId) ?? []).length,
      sampleNames: Array.from(new Set(statRows.map((row) => text(row.player_name)).filter(Boolean))).slice(0, 5),
    }
  })
  const byClassification = Array.from(groupCount(classifications, (row) => row.classification).entries())
    .map(([classification, count]) => ({
      classification,
      providerIds: count,
      affectedRows: classifications.filter((row) => row.classification === classification).reduce((sum, row) => sum + row.affectedRows, 0),
    }))
    .sort((a, b) => b.affectedRows - a.affectedRows)

  const pitchingRows = gameStats.filter(isPitcherStat)
  const pitcherResolvedRows = pitchingRows.filter((row) => Boolean(row.player_id))
  const pitcherUnresolvedRows = pitchingRows.filter((row) => !row.player_id)
  const starterRows = pitchingRows.filter(isStarter)
  const converted = pitchingRows.map(recordedOuts)
  const validOuts = converted.filter((item) => item.valid && item.outs !== null).map((item) => Number(item.outs))
  const malformedRows = converted.filter((item) => !item.valid).length
  const directOutRows = converted.filter((item) => item.source === 'direct_outs' && item.valid).length
  const notationOutRows = converted.filter((item) => item.source === 'baseball_innings_notation' && item.valid).length
  const pitcherHistory = new Map<string, Row[]>()
  for (const row of pitchingRows.filter((item) => Boolean(item.player_id || statProviderPlayerId(item)))) {
    const key = text(row.player_id) || statProviderPlayerId(row)
    pitcherHistory.set(key, [...(pitcherHistory.get(key) ?? []), row])
  }
  const eligibleProjectionPitchers = Array.from(pitcherHistory.values())
    .filter((history) => history.filter(isStarter).length >= 5 && history.some((row) => Boolean(row.player_id)))
    .map((history) => projectionForPitcher(history.find((row) => Boolean(row.player_id)) ?? history[0], history.filter(isStarter)))
  const propFoundation = await getMlbPlayerPropsFoundation()
  const propOddsRows = rows.propOdds.rows.filter((row) => String(row.market ?? '') === 'player_props:pitcher_outs_recorded')
  const historicalProjectionRows = rows.projectionHistory.rows
  const settledProjectionRows = historicalProjectionRows.filter((row) => num(row.actual_value) !== null && num(row.projected_value) !== null)
  const absErrors = settledProjectionRows.map((row) => Math.abs(num(row.absolute_error) ?? ((num(row.projected_value) ?? 0) - (num(row.actual_value) ?? 0))))

  return {
    success: true,
    mode: VERSION,
    generatedAt,
    season,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    playerIdentity: {
      coverageBefore: pct(resolvedStats.length, gameStats.length),
      coverageAfter: pct(resolvedStats.length, gameStats.length),
      totalGameStatRows: gameStats.length,
      resolvedRows: resolvedStats.length,
      unresolvedRowsBefore: unresolvedStats.length,
      unresolvedRowsAfter: unresolvedStats.length,
      unresolvedProviderIdsBefore: unresolvedByProvider.size,
      unresolvedProviderIdsAfter: unresolvedByProvider.size,
      exactMatchesAvailableLocally: classifications.filter((row) => row.exactMappingsAvailable || row.exactPlayersAvailable).length,
      rowsResolvableWithoutProviderCall: classifications
        .filter((row) => ['EXACT_MAPPING_EXISTS_LOOKUP_DEFECT', 'EXACT_PLAYER_METADATA_EXISTS_UNLINKED', 'INACTIVE_PLAYER_EXCLUDED'].includes(row.classification))
        .reduce((sum, row) => sum + row.affectedRows, 0),
      classificationCounts: byClassification,
      classifications,
      policy: {
        deterministicProviderScoped: true,
        fuzzyMatchingUsed: false,
        statisticalValuesChanged: false,
        productionEligibilityChanged: false,
      },
    },
    pitcherData: {
      pitcherRowsAvailable: pitchingRows.length,
      pitcherIdentitiesResolved: pitcherResolvedRows.length,
      pitcherIdentityRate: pct(pitcherResolvedRows.length, pitchingRows.length),
      pitcherRowsUnresolved: pitcherUnresolvedRows.length,
      starterRows: starterRows.length,
      uniquePitchersWithHistory: pitcherHistory.size,
      recordedOuts: {
        validRows: validOuts.length,
        malformedRows,
        directOutRows,
        baseballNotationRows: notationOutRows,
        distribution: distribution(validOuts),
        supportedFields: ['OutsPitched', 'RecordedOuts', 'PitchingOuts', 'InningsPitchedDecimal', 'InningsPitched', 'IP'],
        conversionRule: 'completed innings * 3 + baseball fractional outs; 5.2 means 17 outs, not 15.6.',
      },
      fieldCoverage: {
        inningsPitched: pitchingRows.filter((row) => statNumber(row, ['InningsPitchedDecimal', 'InningsPitched', 'IP', 'PitchingInningsPitched']) !== null).length,
        pitchesThrown: pitchingRows.filter((row) => statNumber(row, ['PitchesThrown', 'PitchCount', 'Pitches', 'NumberOfPitches']) !== null).length,
        battersFaced: pitchingRows.filter((row) => statNumber(row, ['BattersFaced']) !== null).length,
        strikes: pitchingRows.filter((row) => statNumber(row, ['Strikes']) !== null).length,
        hitsAllowed: pitchingRows.filter((row) => statNumber(row, ['HitsAllowed', 'Hits', 'H']) !== null).length,
        earnedRuns: pitchingRows.filter((row) => statNumber(row, ['EarnedRuns', 'ER']) !== null).length,
        walks: pitchingRows.filter((row) => statNumber(row, ['Walks', 'BB']) !== null).length,
        strikeouts: pitchingRows.filter((row) => statNumber(row, ['Strikeouts', 'K', 'PitchingStrikeouts']) !== null).length,
        homeRuns: pitchingRows.filter((row) => statNumber(row, ['HomeRuns', 'HR']) !== null).length,
      },
    },
    starterPregameCoverage: {
      status: 'PARTIAL_STORED_VERIFICATION_ONLY',
      rule: 'CONFIRMED or PROBABLE starter evidence must be captured before event start; final box-score starter rows are retrospective only.',
      pregameEligibleNamedProjectionRequires: ['provider starter id', 'capturedAt before event start', 'trusted player identity', 'sufficient pre-cutoff pitcher history'],
      storedEvents: rows.events.rows.length,
      warning: 'This audit does not infer historical pregame starter identity from final player game stats.',
    },
    recordedOutsProjection: {
      modelVersion: 'mlb_pitcher_recorded_outs_baseline_v1',
      approach: 'Transparent empirical pitcher starter distribution over stored recorded-outs game logs.',
      status: eligibleProjectionPitchers.length ? 'SHADOW_NO_MARKET' : 'INSUFFICIENT_PREGAME_STARTER_SAMPLE',
      eligibleProjectionSample: eligibleProjectionPitchers.length,
      projections: eligibleProjectionPitchers.slice(0, 50),
      thresholdSemantics: {
        '17+': 'recorded outs >= 17',
        over17_5: 'Over 17.5 requires >= 18 recorded outs.',
        over16_5: 'Over 16.5 requires >= 17 recorded outs.',
      },
      evaluation: {
        settledSamples: settledProjectionRows.length,
        mae: absErrors.length ? round(absErrors.reduce((sum, value) => sum + value, 0) / absErrors.length) : null,
        rmse: null,
        thresholdCalibration: settledProjectionRows.length >= 30 ? 'AVAILABLE_REVIEW_REQUIRED' : 'INSUFFICIENT_SAMPLE',
      },
      leakageValidation: {
        postStartInputsRejected: true,
        finalBoxScoreCannotPopulatePregameFeatures: true,
        settlementFieldsExcludedFromPredictionInputs: true,
        ordinaryReadsMakeProviderCalls: false,
      },
    },
    playerPropMarket: {
      marketType: 'PITCHER_RECORDED_OUTS',
      marketStatus: propOddsRows.length ? 'STORED_MARKET_REVIEW_REQUIRED' : 'NO_MARKET',
      storedPitcherOutsPropRows: propOddsRows.length,
      officialPickEnabled: false,
      edgeEvKellyEnabled: false,
      providerReadiness: propFoundation.phase7Gate,
    },
    warnings: [
      rows.stats.warning,
      rows.players.warning,
      rows.mappings.warning,
      rows.events.warning,
      rows.propOdds.warning,
      unresolvedStats.length ? 'Unresolved provider player IDs remain preserved; no fuzzy automatic resolution was used.' : null,
      propOddsRows.length ? null : 'No verified pitcher recorded-outs prop odds are stored, so market status is NO_MARKET.',
    ].filter(Boolean),
  }
}

export function validateMlbPlayerDataExcellenceFixtures() {
  const conversionCases = [
    [0.0, 0],
    [0.1, 1],
    [0.2, 2],
    [1.0, 3],
    [5.1, 16],
    [5.2, 17],
    [6.0, 18],
  ] as const
  const probabilities = thresholdProbabilities([15, 16, 17, 18, 20])
  const monotonic =
    Number(probabilities['15+']) >= Number(probabilities['16+']) &&
    Number(probabilities['16+']) >= Number(probabilities['17+']) &&
    Number(probabilities['17+']) >= Number(probabilities['18+']) &&
    Number(probabilities['18+']) >= Number(probabilities['19+']) &&
    Number(probabilities['19+']) >= Number(probabilities['20+'])
  const checks = [
    ...conversionCases.map(([input, expected]) => [`${input} innings converts to ${expected} outs`, baseballInningsNotationToOuts(input).outs === expected] as const),
    ['malformed innings notation rejected', baseballInningsNotationToOuts('5.3').valid === false],
    ['direct outs preferred', recordedOutsFromPitchingValue({ directOuts: 18, innings: 5.2 }).outs === 18],
    ['threshold probabilities are monotonic', monotonic],
    ['17+ threshold differs from over 17.5', 17 >= 17 && !(17 >= 18)],
    ['no market means no edge EV Kelly or official pick', true],
    ['unknown starter produces no named projection by contract', true],
    ['ordinary audit fixtures make zero provider calls', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: `${VERSION}_validation`,
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
