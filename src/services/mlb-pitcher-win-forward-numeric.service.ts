import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { applyNumericCatBoostProbability, type NumericCatBoostModel } from '@/lib/catboost-oblivious-numeric'

import model0 from '../../python_models/pitcher_win_forward_numeric_model_0.json'
import model1 from '../../python_models/pitcher_win_forward_numeric_model_1.json'

const TIME_ZONE = 'America/Puerto_Rico'
const SEASON = 2026
const FORWARD_MIN_DATE = '2026-09-20'
const RECENT_START_DATE = '2026-09-18'
const FREEZE_HOUR = 10
const FREEZE_MINUTE = 45
const FREEZE_END_MINUTE = 11 * 60
const THRESHOLD = 0.15
const MODEL_VERSION = 'pitcher_win_forward_numeric_p015_v1'
const MODEL_CONTRACT = 'MLB_PITCHER_WIN_FORWARD_NUMERIC_V1_FROZEN_CANDIDATE/1.0.0'
const FEATURE_CONTRACT = 'DEPLOYABLE_EXACT_PARITY_NUMERIC_V1'
const FREEZE_JOB_TYPE = 'pitcher_win_forward_numeric_freeze_v1'
const SETTLEMENT_JOB_TYPE = 'pitcher_win_forward_numeric_settlement_v1'
const PROVIDER = 'internal-model'
const PAGE_SIZE = 1000

const MODEL_FILES = [
  {
    path: 'python_models/pitcher_win_forward_numeric_model_0.json',
    sha256: '1a65260e5a3d97a647dc990f433bfd27b8750e4557a1a33e02e9a0e07d4b2fda',
  },
  {
    path: 'python_models/pitcher_win_forward_numeric_model_1.json',
    sha256: '13cfa39ecb8713580d740bb798279ce68bc2f301bb541eb09ed1f7bbd5211432',
  },
] as const

const FEATURE_NAMES = [
  'starter_is_home',
  'game_number',
  'doubleheader_flag',
  'own_games_prior',
  'opp_games_prior',
  'own_win_pct',
  'opp_win_pct',
  'own_run_diff_pg',
  'opp_run_diff_pg',
  'own_pyth_win_pct',
  'opp_pyth_win_pct',
  'own_l5_games',
  'opp_l5_games',
  'own_l5_win_pct',
  'opp_l5_win_pct',
  'own_l5_run_diff_pg',
  'opp_l5_run_diff_pg',
  'own_l10_games',
  'opp_l10_games',
  'own_l10_win_pct',
  'opp_l10_win_pct',
  'own_l10_run_diff_pg',
  'opp_l10_run_diff_pg',
  'own_rest_days',
  'opp_rest_days',
  'side_h2h_win_pct',
  'prior_starts',
  'prior_wins',
  'prior_win_rate',
] as const

const MLB_TEAM_BY_ID: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL',
  139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CHW', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

type SlatePitcher = { id: number; name: string }

type SlateGame = {
  gamePk: number
  startTime: string
  gameNumber: number
  doubleheaderFlag: boolean
  homeTeam: string
  awayTeam: string
  homeModelTeam: string
  awayModelTeam: string
  homePitcher: SlatePitcher | null
  awayPitcher: SlatePitcher | null
}

type TeamGame = {
  game_pk: number
  game_date: string
  team: string
  opponent: string
  runs_for: number | null
  runs_against: number | null
  win: number | null
  source_lineage: string | null
}

type HistoricalDecision = {
  game_date: string
  starter_mlbam_id: number
  y_win: number
}

type RecentStarter = {
  game_pk: number
  game_date: string
  pitcher_mlbam_id: number
}

type FeatureSummary = {
  games: number
  winPct: number | null
  runDiffPg: number | null
  pythWinPct: number | null
  l5Games: number
  l5WinPct: number | null
  l5RunDiffPg: number | null
  l10Games: number
  l10WinPct: number | null
  l10RunDiffPg: number | null
  restDays: number | null
}

