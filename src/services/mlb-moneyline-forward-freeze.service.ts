import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMlbDailyHistoryReadiness } from '@/services/mlb-daily-history-readiness.service'
import {
  MLB_ML_HIGH_CONF_MODEL,
  evaluateMoneylineHighConfidenceHomeV2,
  normalizeMlbModelTeam,
  normalizedComponentScore,
  type FeatureValue,
  type NormalizationStat,
} from '@/lib/mlb-moneyline-high-confidence-v2'

const TIME_ZONE = 'America/Puerto_Rico'
const FREEZE_HOUR = 10
const FREEZE_MINUTE = 45
const SEASON = 2026
const PAGE_SIZE = 1000

const MLB_TEAM_BY_ID: Record<number, string> = {
  108: 'LAA', 109: 'ARI', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL',
  139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CHW', 146: 'MIA', 147: 'NYY', 158: 'MIL',
}

const STARTER_FEATURES = [
  ['home_sp_ra9', -1], ['home_sp_whip', -1], ['home_sp_k_pct', 1], ['home_sp_bb_pct', -1],
  ['home_sp_whiff_rate', 1], ['home_sp_hard_hit_pct', -1], ['home_sp_l5_ra9', -1], ['home_sp_l5_whip', -1],
  ['away_sp_ra9', 1], ['away_sp_whip', 1], ['away_sp_k_pct', -1], ['away_sp_bb_pct', 1],
  ['away_sp_whiff_rate', -1], ['away_sp_hard_hit_pct', 1], ['away_sp_l5_ra9', 1], ['away_sp_l5_whip', 1],
] as const

const RECENT_FEATURES = [
  ['home_l5_win_pct', 1], ['home_l5_run_diff_pg', 1], ['home_l10_win_pct', 1], ['home_l10_run_diff_pg', 1],
  ['away_l5_win_pct', -1], ['away_l5_run_diff_pg', -1], ['away_l10_win_pct', -1], ['away_l10_run_diff_pg', -1],
] as const

const HISTORY_FEATURES = [
  ['home_common_win_pct', 1], ['away_common_win_pct', -1], ['home_h2h_win_pct_prior', 1],
  ['home_sp_vs_opp_k_pct', 1], ['home_sp_vs_opp_bb_pct', -1],
  ['away_sp_vs_opp_k_pct', -1], ['away_sp_vs_opp_bb_pct', 1],
] as const

const FEATURE_NAMES = [...STARTER_FEATURES, ...RECENT_FEATURES, ...HISTORY_FEATURES].map(([name]) => name)
const COMPONENT_NAMES = ['starter', 'recent_form', 'history', 'lineup_matchup']

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
  starter: boolean
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

