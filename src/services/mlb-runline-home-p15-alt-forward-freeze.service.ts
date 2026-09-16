import 'server-only'

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { puertoRicoUtcRange } from '@/services/active-event.service'
import {
  normalizeMlbModelTeam,
  normalizedComponentScore,
  type FeatureValue,
  type NormalizationStat,
} from '@/lib/mlb-moneyline-high-confidence-v2'
import { RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID } from '@/services/mlb-runline-home-p15-alt-shadow.service'

const TIME_ZONE = 'America/Puerto_Rico'
const SEASON = 2026
const FREEZE_HOUR = 10
const FREEZE_MINUTE = 45
const PAGE_SIZE = 1000
const SCORE_THRESHOLD = 2.065112
const JOB_TYPE = 'runline_v2_home_p15_alt_forward_freeze_v1'
const PROVIDER = 'internal-model'
const ALT_MARKET = 'run_line_alt'

const MLB_TEAM_BY_ID: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL',
  139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CHW', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

const TEAM_STRENGTH_FEATURES = [
  ['home_win_pct', 1], ['home_run_diff_pg', 1], ['home_pyth_win_pct', 1],
  ['away_win_pct', -1], ['away_run_diff_pg', -1], ['away_pyth_win_pct', -1],
] as const

const STARTER_FEATURES = [
  ['home_sp_ra9', -1], ['home_sp_whip', -1], ['home_sp_k_pct', 1], ['home_sp_bb_pct', -1],
  ['home_sp_whiff_rate', 1], ['home_sp_hard_hit_pct', -1], ['home_sp_l5_ra9', -1], ['home_sp_l5_whip', -1],
  ['away_sp_ra9', 1], ['away_sp_whip', 1], ['away_sp_k_pct', -1], ['away_sp_bb_pct', 1],
  ['away_sp_whiff_rate', -1], ['away_sp_hard_hit_pct', 1], ['away_sp_l5_ra9', 1], ['away_sp_l5_whip', 1],
] as const

const HISTORY_FEATURES = [
  ['home_common_win_pct', 1], ['away_common_win_pct', -1], ['home_h2h_win_pct_prior', 1],
  ['home_sp_vs_opp_k_pct', 1], ['home_sp_vs_opp_bb_pct', -1],
  ['away_sp_vs_opp_k_pct', -1], ['away_sp_vs_opp_bb_pct', 1],
] as const

const FEATURE_NAMES = [...TEAM_STRENGTH_FEATURES, ...STARTER_FEATURES, ...HISTORY_FEATURES].map(([name]) => name)
const COMPONENT_NAMES = ['team_strength', 'starter', 'history']

type SlateGame = {
  gamePk: number
  startTime: string
  homeTeam: string
  awayTeam: string
  homeModelTeam: string
  awayModelTeam: string
  homeProbablePitcherId: number | null
  awayProbablePitcherId: number | null
  homeProbablePitcherName: string | null
  awayProbablePitcherName: string | null
}

type TeamGame = {
  game_pk: number
  game_date: string
  team: string
  opponent: string
  runs_for: number | null
  runs_against: number | null
  win: number | null
}

type PitcherGame = {
  game_pk: number
  game_date: string
  pitcher: number
  team: string
  opponent: string
  outs: number | null
  batters_faced: number | null
  hits: number | null
  walks: number | null
  strikeouts: number | null
  runs: number | null
  swings: number | null
  whiffs: number | null
  batted_balls: number | null
  hard_hits: number | null
}

type EventRow = {
  id: string
  start_time: string
  home_team: string | null
  away_team: string | null
}

type AltQuote = {
  id: string
  event_id: string
  sportsbook: string
  outcome: string
  price: number | string | null
  line: number | string | null
  snapshot_time: string
  metadata: Record<string, unknown> | null
}

function dateInTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function minuteOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return Number(values.hour) * 60 + Number(values.minute)
}