type TrackerRow = {
  tracking_date: string
  game_pk: number
  start_time: string
  home_team: string
  away_team: string
  starter_mlbam_id: number
  pitcher_name: string
  starter_side: 'home' | 'away'
  team: string
  opponent: string
  model_version: string
  model_contract: string
  feature_contract: string
  threshold: number
  p_win: number
  selected_no: boolean
  feature_snapshot: Record<string, unknown>
  model_files: readonly Record<string, string>[]
  frozen_at: string
  outcome_status: 'OPEN'
  research_only: true
  production_eligible: false
  official_picks_eligible: false
  apostar_enabled: false
}

function dateInTimeZone(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function minuteOfDay(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return Number(parts.hour) * 60 + Number(parts.minute)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function normalizeTeam(team: string) {
  if (team === 'CHW') return 'CWS'
  if (team === 'ARI') return 'AZ'
  return team
}

function teamAliases(team: string) {
  if (team === 'CWS') return ['CWS', 'CHW']
  if (team === 'AZ') return ['AZ', 'ARI']
  return [team]
}

function finite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function average(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function pythagorean(runsFor: number, runsAgainst: number) {
  const rf = runsFor > 0 ? runsFor ** 1.83 : 0
  const ra = runsAgainst > 0 ? runsAgainst ** 1.83 : 0
  return rf + ra > 0 ? rf / (rf + ra) : null
}

function sha256(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function officialSlate(targetDate: string): Promise<SlateGame[]> {
  const url = new URL('https://statsapi.mlb.com/api/v1/schedule')
  url.searchParams.set('sportId', '1')
  url.searchParams.set('date', targetDate)
  url.searchParams.set('gameTypes', 'R')
  url.searchParams.set('hydrate', 'probablePitcher')

  const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`PITCHER_WIN_FORWARD_SCHEDULE_HTTP_${response.status}`)
  const payload = await response.json() as any
  const games = (payload?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])
  const result: SlateGame[] = []

  for (const game of games) {
    const gamePk = Number(game?.gamePk)
    const detailed = String(game?.status?.detailedState ?? '').toLowerCase()
    if (!Number.isSafeInteger(gamePk) || gamePk <= 0) continue
    if (detailed.includes('postpon') || detailed.includes('cancel')) continue

    const homeTeam = MLB_TEAM_BY_ID[Number(game?.teams?.home?.team?.id)]
    const awayTeam = MLB_TEAM_BY_ID[Number(game?.teams?.away?.team?.id)]
    const startTime = String(game?.gameDate ?? '')
    if (!homeTeam || !awayTeam || !Number.isFinite(Date.parse(startTime))) {
      throw new Error(`PITCHER_WIN_FORWARD_GAME_IDENTITY:${gamePk}`)
    }

    const hp = game?.teams?.home?.probablePitcher
    const ap = game?.teams?.away?.probablePitcher
    const hpId = Number(hp?.id)
    const apId = Number(ap?.id)

    result.push({
      gamePk,
      startTime,
      gameNumber: Number.isFinite(Number(game?.gameNumber)) ? Number(game.gameNumber) : 1,
      doubleheaderFlag: String(game?.doubleHeader ?? 'N') !== 'N',
      homeTeam,
      awayTeam,
      homeModelTeam: normalizeTeam(homeTeam),
      awayModelTeam: normalizeTeam(awayTeam),
      homePitcher: Number.isSafeInteger(hpId) && hpId > 0 && typeof hp?.fullName === 'string'
        ? { id: hpId, name: hp.fullName }
        : null,
      awayPitcher: Number.isSafeInteger(apId) && apId > 0 && typeof ap?.fullName === 'string'
        ? { id: apId, name: ap.fullName }
        : null,
    })
  }

  return result.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.gamePk - b.gamePk)
}

async function readPaged<T>(table: string, columns: string, configure: (query: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await configure(supabaseAdmin.from(table).select(columns))
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`PITCHER_WIN_FORWARD_READ:${table}:${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadTeamGames(targetDate: string, teams: string[]) {
  const aliases = [...new Set(teams.flatMap(teamAliases))]
  const rows = await readPaged<TeamGame>(
    'mlb_pitcher_win_forward_team_game_v1',
    'game_pk,game_date,team,opponent,runs_for,runs_against,win,source_lineage',
    (query) => query
      .lt('game_date', targetDate)
      .in('team', aliases)
      .order('game_date', { ascending: false })
      .order('game_pk', { ascending: false }),
  )

  const incomplete = rows.filter((row) =>
    row.game_date >= RECENT_START_DATE &&
    (row.runs_for === null || row.runs_against === null || row.win === null)
  )
  if (incomplete.length) {
    throw new Error(`PITCHER_WIN_FORWARD_INCOMPLETE_RECENT_TEAM_HISTORY:${incomplete.length}`)
  }

  return rows.map((row) => ({
    ...row,
    team: normalizeTeam(String(row.team)),
    opponent: normalizeTeam(String(row.opponent)),
  }))
}

function teamSummary(team: string, targetDate: string, rows: TeamGame[]): FeatureSummary {
  const games = rows
    .filter((row) => normalizeTeam(String(row.team)) === team && row.game_date < targetDate)
    .sort((a, b) => b.game_date.localeCompare(a.game_date) || Number(b.game_pk) - Number(a.game_pk))

  const summarizeWindow = (items: TeamGame[]) => ({
    games: items.length,
    winPct: average(items.map((row) => finite(row.win))),
    runDiffPg: average(items.map((row) => {
      const rf = finite(row.runs_for)
      const ra = finite(row.runs_against)
      return rf === null || ra === null ? null : rf - ra
    })),
  })

  const seasonWindow = summarizeWindow(games)
  const l5 = summarizeWindow(games.slice(0, 5))
  const l10 = summarizeWindow(games.slice(0, 10))
  const runsFor = games.reduce((sum, row) => sum + (finite(row.runs_for) ?? 0), 0)
  const runsAgainst = games.reduce((sum, row) => sum + (finite(row.runs_against) ?? 0), 0)
  const latestDate = games[0]?.game_date ?? null
  const restDays = latestDate
    ? Math.max(0, Math.round((Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${latestDate}T00:00:00Z`)) / 86_400_000) - 1)
    : null

  return {
    games: seasonWindow.games,
    winPct: seasonWindow.winPct,
    runDiffPg: seasonWindow.runDiffPg,
    pythWinPct: pythagorean(runsFor, runsAgainst),
    l5Games: l5.games,
    l5WinPct: l5.winPct,
    l5RunDiffPg: l5.runDiffPg,
    l10Games: l10.games,
    l10WinPct: l10.winPct,
    l10RunDiffPg: l10.runDiffPg,
    restDays,
  }
}

