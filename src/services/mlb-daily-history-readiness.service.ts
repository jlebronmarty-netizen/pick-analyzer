import 'server-only'

import { supabaseAdmin } from '@/lib/supabase-admin'

const TIME_ZONE = 'America/Puerto_Rico'
const RAW_TABLE = 'pick2_raw_mlb_statcast_pitches'
const SEASON = 2026

function dateInTimeZone(date: Date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

async function officialFinalGamePks(date: string) {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`MLB_SCHEDULE_HTTP_${response.status}`)
  const json = await response.json() as any
  const games = (json?.dates ?? []).flatMap((entry: any) => Array.isArray(entry?.games) ? entry.games : [])
  const blocking: Array<{ gamePk: number | null; state: string }> = []
  const finals: number[] = []
  let terminalNoPlay = 0
  for (const game of games) {
    const state = String(game?.status?.detailedState ?? game?.status?.abstractGameState ?? '')
    const normalized = state.toLowerCase()
    const gamePk = Number(game?.gamePk)
    if (game?.status?.abstractGameState === 'Final' || game?.status?.codedGameState === 'F' || normalized.includes('final')) {
      if (Number.isSafeInteger(gamePk) && gamePk > 0) finals.push(gamePk)
    } else if (normalized.includes('postpon') || normalized.includes('cancel')) {
      terminalNoPlay += 1
    } else {
      blocking.push({ gamePk: Number.isSafeInteger(gamePk) ? gamePk : null, state })
    }
  }
  return { scheduledGames: games.length, finalGamePks: [...new Set(finals)].sort((a, b) => a - b), terminalNoPlay, blocking }
}

async function storedGamePks(date: string) {
  const rows: Array<{ game_pk: number | string }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from(RAW_TABLE)
      .select('game_pk')
      .eq('game_date', date)
      .range(from, from + 999)
    if (error) throw new Error(`STATCAST_HISTORY_READ_FAILED:${error.message}`)
    rows.push(...((data ?? []) as Array<{ game_pk: number | string }>))
    if (!data || data.length < 1000) break
  }
  return {
    rows: rows.length,
    gamePks: [...new Set(rows.map((row) => Number(row.game_pk)).filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b),
  }
}

async function analyticsMaxDate() {
  const { data, error } = await supabaseAdmin
    .from('mlb_statcast_pitcher_game_logs')
    .select('game_date')
    .eq('season', SEASON)
    .order('game_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`STATCAST_ANALYTICS_READ_FAILED:${error.message}`)
  return data?.game_date ? String(data.game_date) : null
}

export async function getMlbDailyHistoryReadiness(input: { date?: string | null } = {}) {
  const today = dateInTimeZone(new Date())
  const targetDate = input.date ?? addDays(today, -1)
  const [official, stored, analyticsMaxGameDate] = await Promise.all([
    officialFinalGamePks(targetDate),
    storedGamePks(targetDate),
    analyticsMaxDate(),
  ])
  const expected = official.finalGamePks
  const actual = stored.gamePks
  const missingGamePks = expected.filter((gamePk) => !actual.includes(gamePk))
  const unexpectedGamePks = actual.filter((gamePk) => !expected.includes(gamePk))
  const exactCoverage = expected.length === actual.length && missingGamePks.length === 0 && unexpectedGamePks.length === 0
  const noPlayDay = official.scheduledGames === 0 || official.terminalNoPlay === official.scheduledGames
  const historyCoverageReady = official.blocking.length === 0 && exactCoverage && (expected.length > 0 || noPlayDay)
  const analyticsReady = noPlayDay || Boolean(analyticsMaxGameDate && analyticsMaxGameDate >= targetDate)
  const ready = historyCoverageReady && analyticsReady

  return {
    status: ready ? 'DAILY_HISTORY_READY' : 'DAILY_HISTORY_NOT_READY',
    ready,
    targetDate,
    checkedAt: new Date().toISOString(),
    official: {
      scheduledGames: official.scheduledGames,
      finalGames: expected.length,
      terminalNoPlay: official.terminalNoPlay,
      blocking: official.blocking,
    },
    stored: {
      rows: stored.rows,
      games: actual.length,
    },
    analytics: {
      maxGameDate: analyticsMaxGameDate,
      ready: analyticsReady,
    },
    missingGamePks,
    unexpectedGamePks,
    exactCoverage,
    historyCoverageReady,
  }
}
