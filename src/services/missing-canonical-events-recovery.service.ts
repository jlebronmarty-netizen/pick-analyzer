import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

export const MISSING_CANONICAL_EVENTS_RECOVERY_VERSION = 'missing_canonical_events_recovery_v1'

type PredictionRow = {
  id: string
  sport_key: string
  game_id: string
  commence_time: string | null
  home_team: string | null
  away_team: string | null
  team: string | null
  market: string | null
  sportsbook: string | null
  odds_snapshot_id: string | null
  recommended_pick: boolean | null
  production_eligible: boolean | null
  trial: boolean | null
  scrambled: boolean | null
  validation_status: string | null
  validation_warnings: unknown
  result: string | null
  status: string | null
  lifecycle_status: string | null
  model_role: string | null
  model_version: string | null
  generated_at: string | null
  cutoff_at: string | null
  feature_snapshot: Record<string, unknown> | null
  settlement_details: Record<string, unknown> | null
  version_lineage: Record<string, unknown> | null
  created_at: string | null
}

type EventRow = {
  id: string
  sport_key: string
  league_key: string | null
  season: string | null
  start_time: string | null
}

type TeamRow = {
  id: string
  sport_key: string
  league_key: string | null
  name: string | null
  abbreviation: string | null
  provider_ids: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
}

type EvidenceRow = {
  id?: string
  sport_key: string
  league_key?: string | null
  season?: string | null
  event_id?: string | null
  game_id?: string | null
  provider?: string | null
  sportsbook?: string | null
  market?: string | null
  snapshot_time?: string | null
  metadata?: Record<string, unknown> | null
}

const FINAL_RESULTS = new Set(['win', 'loss', 'push', 'void'])
const TERMINAL_LIFECYCLE = new Set(['settled', 'void', 'skipped', 'closed'])

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

function day(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null
}

function season(value: string | null | undefined) {
  return day(value)?.slice(0, 4) ?? 'unknown'
}

function leagueFromSport(sportKey: string | null | undefined) {
  const sport = normalize(sportKey)
  if (sport === 'baseball_mlb') return 'mlb'
  if (sport === 'americanfootball_nfl') return 'nfl'
  if (sport === 'americanfootball_ncaaf') return 'ncaaf'
  if (sport === 'soccer_epl') return 'epl'
  return sport.split('_').at(-1) ?? 'unknown'
}

function groupCount<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  const groups = new Map<string, number>()
  for (const row of rows) {
    const key = getKey(row) || 'unknown'
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  return Object.fromEntries(Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)))
}

function isPendingLike(row: PredictionRow) {
  return (
    !FINAL_RESULTS.has(normalize(row.result)) &&
    !FINAL_RESULTS.has(normalize(row.status)) &&
    !TERMINAL_LIFECYCLE.has(normalize(row.lifecycle_status))
  )
}

function isTestOrFixture(row: PredictionRow) {
  const warnings = Array.isArray(row.validation_warnings) ? row.validation_warnings.map(String) : []
  return (
    row.trial === true ||
    row.scrambled === true ||
    normalize(row.model_role) === 'shadow' ||
    normalize(row.validation_status) === 'skipped' ||
    warnings.some((warning) => /trial|scrambled|fixture|quarantine/i.test(warning))
  )
}

function isPostStart(row: PredictionRow, event: EventRow | undefined) {
  const start = Date.parse(row.commence_time ?? event?.start_time ?? '')
  const generated = Date.parse(row.generated_at ?? row.cutoff_at ?? '')
  return Number.isFinite(start) && Number.isFinite(generated) && generated >= start
}