function h2hWinPct(team: string, opponent: string, targetDate: string, rows: TeamGame[]) {
  return average(
    rows
      .filter((row) =>
        normalizeTeam(String(row.team)) === team &&
        normalizeTeam(String(row.opponent)) === opponent &&
        row.game_date < targetDate
      )
      .map((row) => finite(row.win)),
  )
}

async function pitcherPriorCounts(targetDate: string, pitcherIds: number[]) {
  if (!pitcherIds.length) return new Map<number, { starts: number; wins: number }>()

  const rows = await readPaged<HistoricalDecision>(
    'mlb_pitcher_win_forward_starter_history_v1',
    'game_date,starter_mlbam_id,y_win',
    (query) => query
      .eq('season', SEASON)
      .lt('game_date', targetDate)
      .in('starter_mlbam_id', pitcherIds)
      .order('game_date', { ascending: true }),
  )

  const unresolved = rows.filter((row) => row.y_win === null || row.y_win === undefined)
  if (unresolved.length) {
    throw new Error(`PITCHER_WIN_FORWARD_PRIOR_DECISIONS_UNRESOLVED:${unresolved.length}`)
  }

  const counts = new Map<number, { starts: number; wins: number }>()
  for (const row of rows) {
    const pitcherId = Number(row.starter_mlbam_id)
    const prior = counts.get(pitcherId) ?? { starts: 0, wins: 0 }
    prior.starts += 1
    if (Number(row.y_win) === 1) prior.wins += 1
    counts.set(pitcherId, prior)
  }
  return counts
}

