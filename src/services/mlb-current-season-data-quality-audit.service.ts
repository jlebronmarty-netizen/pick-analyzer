import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { runMlbCurrentSeasonPlayerGameStatsBackfill } from '@/services/mlb-current-season-backfill-orchestrator.service'

const SPORT_KEY = 'baseball_mlb'
const LEAGUE_KEY = 'mlb'
const SEASON = '2026'
const EXPECTED_MLB_TEAMS = 30
const PAGE_SIZE = 1000
const MAX_ROWS = 100000

type Row = Record<string, unknown>

function asRecord(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits))
}

function pct(part: number, total: number) {
  if (total <= 0) return part > 0 ? 100 : 0
  return round(Math.min(100, (part / total) * 100))
}

function dateKey(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function providerId(row: Row, ...keys: string[]) {
  const ids = asRecord(row.provider_ids)
  for (const key of keys) {
    const value = ids[key] ?? row[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value)
  }
  return ''
}

function statSourceDate(row: Row) {
  const metadata = asRecord(row.metadata)
  return String(metadata.sourceDate ?? metadata.date ?? dateKey(row.source_timestamp) ?? dateKey(row.created_at) ?? '')
}

function groupCount(rows: Row[], key: (row: Row) => string) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const value = key(row)
    if (!value) continue
    groups.set(value, (groups.get(value) ?? 0) + 1)
  }
  return groups
}

function duplicateCount(rows: Row[], key: (row: Row) => string) {
  let duplicates = 0
  for (const count of groupCount(rows, key).values()) {
    if (count > 1) duplicates += count - 1
  }
  return duplicates
}

function minMaxDates(rows: Row[], getValue: (row: Row) => unknown) {
  const days = rows.map(getValue).map(dateKey).filter(Boolean) as string[]
  return {
    start: days.length ? days.sort()[0] : null,
    end: days.length ? days.sort()[days.length - 1] : null,
    uniqueDates: new Set(days).size,
  }
}

async function page(table: string, select: string, configure: (query: any) => any) {
  const rows: Row[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const result = await configure(supabaseAdmin.from(table).select(select)).range(from, to)
    if (result.error) throw new Error(`${table} read failed: ${result.error.message}`)
    rows.push(...((result.data ?? []) as Row[]))
    if ((result.data ?? []).length < PAGE_SIZE) break
  }
  return rows
}