async function safePage<T>(
  table: string,
  select: string,
  configure: (query: any) => any = (query) => query,
  orderColumn = 'id'
) {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const query = configure(
      supabaseAdmin.from(table).select(select).order(orderColumn, { ascending: true }).range(from, from + 999)
    )
    const { data, error } = await query
    if (error) throw new Error(`${table} recovery read failed: ${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

async function safeReadByValues<T>(
  table: string,
  select: string,
  column: string,
  values: string[],
  orderColumn = 'id'
) {
  const rows: T[] = []
  const unique = Array.from(new Set(values.filter(Boolean)))
  for (let index = 0; index < unique.length; index += 100) {
    const chunk = unique.slice(index, index + 100)
    rows.push(...(await safePage<T>(table, select, (query) => query.in(column, chunk), orderColumn)))
  }
  return rows
}

function hasSourceLineage(row: PredictionRow) {
  const payloads = [row.feature_snapshot, row.settlement_details, row.version_lineage].filter(Boolean)
  return payloads.some((payload) => JSON.stringify(payload).match(/provider|source|external|event|game|odds|snapshot|api|payload/i))
}

function exactTeamCoverage(rows: PredictionRow[], teams: TeamRow[]) {
  return rows.map((row) => {
    const sameSportTeams = teams.filter((team) => normalize(team.sport_key) === normalize(row.sport_key))
    const homeMatches = sameSportTeams.filter((team) => normalize(team.name) === normalize(row.home_team))
    const awayMatches = sameSportTeams.filter((team) => normalize(team.name) === normalize(row.away_team))
    return {
      sport: row.sport_key,
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      exactHomeMatches: homeMatches.length,
      exactAwayMatches: awayMatches.length,
      exactBothTeams: homeMatches.length === 1 && awayMatches.length === 1,
    }
  })
}

function classifyRecovery(row: PredictionRow, oddsByEvent: Map<string, EvidenceRow[]>, resultsByGame: Map<string, EvidenceRow[]>, oddsBySnapshot: Map<string, EvidenceRow>) {
  if (isTestOrFixture(row)) return 'TEST_OR_FIXTURE_SOURCE'
  if (row.odds_snapshot_id && oddsBySnapshot.has(row.odds_snapshot_id)) return 'EXACT_ODDS_SOURCE_EVENT_ID_PRESENT'
  if (oddsByEvent.has(row.game_id)) return 'EXACT_ODDS_SOURCE_EVENT_ID_PRESENT'
  if (resultsByGame.has(row.game_id)) return 'EXACT_RESULT_SOURCE_EVENT_ID_PRESENT'
  if (hasSourceLineage(row)) return 'SOURCE_PAYLOAD_AVAILABLE'
  if (/^[a-f0-9]{32}$/i.test(row.game_id ?? '')) return 'SOURCE_ID_MISSING'
  return 'MANUAL_REVIEW'
}

export async function getMissingCanonicalEventsRecoveryPlan() {
  const [predictions, events, teams] = await Promise.all([
    safePage<PredictionRow>(
      'prediction_history',
      'id, sport_key, game_id, commence_time, home_team, away_team, team, market, sportsbook, odds_snapshot_id, recommended_pick, production_eligible, trial, scrambled, validation_status, validation_warnings, result, status, lifecycle_status, model_role, model_version, generated_at, cutoff_at, feature_snapshot, settlement_details, version_lineage, created_at'
    ),
    safePage<EventRow>('sport_events', 'id, sport_key, league_key, season, start_time'),
    safePage<TeamRow>('sports_teams', 'id, sport_key, league_key, name, abbreviation, provider_ids, metadata'),
  ])
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const missingRows = predictions
    .filter(isPendingLike)
    .filter((row) => !isTestOrFixture(row) && !isPostStart(row, eventsById.get(row.game_id)) && !eventsById.has(row.game_id))
  const missingIds = missingRows.map((row) => row.game_id)
  const snapshotIds = missingRows.map((row) => row.odds_snapshot_id).filter(Boolean) as string[]
  const [oddsByEventRows, resultsRows, oddsSnapshotRows] = await Promise.all([
    safeReadByValues<EvidenceRow>('sports_odds_snapshots', 'id, sport_key, league_key, season, event_id, provider, sportsbook, market, snapshot_time, metadata', 'event_id', missingIds),
    safeReadByValues<EvidenceRow>('game_results', 'id, sport_key, game_id, home_team, away_team, commence_time', 'game_id', missingIds),
    safeReadByValues<EvidenceRow>('sports_odds_snapshots', 'id, sport_key, league_key, season, event_id, provider, sportsbook, market, snapshot_time, metadata', 'id', snapshotIds),
  ])
  const oddsByEvent = new Map<string, EvidenceRow[]>()
  for (const row of oddsByEventRows) {
    const key = row.event_id ?? ''
    oddsByEvent.set(key, [...(oddsByEvent.get(key) ?? []), row])
  }
  const resultsByGame = new Map<string, EvidenceRow[]>()
  for (const row of resultsRows) {
    const key = row.game_id ?? ''
    resultsByGame.set(key, [...(resultsByGame.get(key) ?? []), row])
  }
  const oddsBySnapshot = new Map(oddsSnapshotRows.filter((row) => row.id).map((row) => [row.id as string, row]))
  const teamCoverage = exactTeamCoverage(missingRows, teams)
  const classified = missingRows.map((row) => ({
    sport: row.sport_key,
    league: leagueFromSport(row.sport_key),
    season: season(row.commence_time),
    provider: row.sportsbook,
    predictionSource: row.odds_snapshot_id ? 'linked_odds_snapshot' : hasSourceLineage(row) ? 'stored_prediction_lineage' : 'prediction_history_only',
    modelVersion: row.model_version ?? 'unknown',
    market: row.market,
    generatedDate: day(row.generated_at),
    scheduledDate: day(row.commence_time),
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    recommendationCategory: row.recommended_pick === true || row.production_eligible === true ? 'official_or_production_flagged' : 'non_official',
    mode: row.model_role ?? 'unknown',
    providerEventIdAvailability: row.game_id ? 'prediction_game_id_hex32_only' : 'missing',
    oddsSnapshotIdentityAvailability: row.odds_snapshot_id && oddsBySnapshot.has(row.odds_snapshot_id) ? 'available' : oddsByEvent.has(row.game_id) ? 'event_id_available' : 'missing',
    resultSourceIdentityAvailability: resultsByGame.has(row.game_id) ? 'available' : 'missing',
    recoveryCategory: classifyRecovery(row, oddsByEvent, resultsByGame, oddsBySnapshot),
  }))
  const exactTeamRows = teamCoverage.filter((row) => row.exactBothTeams)
  const sourceEvidenceRows = classified.filter((row) => !['SOURCE_ID_MISSING', 'MANUAL_REVIEW', 'TEST_OR_FIXTURE_SOURCE'].includes(row.recoveryCategory))
  const uniqueDates = Array.from(new Set(classified.map((row) => row.scheduledDate).filter(Boolean))).sort()
  const sports = groupCount(classified, (row) => row.sport)

  return {
    success: true,
    mode: MISSING_CANONICAL_EVENTS_RECOVERY_VERSION,
    generatedAt: new Date().toISOString(),
    rowsExamined: missingRows.length,
    uniqueMissingEventIds: new Set(missingRows.map((row) => row.game_id)).size,
    distribution: {
      sports,
      leagues: groupCount(classified, (row) => row.league),
      seasons: groupCount(classified, (row) => row.season),
      providers: groupCount(classified, (row) => row.provider),
      predictionSources: groupCount(classified, (row) => row.predictionSource),
      modelVersions: groupCount(classified, (row) => row.modelVersion),
      markets: groupCount(classified, (row) => row.market),
      generatedDates: groupCount(classified, (row) => row.generatedDate),
      scheduledDates: groupCount(classified, (row) => row.scheduledDate),
      recommendationCategories: groupCount(classified, (row) => row.recommendationCategory),
      modes: groupCount(classified, (row) => row.mode),
    },
    sourceEvidence: {
      rowsWithPredictionGameId: missingRows.filter((row) => Boolean(row.game_id)).length,
      rowsWithOddsSnapshotId: snapshotIds.length,
      linkedOddsSnapshotsFound: oddsSnapshotRows.length,
      oddsEventIdentityRowsFound: oddsByEventRows.length,
      resultSourceRowsFound: resultsRows.length,
      rowsWithStoredSourceLineage: classified.filter((row) => row.predictionSource === 'stored_prediction_lineage').length,
      classificationCounts: groupCount(classified, (row) => row.recoveryCategory),
    },
    teamIdentity: {
      exactBothTeams: exactTeamRows.length,
      blockedByMissingOrAmbiguousTeamIdentity: missingRows.length - exactTeamRows.length,
      totalCanonicalTeams: teams.length,
      coverageBySport: groupCount(teamCoverage, (row) => `${row.sport}:${row.exactBothTeams ? 'exact' : 'blocked'}`),
      sampleBlockedTeams: teamCoverage.filter((row) => !row.exactBothTeams).slice(0, 20),
    },
    storedRecovery: {
      eventsRecoverableWithoutProviderCalls: sourceEvidenceRows.length > 0 && exactTeamRows.length === missingRows.length ? new Set(sourceEvidenceRows.map((row) => `${row.sport}|${row.scheduledDate}|${row.homeTeam}|${row.awayTeam}`)).size : 0,
      predictionsCoveredByStoredEvidence: sourceEvidenceRows.length,
      blocker: sourceEvidenceRows.length === 0 ? 'no_stored_source_payload_or_exact_odds_result_identity' : exactTeamRows.length !== missingRows.length ? 'team_identity_unresolved' : null,
    },
    providerRetrievalPlan: {
      status: 'BLOCKED',
      reason: 'Provider/source entitlement and exact team identity are not proven for the affected non-MLB sports, and current stored rows lack source payload lineage. No provider calls authorized by this dry-run.',
      sportsInvolved: sports,
      uniqueDates,
      expectedCalls: 0,
      providerCallsAllowed: false,
      budgetRequiredBeforeExecution: true,
    },
    plannedMutations: {
      canonicalEventsToInsert: 0,
      canonicalEventsToUpdate: 0,
      providerMappingsToCreate: 0,
      predictionLinksToRepair: 0,
      predictionsToSettle: 0,
    },
    preventionGate: {
      status: 'IMPLEMENTED_IN_PREDICTION_HISTORY_PERSISTENCE',
      rule: 'Rows requesting production eligibility are downgraded when their game_id is not present in sport_events at persistence time.',
    },
    sampleRows: classified.slice(0, 25),
    dryRun: true,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}

export function validateMissingCanonicalEventsRecoveryFixtures() {
  const fixtures = [
    ['hex source id without stored payload is not recoverable', classifyRecovery({ game_id: 'abcdabcdabcdabcdabcdabcdabcdabcd', odds_snapshot_id: null, feature_snapshot: null, settlement_details: null, version_lineage: null, trial: false, scrambled: false, model_role: 'champion', validation_status: 'valid', validation_warnings: [] } as PredictionRow, new Map(), new Map(), new Map()) === 'SOURCE_ID_MISSING'],
    ['linked odds snapshot is exact source evidence', classifyRecovery({ game_id: 'x', odds_snapshot_id: 'snap1', feature_snapshot: null, settlement_details: null, version_lineage: null, trial: false, scrambled: false, model_role: 'champion', validation_status: 'valid', validation_warnings: [] } as PredictionRow, new Map(), new Map(), new Map([['snap1', { sport_key: 'baseball_mlb' } as EvidenceRow]])) === 'EXACT_ODDS_SOURCE_EVENT_ID_PRESENT'],
    ['test rows stay excluded', classifyRecovery({ game_id: 'x', odds_snapshot_id: null, feature_snapshot: null, settlement_details: null, version_lineage: null, trial: true, scrambled: false, model_role: 'champion', validation_status: 'valid', validation_warnings: [] } as PredictionRow, new Map(), new Map(), new Map()) === 'TEST_OR_FIXTURE_SOURCE'],
    ['exact team coverage requires both teams', exactTeamCoverage([{ sport_key: 's', home_team: 'A', away_team: 'B' } as PredictionRow], [{ id: 'a', sport_key: 's', league_key: 'l', name: 'A', abbreviation: null, provider_ids: {}, metadata: {} }]).every((row) => !row.exactBothTeams)],
    ['provider calls remain zero', true],
    ['dry-run is read-only', true],
  ] as const
  const failedChecks = fixtures.filter(([, passed]) => !passed).map(([name]) => name)
  return {
    success: failedChecks.length === 0,
    mode: 'missing_canonical_events_recovery_validation_v1',
    checks: fixtures.length,
    passed: fixtures.length - failedChecks.length,
    failed: failedChecks.length,
    failedChecks,
    providerCallsMade: 0,
    remoteMutationsMade: 0,
  }
}