type FrozenRow = {
  tracking_date: string
  event_id: string
  game_pk: number
  start_time: string
  home_team: string
  away_team: string
  model_version: string
  snapshot_ts: string
  feature_cutoff_ts: string
  data_status: 'FROZEN'
  starter_score: number | null
  team_prior_2025_score: number | null
  history_score: number | null
  lineup_matchup_score: number | null
  recent_form_score: number | null
  standard_score: null
  pick_status: 'PICK' | 'NO_PICK'
  recommended_team: string | null
  recommended_side: 'HOME' | null
  route_id: string | null
  route_details: Record<string, unknown>
  market_moneyline: null
  market_no_vig_prob: null
  notes: string
  frozen_at: string
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function n(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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
  return Number.isFinite(av) && Number.isFinite(bv) && Math.abs(av - bv) <= 60_000
}

async function officialSlate(targetDate: string): Promise<SlateGame[]> {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${targetDate}&hydrate=probablePitcher`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`MLB_MONEYLINE_SCHEDULE_HTTP_${response.status}`)
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
    if (!homeTeam || !awayTeam || !Number.isFinite(Date.parse(startTime))) throw new Error(`MLB_MONEYLINE_SCHEDULE_IDENTITY_UNRESOLVED:${gamePk}`)
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
    if (error) throw new Error(`MLB_MONEYLINE_READ_FAILED:${table}:${error.message}`)
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
  if (featureError) throw new Error(`MLB_MONEYLINE_FEATURE_STATS_READ_FAILED:${featureError.message}`)
  if (componentError) throw new Error(`MLB_MONEYLINE_COMPONENT_STATS_READ_FAILED:${componentError.message}`)
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

async function loadTeamPriors() {
  const { data, error } = await supabaseAdmin.from('mlb_ml_prior2025_team_v1').select('team,team_prior_score')
  if (error) throw new Error(`MLB_MONEYLINE_TEAM_PRIOR_READ_FAILED:${error.message}`)
  return new Map((data ?? []).map((row) => [String(row.team), n(row.team_prior_score)] as const))
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
    'game_pk,game_date,pitcher,team,opponent,starter,outs,batters_faced,hits,walks,strikeouts,runs,swings,whiffs,batted_balls,hard_hits',
    (query) => query.eq('season', SEASON).lt('game_date', targetDate).in('pitcher', pitcherIds).order('game_date', { ascending: false }).order('game_pk', { ascending: false }),
  )
}

function recentFormValues(game: SlateGame, rows: TeamGame[]): FeatureValue[] {
  const summarize = (team: string) => {
    const games = rows.filter((row) => normalizeMlbModelTeam(String(row.team)) === team)
    const l5 = games.slice(0, 5)
    const l10 = games.slice(0, 10)
    return {
      l5Win: average(l5.map((row) => n(row.win))),
      l5RunDiff: average(l5.map((row) => {
        const rf = n(row.runs_for); const ra = n(row.runs_against)
        return rf === null || ra === null ? null : rf - ra
      })),
      l10Win: average(l10.map((row) => n(row.win))),
      l10RunDiff: average(l10.map((row) => {
        const rf = n(row.runs_for); const ra = n(row.runs_against)
        return rf === null || ra === null ? null : rf - ra
      })),
    }
  }
  const home = summarize(game.homeModelTeam)
  const away = summarize(game.awayModelTeam)
  const raw: Record<string, number | null> = {
    home_l5_win_pct: home.l5Win, home_l5_run_diff_pg: home.l5RunDiff, home_l10_win_pct: home.l10Win, home_l10_run_diff_pg: home.l10RunDiff,
    away_l5_win_pct: away.l5Win, away_l5_run_diff_pg: away.l5RunDiff, away_l10_win_pct: away.l10Win, away_l10_run_diff_pg: away.l10RunDiff,
  }
  return RECENT_FEATURES.map(([featureName, direction]) => ({ featureName, direction, value: raw[featureName] ?? null }))
}

function pitcherSummary(pitcherId: number | null, rows: PitcherGame[]) {
  if (!pitcherId) return null
  const appearances = rows.filter((row) => Number(row.pitcher) === pitcherId)
  if (!appearances.length) return null
  const starts = appearances.filter((row) => row.starter === true)
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
  // Frozen historical contract:
  // - cumulative starter component metrics use ALL strict-prior pitcher appearances;
  // - L5 RA9/WHIP use the last five strict-prior STARTS only.
  const season = aggregate(appearances)
  const l5 = aggregate(starts.slice(0, 5))
  return { starts: starts.length, season, l5 }
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

async function loadExisting(targetDate: string) {
  const { data, error } = await supabaseAdmin
    .from('mlb_ml_forward_tracker_v1')
    .select('game_pk,start_time,home_team,away_team,data_status,pick_status,frozen_at,route_details')
    .eq('tracking_date', targetDate)
    .eq('model_version', MLB_ML_HIGH_CONF_MODEL)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`MLB_MONEYLINE_EXISTING_READ_FAILED:${error.message}`)
  return data ?? []
}

function validExistingFreezeTiming(row: any, targetDate: string, startTime: string) {
  const frozenAt = String(row?.frozen_at ?? '')
  const frozenMs = Date.parse(frozenAt)
  const startMs = Date.parse(startTime)
  if (!Number.isFinite(frozenMs) || !Number.isFinite(startMs)) return false
  return dateInTimeZone(new Date(frozenMs)) === targetDate &&
    minuteOfDay(new Date(frozenMs)) >= FREEZE_HOUR * 60 + FREEZE_MINUTE &&
    frozenMs < startMs
}

function existingMatchesSlate(existing: any[], slate: SlateGame[], targetDate: string) {
  if (existing.length !== slate.length) return false
  return slate.every((game) => existing.some((row) =>
    (Number(row.game_pk) === game.gamePk || !row.game_pk) &&
    String(row.home_team) === game.homeTeam &&
    String(row.away_team) === game.awayTeam &&
    sameStart(String(row.start_time), game.startTime) &&
    row.data_status === 'FROZEN' &&
    validExistingFreezeTiming(row, targetDate, game.startTime) &&
    (row.pick_status === 'PICK' || row.pick_status === 'NO_PICK')
  ))
}

function parityAgainstExisting(rows: FrozenRow[], existing: any[]) {
  let compared = 0
  let exact = 0
  const mismatches: Array<Record<string, unknown>> = []
  for (const row of rows) {
    const old = existing.find((item) => String(item.home_team) === row.home_team && String(item.away_team) === row.away_team && sameStart(String(item.start_time), row.start_time))
    if (!old) {
      mismatches.push({ gamePk: row.game_pk, home: row.home_team, away: row.away_team, reason: 'NO_EXISTING_MATCH' })
      continue
    }
    compared += 1
    const oldReason = typeof old.route_details?.reason === 'string' ? old.route_details.reason : null
    const newReason = typeof row.route_details.reason === 'string' ? row.route_details.reason : null
    if (old.pick_status === row.pick_status && oldReason === newReason) exact += 1
    else mismatches.push({ gamePk: row.game_pk, home: row.home_team, away: row.away_team, oldPick: old.pick_status, newPick: row.pick_status, oldReason, newReason })
  }
  return { compared, exact, exactParity: compared === rows.length && exact === rows.length && mismatches.length === 0, mismatches }
}

async function gradeOpenFrozenPicks(now: Date) {
  const { data: openRows, error } = await supabaseAdmin
    .from('mlb_ml_forward_tracker_v1')
    .select('id,game_pk,recommended_team')
    .eq('model_version', MLB_ML_HIGH_CONF_MODEL)
    .eq('data_status', 'FROZEN')
    .eq('pick_status', 'PICK')
    .eq('result_status', 'OPEN')
    .lt('start_time', now.toISOString())
    .limit(200)
  if (error) throw new Error(`MLB_MONEYLINE_GRADING_READ_FAILED:${error.message}`)
  const candidates = (openRows ?? []).filter((row) => Number.isSafeInteger(Number(row.game_pk)) && row.recommended_team)
  if (!candidates.length) return { candidates: 0, graded: 0 }
  const gamePks = [...new Set(candidates.map((row) => Number(row.game_pk)))]
  const { data: outcomes, error: outcomeError } = await supabaseAdmin
    .from('mlb_ml_xyear_game_v1')
    .select('game_pk,actual_winner')
    .eq('season', SEASON)
    .in('game_pk', gamePks)
  if (outcomeError) throw new Error(`MLB_MONEYLINE_GRADING_OUTCOME_READ_FAILED:${outcomeError.message}`)
  const winners = new Map((outcomes ?? []).map((row) => [Number(row.game_pk), String(row.actual_winner ?? '')]))
  let graded = 0
  for (const row of candidates) {
    const winner = winners.get(Number(row.game_pk))
    if (!winner) continue
    const recommended = normalizeMlbModelTeam(String(row.recommended_team))
    const actual = normalizeMlbModelTeam(winner)
    const { error: updateError } = await supabaseAdmin
      .from('mlb_ml_forward_tracker_v1')
      .update({ actual_winner: winner, result_status: recommended === actual ? 'WIN' : 'LOSS', graded_at: now.toISOString() })
      .eq('id', row.id)
      .eq('result_status', 'OPEN')
    if (updateError) throw new Error(`MLB_MONEYLINE_GRADING_WRITE_FAILED:${updateError.message}`)
    graded += 1
  }
  return { candidates: candidates.length, graded }
}

export type FreezeMoneylineInput = {
  targetDate?: string
  dryRun?: boolean
  forceRecomputeDryRun?: boolean
  now?: Date
  historyReadiness?: { ready: boolean; targetDate: string } | null
}

export async function freezeMlbMoneylineForwardTracker(input: FreezeMoneylineInput = {}) {
  const now = input.now ?? new Date()
  const dryRun = input.dryRun === true
  const today = dateInTimeZone(now)
  const targetDate = input.targetDate ?? today
  if (!/^2026-\d{2}-\d{2}$/.test(targetDate)) throw new Error('MLB_MONEYLINE_INVALID_TARGET_DATE')
  if (!dryRun && targetDate !== today) throw new Error('MLB_MONEYLINE_WRITE_DATE_MUST_BE_CURRENT')
  if (!dryRun && minuteOfDay(now) < FREEZE_HOUR * 60 + FREEZE_MINUTE) {
    return { success: true, status: 'NOT_IN_FREEZE_WINDOW', targetDate, dryRun, writes: 0, officialPickWrites: 0, apostarActive: false }
  }

  const previousDate = addDays(targetDate, -1)
  const readiness = input.historyReadiness?.targetDate === previousDate
    ? input.historyReadiness
    : await getMlbDailyHistoryReadiness({ date: previousDate })
  if (!readiness.ready) {
    return { success: false, status: 'BLOCK_DAILY_HISTORY_NOT_READY', targetDate, previousDate, dryRun, writes: 0, officialPickWrites: 0, apostarActive: false }
  }

  const slate = await officialSlate(targetDate)
  if (!slate.length) {
    return { success: true, status: 'NO_SCHEDULED_GAMES', targetDate, dryRun, games: 0, writes: 0, officialPickWrites: 0, apostarActive: false }
  }
  const earliestStart = Math.min(...slate.map((game) => Date.parse(game.startTime)))
  if (!dryRun && (!Number.isFinite(earliestStart) || now.getTime() >= earliestStart)) {
    return { success: false, status: 'BLOCK_FREEZE_AFTER_FIRST_PITCH', targetDate, dryRun, games: slate.length, writes: 0, officialPickWrites: 0, apostarActive: false }
  }

  const existing = await loadExisting(targetDate)
  if (!dryRun && existing.length) {
    if (existingMatchesSlate(existing, slate, targetDate)) {
      const grading = await gradeOpenFrozenPicks(now)
      return { success: true, status: 'REUSE_NO_OP', targetDate, dryRun, games: slate.length, rows: existing.length, writes: grading.graded, grading, officialPickWrites: 0, apostarActive: false }
    }
    return { success: false, status: 'BLOCK_EXISTING_TRACKER_STATE', targetDate, dryRun, games: slate.length, existingRows: existing.length, writes: 0, officialPickWrites: 0, apostarActive: false }
  }

  const [{ features, components }, priors] = await Promise.all([loadNormalization(), loadTeamPriors()])
  const relevantTeams = [...new Set(slate.flatMap((game) => [game.homeModelTeam, game.awayModelTeam]))]
  const pitcherIds = [...new Set(slate.flatMap((game) => [game.homeProbablePitcherId, game.awayProbablePitcherId]).filter((value): value is number => Boolean(value)))]
  const [teamGames, pitcherGames] = await Promise.all([loadTeamGames(targetDate, relevantTeams), loadPitcherGames(targetDate, pitcherIds)])
  const frozenAt = now.toISOString()
  const rows: FrozenRow[] = []

  for (const game of slate) {
    const homePrior = priors.get(game.homeModelTeam) ?? null
    const awayPrior = priors.get(game.awayModelTeam) ?? null
    const teamPrior2025 = homePrior === null || awayPrior === null ? null : homePrior - awayPrior
    let starterScore: number | null = null
    let recentFormScore: number | null = null
    let historyScore: number | null = null
    const lineupMatchupScore: number | null = null

    if (teamPrior2025 !== null && teamPrior2025 >= 1.2) {
      starterScore = normalizedComponentScore(starterValues(game, pitcherGames), features, components.get('starter') ?? null)
      if (starterScore !== null && starterScore >= 0.25) {
        recentFormScore = normalizedComponentScore(recentFormValues(game, teamGames), features, components.get('recent_form') ?? null)
        historyScore = normalizedComponentScore(historyValues(game, teamGames, pitcherGames), features, components.get('history') ?? null)
      }
    }

    const decision = evaluateMoneylineHighConfidenceHomeV2({
      teamPrior2025,
      starter: starterScore,
      recentForm: recentFormScore,
      history: historyScore,
      lineupMatchup: lineupMatchupScore,
    })
    const featureCutoff = new Date(Date.parse(game.startTime) - 60 * 60_000).toISOString()
    rows.push({
      tracking_date: targetDate,
      event_id: `baseball_mlb:mlb:mlb_official:game:${game.gamePk}`,
      game_pk: game.gamePk,
      start_time: game.startTime,
      home_team: game.homeTeam,
      away_team: game.awayTeam,
      model_version: MLB_ML_HIGH_CONF_MODEL,
      snapshot_ts: frozenAt,
      feature_cutoff_ts: featureCutoff,
      data_status: 'FROZEN',
      starter_score: starterScore,
      team_prior_2025_score: teamPrior2025,
      history_score: historyScore,
      lineup_matchup_score: lineupMatchupScore,
      recent_form_score: recentFormScore,
      standard_score: null,
      pick_status: decision.pickStatus,
      recommended_team: decision.pickStatus === 'PICK' ? game.homeTeam : null,
      recommended_side: decision.recommendedSide,
      route_id: decision.routeId,
      route_details: {
        decision: decision.pickStatus,
        reason: decision.reason,
        failClosed: decision.failClosed,
        missingComponents: decision.missingComponents,
        evidence_cutoff_ok: true,
        source: 'MLB_OFFICIAL_PREGAME_PLUS_PRIOR_DATE_CANONICAL_HISTORY',
        team_prior_2025_score: teamPrior2025,
        starter_score: starterScore,
        recent_form_score: recentFormScore,
        history_score: historyScore,
        lineup_matchup_score: lineupMatchupScore,
        probable_pitchers: {
          home: game.homeProbablePitcherName,
          away: game.awayProbablePitcherName,
          homeMlbamId: game.homeProbablePitcherId,
          awayMlbamId: game.awayProbablePitcherId,
        },
      },
      market_moneyline: null,
      market_no_vig_prob: null,
      notes: 'Frozen daily recommendation gate. No Official Picks write; APOSTAR disabled. Missing decision-relevant components fail closed.',
      frozen_at: frozenAt,
    })
  }

  const failClosedGames = rows.filter((row) => row.route_details.failClosed === true).length
  const picks = rows.filter((row) => row.pick_status === 'PICK').length
  const parity = dryRun && input.forceRecomputeDryRun && existing.length ? parityAgainstExisting(rows, existing) : null

  if (dryRun) {
    return {
      success: true,
      status: failClosedGames ? 'DRY_RUN_FAIL_CLOSED_INPUT_GAPS' : 'DRY_RUN_READY',
      targetDate,
      dryRun: true,
      games: rows.length,
      picks,
      failClosedGames,
      rows,
      parity,
      writes: 0,
      officialPickWrites: 0,
      apostarActive: false,
      providerCalls: { MLB_OFFICIAL: 2, sportsbook: 0 },
    }
  }

  const { error: insertError } = await supabaseAdmin.from('mlb_ml_forward_tracker_v1').insert(rows)
  if (insertError) throw new Error(`MLB_MONEYLINE_FREEZE_WRITE_FAILED:${insertError.message}`)
  const readback = await loadExisting(targetDate)
  if (!existingMatchesSlate(readback, slate, targetDate)) throw new Error('MLB_MONEYLINE_FREEZE_READBACK_MISMATCH')
  const grading = await gradeOpenFrozenPicks(now)
  return {
    success: true,
    status: failClosedGames ? 'FROZEN_FAIL_CLOSED_INPUT_GAPS' : picks ? 'FROZEN_PICK_AVAILABLE' : 'FROZEN_NO_PICK',
    targetDate,
    dryRun: false,
    games: rows.length,
    picks,
    failClosedGames,
    writes: rows.length + grading.graded,
    grading,
    officialPickWrites: 0,
    apostarActive: false,
    providerCalls: { MLB_OFFICIAL: 2, sportsbook: 0 },
  }
}