function n(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function ratio(a: number, b: number) {
  return Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null
}

function sameStart(a: string, b: string) {
  const av = Date.parse(a)
  const bv = Date.parse(b)
  return Number.isFinite(av) && Number.isFinite(bv) && Math.abs(av - bv) <= 5 * 60_000
}

function finite(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function officialSlate(targetDate: string): Promise<SlateGame[]> {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=probablePitcher`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`MLB_RUNLINE_V2_SCHEDULE_HTTP_${response.status}`)
  const json = await response.json() as any
  const games = (json?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])
  const slate: SlateGame[] = []
  for (const game of games) {
    const gamePk = Number(game?.gamePk)
    const gameType = String(game?.gameType ?? '')
    const detailed = String(game?.status?.detailedState ?? '').toLowerCase()
    if (!Number.isSafeInteger(gamePk) || gamePk <= 0 || (gameType && gameType !== 'R')) continue
    if (detailed.includes('postpon') || detailed.includes('cancel')) continue
    const homeId = Number(game?.teams?.home?.team?.id)
    const awayId = Number(game?.teams?.away?.team?.id)
    const homeTeam = MLB_TEAM_BY_ID[homeId]
    const awayTeam = MLB_TEAM_BY_ID[awayId]
    const startTime = String(game?.gameDate ?? '')
    if (!homeTeam || !awayTeam || !Number.isFinite(Date.parse(startTime))) throw new Error(`MLB_RUNLINE_V2_SCHEDULE_IDENTITY_UNRESOLVED:${gamePk}`)
    const hp = game?.teams?.home?.probablePitcher
    const ap = game?.teams?.away?.probablePitcher
    slate.push({
      gamePk,
      startTime,
      homeTeam,
      awayTeam,
      homeModelTeam: normalizeMlbModelTeam(homeTeam),
      awayModelTeam: normalizeMlbModelTeam(awayTeam),
      homeProbablePitcherId: Number.isSafeInteger(Number(hp?.id)) ? Number(hp.id) : null,
      awayProbablePitcherId: Number.isSafeInteger(Number(ap?.id)) ? Number(ap.id) : null,
      homeProbablePitcherName: typeof hp?.fullName === 'string' ? hp.fullName : null,
      awayProbablePitcherName: typeof ap?.fullName === 'string' ? ap.fullName : null,
    })
  }
  return slate.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.gamePk - b.gamePk)
}

async function readPaged<T>(table: string, columns: string, configure: (query: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = configure(supabaseAdmin.from(table).select(columns)).range(from, from + PAGE_SIZE - 1)
    const { data, error } = await query
    if (error) throw new Error(`MLB_RUNLINE_V2_READ_FAILED:${table}:${error.message}`)
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function loadNormalization() {
  const [{ data: featureRows, error: featureError }, { data: componentRows, error: componentError }] = await Promise.all([
    supabaseAdmin.from('mlb_ml_xyear_feature_stats_v1').select('feature_name,mean_value,sd_value').eq('branch', 'PREGAME').in('feature_name', FEATURE_NAMES),
    supabaseAdmin.from('mlb_ml_xyear_component_stats_v1').select('component,mean_score,sd_score').eq('branch', 'PREGAME').in('component', COMPONENT_NAMES),
  ])
  if (featureError) throw new Error(`MLB_RUNLINE_V2_FEATURE_STATS_READ_FAILED:${featureError.message}`)
  if (componentError) throw new Error(`MLB_RUNLINE_V2_COMPONENT_STATS_READ_FAILED:${componentError.message}`)
  const features = new Map<string, NormalizationStat>()
  for (const row of featureRows ?? []) {
    const mean = n(row.mean_value)
    const sd = n(row.sd_value)
    if (mean !== null && sd !== null && sd !== 0) features.set(String(row.feature_name), { mean, sd })
  }
  const components = new Map<string, NormalizationStat>()
  for (const row of componentRows ?? []) {
    const mean = n(row.mean_score)
    const sd = n(row.sd_score)
    if (mean !== null && sd !== null && sd !== 0) components.set(String(row.component), { mean, sd })
  }
  return { features, components }
}

async function loadTeamGames(targetDate: string, teams: string[]) {
  return readPaged<TeamGame>(
    'mlb_ml_xyear_team_game_v1',
    'game_pk,game_date,team,opponent,runs_for,runs_against,win',
    (query) => query.eq('season', SEASON).lt('game_date', targetDate).in('team', teams).order('game_date', { ascending: false }).order('game_pk', { ascending: false }),
  )
}

async function loadPitcherGames(targetDate: string, pitcherIds: number[]) {
  if (!pitcherIds.length) return [] as PitcherGame[]
  return readPaged<PitcherGame>(
    'mlb_ml_xyear_pitcher_game_v1',
    'game_pk,game_date,pitcher,team,opponent,outs,batters_faced,hits,walks,strikeouts,runs,swings,whiffs,batted_balls,hard_hits',
    (query) => query.eq('season', SEASON).lt('game_date', targetDate).eq('starter', true).in('pitcher', pitcherIds).order('game_date', { ascending: false }).order('game_pk', { ascending: false }),
  )
}

function teamSummary(team: string, rows: TeamGame[]) {
  const games = rows.filter((row) => normalizeMlbModelTeam(String(row.team)) === team)
  if (!games.length) return { winPct: null, runDiffPg: null, pythWinPct: null }
  const wins = games.reduce((sum, row) => sum + (n(row.win) ?? 0), 0)
  const runsFor = games.reduce((sum, row) => sum + (n(row.runs_for) ?? 0), 0)
  const runsAgainst = games.reduce((sum, row) => sum + (n(row.runs_against) ?? 0), 0)
  const pythNumerator = runsFor > 0 ? runsFor ** 1.83 : 0
  const pythDenominator = pythNumerator + (runsAgainst > 0 ? runsAgainst ** 1.83 : 0)
  return {
    winPct: wins / games.length,
    runDiffPg: (runsFor - runsAgainst) / games.length,
    pythWinPct: pythDenominator > 0 ? pythNumerator / pythDenominator : null,
  }
}

function teamStrengthValues(game: SlateGame, rows: TeamGame[]): FeatureValue[] {
  const home = teamSummary(game.homeModelTeam, rows)
  const away = teamSummary(game.awayModelTeam, rows)
  const raw: Record<string, number | null> = {
    home_win_pct: home.winPct,
    home_run_diff_pg: home.runDiffPg,
    home_pyth_win_pct: home.pythWinPct,
    away_win_pct: away.winPct,
    away_run_diff_pg: away.runDiffPg,
    away_pyth_win_pct: away.pythWinPct,
  }
  return TEAM_STRENGTH_FEATURES.map(([featureName, direction]) => ({ featureName, direction, value: raw[featureName] ?? null }))
}

function pitcherSummary(pitcherId: number | null, rows: PitcherGame[]) {
  if (!pitcherId) return null
  const starts = rows.filter((row) => Number(row.pitcher) === pitcherId)
  if (!starts.length) return null
  const aggregate = (selected: PitcherGame[]) => {
    const outs = selected.reduce((sum, row) => sum + (n(row.outs) ?? 0), 0)
    const innings = outs / 3
    const hits = selected.reduce((sum, row) => sum + (n(row.hits) ?? 0), 0)
    const walks = selected.reduce((sum, row) => sum + (n(row.walks) ?? 0), 0)
    const strikeouts = selected.reduce((sum, row) => sum + (n(row.strikeouts) ?? 0), 0)
    const runs = selected.reduce((sum, row) => sum + (n(row.runs) ?? 0), 0)
    const bf = selected.reduce((sum, row) => sum + (n(row.batters_faced) ?? 0), 0)
    const swings = selected.reduce((sum, row) => sum + (n(row.swings) ?? 0), 0)
    const whiffs = selected.reduce((sum, row) => sum + (n(row.whiffs) ?? 0), 0)
    const battedBalls = selected.reduce((sum, row) => sum + (n(row.batted_balls) ?? 0), 0)
    const hardHits = selected.reduce((sum, row) => sum + (n(row.hard_hits) ?? 0), 0)
    return {
      ra9: innings > 0 ? 9 * runs / innings : null,
      whip: innings > 0 ? (hits + walks) / innings : null,
      kPct: ratio(strikeouts, bf),
      bbPct: ratio(walks, bf),
      whiffRate: ratio(whiffs, swings),
      hardHitPct: ratio(hardHits, battedBalls),
    }
  }
  return { season: aggregate(starts), l5: aggregate(starts.slice(0, 5)) }
}

function starterValues(game: SlateGame, rows: PitcherGame[]): FeatureValue[] {
  const home = pitcherSummary(game.homeProbablePitcherId, rows)
  const away = pitcherSummary(game.awayProbablePitcherId, rows)
  const raw: Record<string, number | null> = {
    home_sp_ra9: home?.season.ra9 ?? null,
    home_sp_whip: home?.season.whip ?? null,
    home_sp_k_pct: home?.season.kPct ?? null,
    home_sp_bb_pct: home?.season.bbPct ?? null,
    home_sp_whiff_rate: home?.season.whiffRate ?? null,
    home_sp_hard_hit_pct: home?.season.hardHitPct ?? null,
    home_sp_l5_ra9: home?.l5.ra9 ?? null,
    home_sp_l5_whip: home?.l5.whip ?? null,
    away_sp_ra9: away?.season.ra9 ?? null,
    away_sp_whip: away?.season.whip ?? null,
    away_sp_k_pct: away?.season.kPct ?? null,
    away_sp_bb_pct: away?.season.bbPct ?? null,
    away_sp_whiff_rate: away?.season.whiffRate ?? null,
    away_sp_hard_hit_pct: away?.season.hardHitPct ?? null,
    away_sp_l5_ra9: away?.l5.ra9 ?? null,
    away_sp_l5_whip: away?.l5.whip ?? null,
  }
  return STARTER_FEATURES.map(([featureName, direction]) => ({ featureName, direction, value: raw[featureName] ?? null }))
}

function pitcherVsOpponent(pitcherId: number | null, opponent: string, rows: PitcherGame[]) {
  if (!pitcherId) return { kPct: null, bbPct: null }
  const games = rows.filter((row) => Number(row.pitcher) === pitcherId && normalizeMlbModelTeam(String(row.opponent)) === opponent)
  const strikeouts = games.reduce((sum, row) => sum + (n(row.strikeouts) ?? 0), 0)
  const walks = games.reduce((sum, row) => sum + (n(row.walks) ?? 0), 0)
  const bf = games.reduce((sum, row) => sum + (n(row.batters_faced) ?? 0), 0)
  return { kPct: ratio(strikeouts, bf), bbPct: ratio(walks, bf) }
}

function historyValues(game: SlateGame, teamRows: TeamGame[], pitcherRows: PitcherGame[]): FeatureValue[] {
  const homeGames = teamRows.filter((row) => normalizeMlbModelTeam(String(row.team)) === game.homeModelTeam)
  const awayGames = teamRows.filter((row) => normalizeMlbModelTeam(String(row.team)) === game.awayModelTeam)
  const homeOpponents = new Set(homeGames.map((row) => normalizeMlbModelTeam(String(row.opponent))))
  const awayOpponents = new Set(awayGames.map((row) => normalizeMlbModelTeam(String(row.opponent))))
  const common = new Set([...homeOpponents].filter((team) => awayOpponents.has(team)))
  const homeCommonWin = average(homeGames.filter((row) => common.has(normalizeMlbModelTeam(String(row.opponent)))).map((row) => n(row.win)))
  const awayCommonWin = average(awayGames.filter((row) => common.has(normalizeMlbModelTeam(String(row.opponent)))).map((row) => n(row.win)))
  const h2hWin = average(homeGames.filter((row) => normalizeMlbModelTeam(String(row.opponent)) === game.awayModelTeam).map((row) => n(row.win)))
  const homeSp = pitcherVsOpponent(game.homeProbablePitcherId, game.awayModelTeam, pitcherRows)
  const awaySp = pitcherVsOpponent(game.awayProbablePitcherId, game.homeModelTeam, pitcherRows)
  const raw: Record<string, number | null> = {
    home_common_win_pct: homeCommonWin,
    away_common_win_pct: awayCommonWin,
    home_h2h_win_pct_prior: h2hWin,
    home_sp_vs_opp_k_pct: homeSp.kPct,
    home_sp_vs_opp_bb_pct: homeSp.bbPct,
    away_sp_vs_opp_k_pct: awaySp.kPct,
    away_sp_vs_opp_bb_pct: awaySp.bbPct,
  }
  return HISTORY_FEATURES.map(([featureName, direction]) => ({ featureName, direction, value: raw[featureName] ?? null }))
}

async function loadSportEvents(targetDate: string) {
  const range = puertoRicoUtcRange(targetDate)
  const { data, error } = await supabaseAdmin
    .from('sport_events')
    .select('id,start_time,home_team,away_team')
    .eq('sport_key', 'baseball_mlb')
    .eq('league_key', 'mlb')
    .gte('start_time', range.utcStart)
    .lt('start_time', range.utcEndExclusive)
    .order('start_time', { ascending: true })
    .limit(50)
  if (error) throw new Error(`MLB_RUNLINE_V2_EVENT_READ_FAILED:${error.message}`)
  return (data ?? []) as EventRow[]
}

function matchEvent(game: SlateGame, events: EventRow[]) {
  return events.find((event) =>
    normalizeMlbModelTeam(String(event.home_team ?? '')) === game.homeModelTeam &&
    normalizeMlbModelTeam(String(event.away_team ?? '')) === game.awayModelTeam &&
    sameStart(event.start_time, game.startTime)
  ) ?? null
}

async function loadAltQuotes(eventIds: string[]) {
  if (!eventIds.length) return [] as AltQuote[]
  const { data, error } = await supabaseAdmin
    .from('sports_odds_snapshots')
    .select('id,event_id,sportsbook,outcome,price,line,snapshot_time,metadata')
    .eq('provider', 'the-odds-api')
    .eq('market', ALT_MARKET)
    .eq('outcome', 'home')
    .eq('line', 1.5)
    .in('event_id', eventIds)
    .order('snapshot_time', { ascending: false })
    .limit(1000)
  if (error) throw new Error(`MLB_RUNLINE_V2_ALT_QUOTE_READ_FAILED:${error.message}`)
  return (data ?? []) as AltQuote[]
}

async function existingFreeze(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('sports_sync_jobs')
    .select('id,status,completed_at,metadata')
    .eq('job_type', JOB_TYPE)
    .eq('sport_key', 'baseball_mlb')
    .eq('provider', PROVIDER)
    .in('status', ['completed', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`MLB_RUNLINE_V2_FREEZE_LEDGER_READ_FAILED:${error.message}`)
  return (data ?? []).find((row) => {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {}
    return metadata.targetDate === targetDate && metadata.candidateId === RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID
  }) ?? null
}

export async function freezeRunlineV2HomeP15Alternate({
  targetDate,
  now = new Date(),
}: {
  targetDate?: string
  now?: Date
} = {}) {
  const today = dateInTimeZone(now)
  const date = targetDate ?? today
  const base = {
    success: true,
    candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
    targetDate: date,
    threshold: SCORE_THRESHOLD,
    researchOnly: true,
    productionEligible: false,
    officialPicksModified: false,
    apostarActivated: false,
    writes: 0,
  }

  if (date < '2026-09-17') return { ...base, status: 'NOT_IN_PROSPECTIVE_WINDOW' }
  if (date !== today) return { ...base, success: false, status: 'BLOCK_NONCURRENT_WRITE_DATE' }
  if (minuteOfDay(now) < FREEZE_HOUR * 60 + FREEZE_MINUTE) return { ...base, status: 'NOT_IN_FREEZE_WINDOW' }

  const prior = await existingFreeze(date)
  if (prior) return { ...base, status: 'REUSE_NO_OP', freezeJobId: prior.id, frozenAt: prior.completed_at }

  const slate = await officialSlate(date)
  if (!slate.length) return { ...base, status: 'NO_SCHEDULED_GAMES' }
  const earliestStart = Math.min(...slate.map((game) => Date.parse(game.startTime)))
  if (!Number.isFinite(earliestStart) || now.getTime() >= earliestStart) {
    return { ...base, success: false, status: 'BLOCK_FREEZE_AFTER_FIRST_PITCH', games: slate.length }
  }

  const [normalization, events] = await Promise.all([loadNormalization(), loadSportEvents(date)])
  const relevantTeams = [...new Set(slate.flatMap((game) => [game.homeModelTeam, game.awayModelTeam]))]
  const pitcherIds = [...new Set(slate.flatMap((game) => [game.homeProbablePitcherId, game.awayProbablePitcherId]).filter((value): value is number => Boolean(value)))]
  const [teamGames, pitcherGames] = await Promise.all([loadTeamGames(date, relevantTeams), loadPitcherGames(date, pitcherIds)])

  const eventByGame = new Map<number, EventRow>()
  for (const game of slate) {
    const event = matchEvent(game, events)
    if (event) eventByGame.set(game.gamePk, event)
  }
  const quotes = await loadAltQuotes([...new Set([...eventByGame.values()].map((event) => event.id))])
  const frozenAt = now.toISOString()
  const observations = slate.map((game) => {
    const event = eventByGame.get(game.gamePk) ?? null
    const eventQuotes = event
      ? quotes
          .filter((quote) => quote.event_id === event.id && Date.parse(quote.snapshot_time) < Date.parse(game.startTime))
          .map((quote) => ({ id: quote.id, sportsbook: quote.sportsbook, price: n(quote.price), line: n(quote.line), snapshotTime: quote.snapshot_time }))
      : []
    const teamStrength = normalizedComponentScore(teamStrengthValues(game, teamGames), normalization.features, normalization.components.get('team_strength') ?? null)
    const starter = normalizedComponentScore(starterValues(game, pitcherGames), normalization.features, normalization.components.get('starter') ?? null)
    const history = normalizedComponentScore(historyValues(game, teamGames, pitcherGames), normalization.features, normalization.components.get('history') ?? null)
    const complete = finite(teamStrength) && finite(starter) && finite(history)
    const score = complete ? (teamStrength + starter + history) / Math.sqrt(3) : null
    const marketEligible = eventQuotes.length > 0
    const selected = marketEligible && complete && score! >= SCORE_THRESHOLD
    return {
      gamePk: game.gamePk,
      eventId: event?.id ?? null,
      startTime: game.startTime,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      probablePitchers: {
        home: game.homeProbablePitcherName,
        away: game.awayProbablePitcherName,
        homeMlbamId: game.homeProbablePitcherId,
        awayMlbamId: game.awayProbablePitcherId,
      },
      featureOrientation: 'HOME',
      featureCutoffDateExclusive: date,
      teamStrength,
      starter,
      history,
      score,
      threshold: SCORE_THRESHOLD,
      componentComplete: complete,
      marketEligible,
      selected,
      alternateHomeP15Quotes: eventQuotes,
    }
  })

  const selected = observations.filter((item) => item.selected)
  const marketEligible = observations.filter((item) => item.marketEligible)
  const componentComplete = observations.filter((item) => item.componentComplete)
  const completedAt = new Date().toISOString()
  const status = observations.some((item) => !item.componentComplete) ? 'partial' : 'completed'
  const { data: inserted, error } = await supabaseAdmin.from('sports_sync_jobs').insert({
    id: randomUUID(),
    job_type: JOB_TYPE,
    sport_key: 'baseball_mlb',
    league_key: 'mlb',
    provider: PROVIDER,
    season: String(SEASON),
    started_at: frozenAt,
    completed_at: completedAt,
    status,
    records_fetched: observations.length,
    records_inserted: selected.length,
    records_updated: 0,
    records_skipped: observations.length - selected.length,
    error_count: observations.length - componentComplete.length,
    metadata: {
      candidateId: RUNLINE_V2_HOME_P15_ALT_CANDIDATE_ID,
      targetDate: date,
      prospectiveEvidenceStart: '2026-09-17',
      frozenAt,
      featureBranch: 'PREGAME',
      featureOrientation: 'HOME',
      featureNormalization: '2025-frozen cross-year components',
      scoreFormula: '(team_strength + starter + history) / sqrt(3)',
      threshold: SCORE_THRESHOLD,
      standardMarketCondition: 'HOME -1.5 established by alternate-capture eligibility',
      targetMarket: 'HOME +1.5 ALT',
      targetLabel: 'home_p15_cover',
      slateGames: observations.length,
      mappedEvents: eventByGame.size,
      marketEligibleGames: marketEligible.length,
      componentCompleteGames: componentComplete.length,
      selectedGames: selected.length,
      observations,
      researchOnly: true,
      productionEligible: false,
      officialPicksModified: false,
      apostarActivated: false,
      outcomesRead: false,
      roiCertified: false,
    },
    updated_at: completedAt,
  }).select('id').single()
  if (error) throw new Error(`MLB_RUNLINE_V2_FREEZE_WRITE_FAILED:${error.message}`)

  return {
    ...base,
    status: selected.length ? 'FROZEN_SELECTIONS_AVAILABLE' : 'FROZEN_NO_SELECTION',
    freezeJobId: inserted?.id ?? null,
    games: observations.length,
    mappedEvents: eventByGame.size,
    marketEligibleGames: marketEligible.length,
    componentCompleteGames: componentComplete.length,
    selectedGames: selected.length,
    writes: 1,
    providerCalls: { MLB_OFFICIAL: 1, sportsbook: 0 },
  }
}