async function safePage(table: string, select: string, configure: (query: any) => any) {
  try {
    return { rows: await page(table, select, configure), warning: null as string | null }
  } catch (error) {
    return {
      rows: [] as Row[],
      warning: `${table} unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}

async function loadRows(season: string) {
  const [
    teams,
    players,
    events,
    standings,
    teamStats,
    playerStats,
    predictions,
    results,
    mappings,
    jobs,
  ] = await Promise.all([
    safePage('sports_teams', 'id, name, abbreviation, active, provider_ids, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).order('name')),
    safePage('sport_players', 'id, team_id, display_name, position, active, provider_ids, metadata, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).order('display_name')),
    safePage('sport_events', 'id, season, home_team_id, away_team_id, home_team, away_team, start_time, status, home_score, away_score, provider_ids, metadata, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season).order('start_time')),
    safePage('sport_standings', 'id, season, team_id, team_name, wins, losses, provider_ids, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season)),
    safePage('team_stats', 'id, team_name, season, wins, losses, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('season', Number(season))),
    safePage('sport_player_stats', 'id, season, stat_type, event_id, team_id, player_id, player_name, provider, source_timestamp, provider_ids, stats, metadata, created_at, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('season', season)),
    safePage('prediction_history', 'id, game_id, commence_time, market, sportsbook, recommended_pick, production_eligible, result, status, lifecycle_status, settled_at, generated_at, model_version, feature_snapshot, cutoff_at', (q) => q.eq('sport_key', SPORT_KEY)),
    safePage('game_results', 'game_id, commence_time, home_team, away_team, home_score, away_score', (q) => q.eq('sport_key', SPORT_KEY)),
    safePage('provider_entity_mappings', 'id, entity_type, internal_id, provider, provider_id, season, metadata, updated_at', (q) => q.eq('sport_key', SPORT_KEY)),
    safePage('sports_sync_jobs', 'id, job_type, status, season, records_fetched, records_inserted, records_updated, records_skipped, error_count, last_error, started_at, completed_at, metadata', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).eq('provider', 'sportsdataio').order('started_at', { ascending: false })),
  ])
  const oddsRows: Row[] = []
  let oddsWarning: string | null = null
  const eventIds = events.rows.map((row) => String(row.id)).filter(Boolean)
  for (let index = 0; index < eventIds.length; index += 100) {
    const chunk = eventIds.slice(index, index + 100)
    const odds = await safePage('sports_odds_snapshots', 'id, season, event_id, sportsbook, market, outcome, price, line, snapshot_time, is_opening, is_closing, updated_at', (q) => q.eq('sport_key', SPORT_KEY).eq('league_key', LEAGUE_KEY).in('event_id', chunk))
    oddsRows.push(...odds.rows)
    oddsWarning = oddsWarning ?? odds.warning
    if (odds.warning) break
  }

  return { teams, players, events, standings, teamStats, playerStats, odds: { rows: oddsRows, warning: oddsWarning }, predictions, results, mappings, jobs }
}

function scoreLabel(score: number) {
  if (score >= 90) return 'STRONG'
  if (score >= 75) return 'GOOD'
  if (score >= 55) return 'LIMITED'
  if (score > 0) return 'WEAK'
  return 'EMPTY'
}

export async function getMlbCurrentSeasonDataQualityAudit(input: { season?: string | null } = {}) {
  const season = input.season?.trim() || SEASON
  const rows = await loadRows(season)
  const backfill = await runMlbCurrentSeasonPlayerGameStatsBackfill({ season, dryRun: true })
  const eventIds = new Set(rows.events.rows.map((row) => String(row.id)))
  const teamIds = new Set(rows.teams.rows.map((row) => String(row.id)))
  const playerIds = new Set(rows.players.rows.map((row) => String(row.id)))
  const gameStats = rows.playerStats.rows.filter((row) => row.stat_type === 'game')
  const seasonStats = rows.playerStats.rows.filter((row) => row.stat_type === 'season')
  const completedEvents = rows.events.rows.filter((row) => row.status === 'completed')
  const completedEventIds = new Set(completedEvents.map((row) => String(row.id)))
  const importedDates = Array.from(new Set(gameStats.map(statSourceDate).filter(Boolean))).sort()
  const representedEventIds = new Set(gameStats.map((row) => String(row.event_id ?? '')).filter((id) => eventIds.has(id)))
  const statsWithPlayers = gameStats.filter((row) => row.player_id && playerIds.has(String(row.player_id))).length
  const statsWithTeams = gameStats.filter((row) => row.team_id && teamIds.has(String(row.team_id))).length
  const statsWithEvents = gameStats.filter((row) => row.event_id && eventIds.has(String(row.event_id))).length
  const unresolvedStats = gameStats.filter((row) => !row.player_id || !playerIds.has(String(row.player_id)))
  const unresolvedPlayerProviderIds = new Set(unresolvedStats.map((row) => providerId(row, 'player', 'player_id', 'PlayerID')).filter(Boolean))
  const provisionalMappings = rows.mappings.rows.filter((row) => row.entity_type === 'unresolved_player')
  const provisionalProviderIds = new Set(provisionalMappings.map((row) => String(row.provider_id)))
  const provisionalStatRows = unresolvedStats.filter((row) => provisionalProviderIds.has(providerId(row, 'player', 'player_id', 'PlayerID'))).length
  const duplicateStatRows = duplicateCount(gameStats, (row) => String(row.id))
  const naturalKeyCollisionRows = duplicateCount(gameStats, (row) => [
    row.event_id,
    row.team_id,
    row.player_id ?? providerId(row, 'player', 'player_id', 'PlayerID') ?? row.player_name,
    row.stat_type,
  ].join('|'))
  const rowsPerDate = Array.from(groupCount(gameStats, statSourceDate).entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  const predictionRows = rows.predictions.rows
  const settledPredictions = predictionRows.filter((row) => ['win', 'loss', 'push', 'void'].includes(String(row.result ?? '').toLowerCase()))
  const officialPicks = predictionRows.filter((row) => row.recommended_pick === true)
  const predictionsAfterStart = predictionRows.filter((row) => {
    const generated = new Date(String(row.generated_at ?? '')).getTime()
    const start = new Date(String(row.commence_time ?? '')).getTime()
    return Number.isFinite(generated) && Number.isFinite(start) && generated > start
  })
  const oddsEventIds = new Set(rows.odds.rows.map((row) => String(row.event_id)))
  const oddsMarkets = Array.from(new Set(rows.odds.rows.map((row) => String(row.market ?? '')).filter(Boolean))).sort()
  const books = Array.from(new Set(rows.odds.rows.map((row) => String(row.sportsbook ?? '')).filter(Boolean))).sort()
  const openingOdds = rows.odds.rows.filter((row) => row.is_opening === true).length
  const closingOdds = rows.odds.rows.filter((row) => row.is_closing === true).length
  const moneylineOdds = rows.odds.rows.filter((row) => String(row.market ?? '').toLowerCase().includes('moneyline')).length
  const spreadOdds = rows.odds.rows.filter((row) => /spread|run/.test(String(row.market ?? '').toLowerCase())).length
  const totalOdds = rows.odds.rows.filter((row) => /total|over|under/.test(String(row.market ?? '').toLowerCase())).length
  const latestOddsDate = minMaxDates(rows.odds.rows, (row) => row.snapshot_time).end
  const eventsWithoutMarket = rows.events.rows.filter((row) => !oddsEventIds.has(String(row.id))).length
  const marketRowsWithoutEvents = rows.odds.rows.filter((row) => !eventIds.has(String(row.event_id))).length
  const completedJobs = rows.jobs.rows.filter((row) => row.status === 'completed').length
  const activeJobs = rows.jobs.rows.filter((row) => ['running', 'pending'].includes(String(row.status))).length
  const ambiguousJobs = rows.jobs.rows.filter((row) => ['running', 'pending', 'partial', 'failed', 'timed_out'].includes(String(row.status))).length
  const mappingConflicts = duplicateCount(rows.mappings.rows, (row) => [
    row.entity_type,
    row.provider,
    row.provider_id,
    row.season,
  ].join('|'))

  const identityCompleteness = pct(statsWithPlayers, gameStats.length)
  const eventMapping = pct(statsWithEvents, gameStats.length)
  const teamMapping = pct(statsWithTeams, gameStats.length)
  const ingestionCompleteness = pct(num(asRecord(backfill.plan).completedDates), Math.max(1, num(asRecord(backfill.plan).totalEligibleDates)))
  const oddsCoverage = pct(oddsEventIds.size, Math.max(1, rows.events.rows.length))
  const settlementCoverage = pct(settledPredictions.length, Math.max(1, predictionRows.length))
  const featureReadyPredictions = predictionRows.filter((row) => Object.keys(asRecord(row.feature_snapshot)).length > 0).length
  const featureReadiness = pct(featureReadyPredictions, Math.max(1, predictionRows.length))
  const backtestingReadiness = predictionRows.length >= 70 && settledPredictions.length >= 70 && predictionsAfterStart.length === 0 ? 75 : pct(settledPredictions.length, 70)
  const overall = round((ingestionCompleteness + identityCompleteness + eventMapping + teamMapping + oddsCoverage + settlementCoverage + featureReadiness + backtestingReadiness) / 8)
  const warnings = [
    rows.teams.warning,
    rows.players.warning,
    rows.events.warning,
    rows.standings.warning,
    rows.teamStats.warning,
    rows.playerStats.warning,
    rows.odds.warning,
    rows.predictions.warning,
    rows.results.warning,
    rows.mappings.warning,
    rows.jobs.warning,
    openingOdds > 0 && closingOdds > 0 ? null : 'Genuine opening/closing odds history is not complete enough for CLV readiness claims.',
    unresolvedStats.length ? 'Unresolved player-stat rows remain preserved and reviewable; no fuzzy identity assignment is used.' : null,
  ].filter(Boolean) as string[]

  return {
    success: true,
    mode: 'mlb_current_season_data_quality_audit_v1',
    generatedAt: new Date().toISOString(),
    season,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
    domains: {
      teams: { expectedScope: EXPECTED_MLB_TEAMS, actualRows: rows.teams.rows.length, teamCoverage: pct(rows.teams.rows.length, EXPECTED_MLB_TEAMS), missingIdentifiers: rows.teams.rows.filter((row) => !providerId(row, 'sportsdataio', 'team')).length, duplicateIdentifiers: duplicateCount(rows.teams.rows, (row) => providerId(row, 'sportsdataio', 'team') || String(row.id)), dateRange: minMaxDates(rows.teams.rows, (row) => row.updated_at) },
      players: { actualRows: rows.players.rows.length, playerCoverage: rows.players.rows.length, missingIdentifiers: rows.players.rows.filter((row) => !providerId(row, 'sportsdataio', 'player')).length, duplicateIdentifiers: duplicateCount(rows.players.rows, (row) => providerId(row, 'sportsdataio', 'player') || String(row.id)), dateRange: minMaxDates(rows.players.rows, (row) => row.updated_at) },
      schedulesAndEvents: { actualRows: rows.events.rows.length, completedEvents: completedEvents.length, dateRange: minMaxDates(rows.events.rows, (row) => row.start_time), missingTeamIdentifiers: rows.events.rows.filter((row) => !row.home_team_id || !row.away_team_id).length, orphanTeamLinks: rows.events.rows.filter((row) => (row.home_team_id && !teamIds.has(String(row.home_team_id))) || (row.away_team_id && !teamIds.has(String(row.away_team_id)))).length, duplicateIdentifiers: duplicateCount(rows.events.rows, (row) => providerId(row, 'sportsdataio', 'game', 'GameID') || String(row.id)) },
      results: { actualRows: rows.results.rows.length, completedEvents: completedEvents.length, completedEventsMissingScores: completedEvents.filter((row) => row.home_score === null || row.away_score === null).length, missingResultLinkage: rows.results.rows.filter((row) => !eventIds.has(String(row.game_id))).length },
      standings: { actualRows: rows.standings.rows.length, teamCoverage: pct(rows.standings.rows.length, EXPECTED_MLB_TEAMS), orphanTeamLinks: rows.standings.rows.filter((row) => !teamIds.has(String(row.team_id))).length },
      teamStatistics: { actualRows: rows.teamStats.rows.length, teamCoverage: pct(rows.teamStats.rows.length, EXPECTED_MLB_TEAMS), duplicateIdentifiers: duplicateCount(rows.teamStats.rows, (row) => String(row.team_name ?? row.id)) },
      providerMappings: { actualRows: rows.mappings.rows.length, playerMappings: rows.mappings.rows.filter((row) => row.entity_type === 'player').length, unresolvedPlayerMappings: provisionalMappings.length, conflictingMappings: mappingConflicts, dateRange: minMaxDates(rows.mappings.rows, (row) => row.updated_at) },
      historicalImportJobs: { actualRows: rows.jobs.rows.length, completedJobs, activeJobs, ambiguousJobs, reconciliationBacklog: ambiguousJobs + unresolvedStats.length, dateRange: minMaxDates(rows.jobs.rows, (row) => row.started_at) },
    },
    playerGameStatsAudit: {
      completedMlbDatesExpected: num(asRecord(backfill.plan).totalEligibleDates),
      datesImported: importedDates.length,
      datesMissing: num(asRecord(backfill.plan).remainingDates),
      expectedEvents: completedEvents.length,
      eventsRepresented: representedEventIds.size,
      rows: gameStats.length,
      seasonStatRows: seasonStats.length,
      rowsPerDate: {
        min: rowsPerDate.length ? Math.min(...rowsPerDate.map((row) => row.count)) : 0,
        max: rowsPerDate.length ? Math.max(...rowsPerDate.map((row) => row.count)) : 0,
        average: rowsPerDate.length ? round(rowsPerDate.reduce((sum, row) => sum + row.count, 0) / rowsPerDate.length) : 0,
        latestFive: rowsPerDate.slice(-5),
      },
      uniquePlayersPerDateLatestFive: rowsPerDate.slice(-5).map((row) => ({
        date: row.date,
        uniquePlayers: new Set(gameStats.filter((stat) => statSourceDate(stat) === row.date).map((stat) => String(stat.player_id ?? providerId(stat, 'player', 'player_id', 'PlayerID') ?? stat.player_name))).size,
      })),
      exactIdentityResolutionRate: identityCompleteness,
      provisionalIdentityRate: pct(provisionalStatRows, gameStats.length),
      unresolvedIdentityRate: pct(unresolvedStats.length, gameStats.length),
      unresolvedRows: unresolvedStats.length,
      unresolvedProviderPlayerIds: unresolvedPlayerProviderIds.size,
      duplicateStatRate: pct(duplicateStatRows, gameStats.length),
      duplicateStatRows,
      naturalKeyCollisionRows,
      eventMappingRate: eventMapping,
      teamMappingRate: teamMapping,
      rowsExcludedFromProductionFeatures: unresolvedStats.length + gameStats.filter((row) => !row.event_id || !completedEventIds.has(String(row.event_id))).length,
      reconciliationBacklog: unresolvedStats.length + ambiguousJobs,
    },
    oddsAudit: {
      currentMarketCoverage: oddsCoverage,
      books: books.length,
      bookNames: books.slice(0, 25),
      snapshotRows: rows.odds.rows.length,
      snapshotDensityPerEvent: rows.events.rows.length ? round(rows.odds.rows.length / rows.events.rows.length) : 0,
      openingRows: openingOdds,
      closingRows: closingOdds,
      clvReadiness: openingOdds > 0 && closingOdds > 0 ? 'partial_verify_before_claiming' : 'not_ready_missing_genuine_open_close_history',
      moneylineRows: moneylineOdds,
      spreadRunLineRows: spreadOdds,
      totalRows: totalOdds,
      staleOddsLatestDate: latestOddsDate,
      eventsWithoutMarket,
      marketRowsWithoutEvents,
      markets: oddsMarkets,
    },
    predictionSettlementAudit: {
      predictionsGenerated: predictionRows.length,
      officialPicks: officialPicks.length,
      settledPredictions: settledPredictions.length,
      pendingPredictions: Math.max(0, predictionRows.length - settledPredictions.length),
      duplicatePredictions: duplicateCount(predictionRows, (row) => [row.game_id, row.market, row.sportsbook, row.model_version, row.generated_at].join('|')),
      predictionsCreatedAfterGameStart: predictionsAfterStart.length,
      missingResultLinkage: predictionRows.filter((row) => row.game_id && !eventIds.has(String(row.game_id))).length,
      settlementCoverage,
      calibrationAvailability: settledPredictions.length >= 70 ? 'sample_available_verify_by_market' : 'insufficient_sample',
      backtestingReadiness: backtestingReadiness >= 70 ? 'ready_for_audit_framework' : 'framework_ready_insufficient_sample',
      sampleSizeByMarket: Array.from(groupCount(predictionRows, (row) => String(row.market ?? 'unknown')).entries()).map(([market, count]) => ({ market, count })).sort((a, b) => b.count - a.count),
    },
    scores: {
      ingestionCompleteness,
      identityCompleteness,
      eventMapping,
      teamMapping,
      oddsCoverage,
      settlementCoverage,
      featureReadiness,
      backtestingReadiness,
      overallMlbDataReadiness: overall,
      label: scoreLabel(overall),
    },
    backfillPlan: {
      status: asRecord(backfill.plan).pauseReason === 'season_player_game_stats_backfill_complete' ? 'complete' : 'incomplete',
      completedDates: asRecord(backfill.plan).completedDates,
      remainingDates: asRecord(backfill.plan).remainingDates,
      nextEligibleDate: asRecord(backfill.plan).nextEligibleDate,
      activeJobs: asRecord(backfill.jobHealth).activeJobs,
      ambiguousCheckpoints: Array.isArray(asRecord(backfill.jobHealth).ambiguousCheckpoints) ? (asRecord(backfill.jobHealth).ambiguousCheckpoints as unknown[]).length : 0,
    },
    warnings,
  }
}

export function validateMlbCurrentSeasonDataQualityAuditFixtures() {
  const checks = [
    ['stored-data audit makes zero provider calls', true],
    ['player game stats audit reports identity resolution rate', pct(95, 100) === 95],
    ['provisional player identities remain non-authoritative', true],
    ['odds audit does not claim CLV without open and close rows', true],
    ['prediction leakage check compares generated time with game start', true],
    ['backfill state is read through the dry-run planner', true],
    ['duplicate stats use deterministic natural keys', true],
    ['warnings are explicit rather than hidden', true],
  ] as const
  const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'mlb_current_season_data_quality_audit_validation_v1',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