export async function syncPitcherWinForwardHistory(targetDate: string) {
  const starterSync = await supabaseAdmin.rpc('sync_mlb_pitcher_win_forward_starter_history_v1', {
    p_target_date: targetDate,
  })
  if (starterSync.error) {
    throw new Error(`PITCHER_WIN_FORWARD_STARTER_SYNC:${starterSync.error.message}`)
  }

  const winners = await decisionWinners(targetDate, targetDate)
  const { data: rows, error } = await supabaseAdmin
    .from('mlb_pitcher_win_forward_starter_history_v1')
    .select('game_pk,starter_side,starter_mlbam_id,y_win')
    .eq('season', SEASON)
    .eq('game_date', targetDate)
  if (error) throw new Error(`PITCHER_WIN_FORWARD_SYNC_READ:${error.message}`)

  const unresolvedGames = [...new Set((rows ?? [])
    .filter((row) => !winners.has(Number(row.game_pk)))
    .map((row) => Number(row.game_pk)))]
  if (unresolvedGames.length) {
    return {
      success: false,
      status: 'WAITING_FOR_FINAL_DECISIONS',
      targetDate,
      starterRows: rows?.length ?? 0,
      unresolvedGamePks: unresolvedGames,
      labeledStarterRows: 0,
      researchOnly: true,
      officialPicksModified: false,
      apostarActivated: false,
    }
  }

  let labeled = 0
  for (const row of rows ?? []) {
    const winnerId = winners.get(Number(row.game_pk))!
    const yWin = Number(row.starter_mlbam_id) === winnerId ? 1 : 0
    const update = await supabaseAdmin
      .from('mlb_pitcher_win_forward_starter_history_v1')
      .update({
        y_win: yWin,
        outcome_source: 'MLB_OFFICIAL_DECISIONS_FORWARD_SYNC_V1',
        updated_at: new Date().toISOString(),
      })
      .eq('season', SEASON)
      .eq('game_pk', row.game_pk)
      .eq('starter_side', row.starter_side)
    if (update.error) throw new Error(`PITCHER_WIN_FORWARD_SYNC_UPDATE:${update.error.message}`)
    labeled += 1
  }

  return {
    success: true,
    status: 'HISTORY_SYNCED',
    targetDate,
    resolvedGames: winners.size,
    starterRows: rows?.length ?? 0,
    labeledStarterRows: labeled,
    researchOnly: true,
    officialPicksModified: false,
    apostarActivated: false,
  }
}

function featureVector({
  game,
  side,
  pitcherId,
  targetDate,
  teamRows,
  decisions,
}: {
  game: SlateGame
  side: 'home' | 'away'
  pitcherId: number
  targetDate: string
  teamRows: TeamGame[]
  decisions: Map<number, { starts: number; wins: number }>
}) {
  const own = side === 'home' ? game.homeModelTeam : game.awayModelTeam
  const opp = side === 'home' ? game.awayModelTeam : game.homeModelTeam
  const ownSummary = teamSummary(own, targetDate, teamRows)
  const oppSummary = teamSummary(opp, targetDate, teamRows)
  const prior = decisions.get(pitcherId) ?? { starts: 0, wins: 0 }
  const priorWinRate = prior.starts > 0 ? prior.wins / prior.starts : null

  const named: Record<string, number | null> = {
    starter_is_home: side === 'home' ? 1 : 0,
    game_number: game.gameNumber,
    doubleheader_flag: game.doubleheaderFlag ? 1 : 0,
    own_games_prior: ownSummary.games,
    opp_games_prior: oppSummary.games,
    own_win_pct: ownSummary.winPct,
    opp_win_pct: oppSummary.winPct,
    own_run_diff_pg: ownSummary.runDiffPg,
    opp_run_diff_pg: oppSummary.runDiffPg,
    own_pyth_win_pct: ownSummary.pythWinPct,
    opp_pyth_win_pct: oppSummary.pythWinPct,
    own_l5_games: ownSummary.l5Games,
    opp_l5_games: oppSummary.l5Games,
    own_l5_win_pct: ownSummary.l5WinPct,
    opp_l5_win_pct: oppSummary.l5WinPct,
    own_l5_run_diff_pg: ownSummary.l5RunDiffPg,
    opp_l5_run_diff_pg: oppSummary.l5RunDiffPg,
    own_l10_games: ownSummary.l10Games,
    opp_l10_games: oppSummary.l10Games,
    own_l10_win_pct: ownSummary.l10WinPct,
    opp_l10_win_pct: oppSummary.l10WinPct,
    own_l10_run_diff_pg: ownSummary.l10RunDiffPg,
    opp_l10_run_diff_pg: oppSummary.l10RunDiffPg,
    own_rest_days: ownSummary.restDays,
    opp_rest_days: oppSummary.restDays,
    side_h2h_win_pct: h2hWinPct(own, opp, targetDate, teamRows),
    prior_starts: prior.starts,
    prior_wins: prior.wins,
    prior_win_rate: priorWinRate,
  }

  const values = FEATURE_NAMES.map((name) => named[name] === null ? Number.NaN : Number(named[name]))
  return { named, values, own, opp }
}

async function existingRows(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('mlb_pitcher_win_forward_tracker_v1')
    .select('id,game_pk,starter_mlbam_id,starter_side,p_win,selected_no,frozen_at,outcome_status')
    .eq('tracking_date', targetDate)
    .eq('model_version', MODEL_VERSION)
    .order('game_pk', { ascending: true })
  if (error) throw new Error(`PITCHER_WIN_FORWARD_EXISTING_READ:${error.message}`)
  return data ?? []
}

export type PitcherWinForwardFreezeInput = {
  targetDate?: string
  now?: Date
  historyReadiness?: { ready: boolean; targetDate: string } | null
}

export async function freezePitcherWinForwardNumeric(input: PitcherWinForwardFreezeInput = {}) {
  const now = input.now ?? new Date()
  const today = dateInTimeZone(now)
  const targetDate = input.targetDate ?? today
  const base = {
    success: true,
    candidateId: MODEL_VERSION,
    modelContract: MODEL_CONTRACT,
    featureContract: FEATURE_CONTRACT,
    targetDate,
    threshold: THRESHOLD,
    direction: 'NO',
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    oddsApiCalls: 0,
    writes: 0,
  }

  if (targetDate < FORWARD_MIN_DATE) return { ...base, status: 'NOT_IN_PROSPECTIVE_WINDOW' }
  if (targetDate !== today) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }

  const minute = minuteOfDay(now)
  const startMinute = FREEZE_HOUR * 60 + FREEZE_MINUTE
  if (minute < startMinute) return { ...base, status: 'NOT_IN_FREEZE_WINDOW' }
  if (minute >= FREEZE_END_MINUTE) return { ...base, success: false, status: 'BLOCK_FREEZE_WINDOW_MISSED' }

  const previousDate = addDays(targetDate, -1)
  if (!input.historyReadiness?.ready || input.historyReadiness.targetDate !== previousDate) {
    return { ...base, success: false, status: 'BLOCK_DAILY_HISTORY_NOT_READY', previousDate }
  }

  const prior = await existingRows(targetDate)
  if (prior.length) {
    return {
      ...base,
      status: 'REUSE_NO_OP',
      observations: prior.length,
      selected: prior.filter((row) => row.selected_no === true).length,
      frozenAt: prior[0]?.frozen_at ?? null,
    }
  }

  const slate = await officialSlate(targetDate)
  if (!slate.length) return { ...base, status: 'NO_SCHEDULED_GAMES', games: 0 }

  const earliestStart = Math.min(...slate.map((game) => Date.parse(game.startTime)))
  if (!Number.isFinite(earliestStart) || now.getTime() >= earliestStart) {
    return { ...base, success: false, status: 'BLOCK_FREEZE_AFTER_FIRST_PITCH', games: slate.length }
  }

  const teams = [...new Set(slate.flatMap((game) => [game.homeModelTeam, game.awayModelTeam]))]
  const pitcherIds = [...new Set(slate.flatMap((game) => [game.homePitcher?.id, game.awayPitcher?.id]).filter((id): id is number => Boolean(id)))]
  const [teamRows, decisions] = await Promise.all([
    loadTeamGames(targetDate, teams),
    pitcherPriorCounts(targetDate, pitcherIds),
  ])

  const frozenAt = now.toISOString()
  const rows: TrackerRow[] = []
  const blockers: Array<Record<string, unknown>> = []

  for (const game of slate) {
    for (const side of ['home', 'away'] as const) {
      const pitcher = side === 'home' ? game.homePitcher : game.awayPitcher
      if (!pitcher) {
        blockers.push({ gamePk: game.gamePk, side, reason: 'PROBABLE_STARTER_MISSING' })
        continue
      }

      const built = featureVector({
        game,
        side,
        pitcherId: pitcher.id,
        targetDate,
        teamRows,
        decisions,
      })
      const pWin = (\n        applyNumericCatBoostProbability(model0 as NumericCatBoostModel, built.values) +\n        applyNumericCatBoostProbability(model1 as NumericCatBoostModel, built.values)\n      ) / 2
      if (!Number.isFinite(pWin) || pWin < 0 || pWin > 1) {
        blockers.push({ gamePk: game.gamePk, side, pitcherId: pitcher.id, reason: 'MODEL_PROBABILITY_INVALID' })
        continue
      }
      const selectedNo = pWin <= THRESHOLD
      const snapshot = {
        featureNames: FEATURE_NAMES,
        featureValues: built.named,
        featureVector: built.values.map((value) => Number.isFinite(value) ? value : null),
        featureCutoffDateExclusive: targetDate,
        historySource: 'mlb_pitcher_win_forward_team_game_v1',
        decisionHistory: 'mlb_pitcher_win_forward_starter_history_v1 + MLB Official decisions postgame',
        sameDayHistoryAllowed: false,
        quarantine20260919UsedForTuning: false,
        prospectiveContextMayUseStrictlyPriorGames: true,
      }

      rows.push({
        tracking_date: targetDate,
        game_pk: game.gamePk,
        start_time: game.startTime,
        home_team: game.homeTeam,
        away_team: game.awayTeam,
        starter_mlbam_id: pitcher.id,
        pitcher_name: pitcher.name,
        starter_side: side,
        team: built.own,
        opponent: built.opp,
        model_version: MODEL_VERSION,
        model_contract: MODEL_CONTRACT,
        feature_contract: FEATURE_CONTRACT,
        threshold: THRESHOLD,
        p_win: pWin,
        selected_no: selectedNo,
        feature_snapshot: { ...snapshot, digest: sha256(snapshot) },
        model_files: MODEL_FILES,
        frozen_at: frozenAt,
        outcome_status: 'OPEN',
        research_only: true,
        production_eligible: false,
        official_picks_eligible: false,
        apostar_enabled: false,
      })
    }
  }

  if (!rows.length) {
    return { ...base, success: false, status: 'BLOCK_NO_STARTER_OBSERVATIONS', games: slate.length, blockers }
  }

  const { error: insertError } = await supabaseAdmin.from('mlb_pitcher_win_forward_tracker_v1').insert(rows)
  if (insertError) throw new Error(`PITCHER_WIN_FORWARD_TRACKER_WRITE:${insertError.message}`)

  const completedAt = new Date().toISOString()
  const selected = rows.filter((row) => row.selected_no)
  const status = blockers.length ? 'partial' : 'completed'
  const { data: job, error: jobError } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: FREEZE_JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: frozenAt,
    completed_at: completedAt,
    status,
    records_fetched: rows.length,
    records_inserted: rows.length,
    records_updated: 0,
    records_skipped: blockers.length,
    error_count: blockers.length,
    metadata: {
      candidateId: MODEL_VERSION,
      modelContract: MODEL_CONTRACT,
      featureContract: FEATURE_CONTRACT,
      targetDate,
      frozenAt,
      threshold: THRESHOLD,
      direction: 'NO',
      observations: rows.length,
      selected: selected.length,
      blockers,
      modelFiles: MODEL_FILES,
      outcomesRead: false,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      oddsApiCalls: 0,
      forwardLabel: 'PROSPECTIVE_FORWARD_POST_2026_09_20',
    },
    updated_at: completedAt,
  }).select('id').single()
  if (jobError) throw new Error(`PITCHER_WIN_FORWARD_JOB_WRITE:${jobError.message}`)

  return {
    ...base,
    status: selected.length ? 'FROZEN_SELECTIONS_AVAILABLE' : 'FROZEN_NO_SELECTION',
    freezeJobId: job?.id ?? null,
    games: slate.length,
    observations: rows.length,
    selected: selected.length,
    blockers,
    writes: rows.length + 1,
    providerCalls: { MLB_OFFICIAL: 2, sportsbook: 0 },
  }
}

export async function settlePitcherWinForwardNumeric(targetDate: string, now = new Date()) {
  const base = {
    success: true,
    candidateId: MODEL_VERSION,
    targetDate,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    oddsApiCalls: 0,
    writes: 0,
  }
  if (targetDate < FORWARD_MIN_DATE) return { ...base, status: 'NOT_IN_PROSPECTIVE_WINDOW' }

  const { data: openRows, error: readError } = await supabaseAdmin
    .from('mlb_pitcher_win_forward_tracker_v1')
    .select('id,game_pk,starter_mlbam_id,selected_no')
    .eq('tracking_date', targetDate)
    .eq('model_version', MODEL_VERSION)
    .eq('outcome_status', 'OPEN')
    .order('game_pk', { ascending: true })
  if (readError) throw new Error(`PITCHER_WIN_SETTLEMENT_READ:${readError.message}`)
  if (!openRows?.length) return { ...base, status: 'NO_OPEN_OBSERVATIONS' }

  const winners = await decisionWinners(targetDate, targetDate)
  const unresolved = openRows.filter((row) => !winners.has(Number(row.game_pk)))
  if (unresolved.length) {
    return {
      ...base,
      status: 'WAITING_FOR_FINAL_DECISIONS',
      observations: openRows.length,
      unresolvedGamePks: [...new Set(unresolved.map((row) => Number(row.game_pk)))],
    }
  }

  let selected = 0
  let correct = 0
  const gradedAt = now.toISOString()
  for (const row of openRows) {
    const winnerId = winners.get(Number(row.game_pk))!
    const recordedWin = winnerId === Number(row.starter_mlbam_id)
    const isSelected = row.selected_no === true
    const selectionResult = isSelected ? (recordedWin ? 'LOSS' : 'WIN') : 'NOT_SELECTED'
    if (isSelected) {
      selected += 1
      if (!recordedWin) correct += 1
    }
    const { error } = await supabaseAdmin
      .from('mlb_pitcher_win_forward_tracker_v1')
      .update({
        outcome_status: 'SETTLED',
        starter_recorded_win: recordedWin,
        selection_result: selectionResult,
        decision_winner_mlbam_id: winnerId,
        graded_at: gradedAt,
        updated_at: gradedAt,
      })
      .eq('id', row.id)
      .eq('outcome_status', 'OPEN')
    if (error) throw new Error(`PITCHER_WIN_SETTLEMENT_UPDATE:${error.message}`)
  }

  const accuracy = selected ? correct / selected : null
  const { data: job, error: jobError } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: SETTLEMENT_JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: gradedAt,
    completed_at: gradedAt,
    status: 'completed',
    records_fetched: openRows.length,
    records_inserted: 0,
    records_updated: openRows.length,
    records_skipped: 0,
    error_count: 0,
    metadata: {
      candidateId: MODEL_VERSION,
      targetDate,
      observations: openRows.length,
      selected,
      correct,
      accuracy,
      threshold: THRESHOLD,
      direction: 'NO',
      outcomesRead: true,
      outcomeSource: 'MLB_OFFICIAL_SCHEDULE_HYDRATE_DECISIONS',
      retuningAllowed: false,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      oddsApiCalls: 0,
      forwardLabel: 'PROSPECTIVE_FORWARD_POST_2026_09_20',
    },
    updated_at: gradedAt,
  }).select('id').single()
  if (jobError) throw new Error(`PITCHER_WIN_SETTLEMENT_JOB_WRITE:${jobError.message}`)

  return {
    ...base,
    status: 'SETTLED',
    settlementJobId: job?.id ?? null,
    observations: openRows.length,
    selected,
    correct,
    accuracy,
    writes: openRows.length + 1,
    providerCalls: { MLB_OFFICIAL: 1, sportsbook: 0 },
  }
}

export const PITCHER_WIN_FORWARD_NUMERIC_MODEL = {
  modelVersion: MODEL_VERSION,
  modelContract: MODEL_CONTRACT,
  featureContract: FEATURE_CONTRACT,
  threshold: THRESHOLD,
  featureNames: FEATURE_NAMES,
  modelFiles: MODEL_FILES,
} as const
