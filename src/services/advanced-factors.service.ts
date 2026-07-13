import { supabaseAdmin } from '@/lib/supabase-admin'

export type AdvancedPredictionFactors = {
  pitcherAdvantage: number
  injuryImpact: number
  weatherImpact: number
}

type PitcherStatRow = {
  team: string | null
  era: number | null
  whip: number | null
  k_per_9: number | null
  is_probable_starter?: boolean | null
}

type InjuryRow = {
  team: string | null
  status: string | null
  impact_score: number | null
}

type WeatherImpactRow = {
  game_id: string | null
  impact_score: number | null
}

const CACHE_TTL = 5 * 60_000

let pitcherCache: { data: PitcherStatRow[]; expiresAt: number } | null = null
let injuryCache: { data: InjuryRow[]; expiresAt: number } | null = null
let weatherCache: { data: WeatherImpactRow[]; expiresAt: number } | null = null

let pitcherPromise: Promise<PitcherStatRow[]> | null = null
let injuryPromise: Promise<InjuryRow[]> | null = null
let weatherPromise: Promise<WeatherImpactRow[]> | null = null

let lastPitcherErrorAt = 0
let lastInjuryErrorAt = 0
let lastWeatherErrorAt = 0

function shouldLog(lastLoggedAt: number) {
  return Date.now() - lastLoggedAt > 60_000
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeTeamName(name: string | null | undefined) {
  return String(name ?? '').trim().toLowerCase()
}

function calculatePitcherRating(pitcher: PitcherStatRow | null) {
  if (!pitcher) return 50

  const era = safeNumber(pitcher.era, 4.25)
  const whip = safeNumber(pitcher.whip, 1.3)
  const kPer9 = safeNumber(pitcher.k_per_9, 8)

  const eraScore = clamp(70 - era * 8, 1, 99)
  const whipScore = clamp(85 - whip * 25, 1, 99)
  const strikeoutScore = clamp(kPer9 * 7, 1, 99)

  return clamp(eraScore * 0.45 + whipScore * 0.35 + strikeoutScore * 0.2, 1, 99)
}

async function loadPitchers() {
  if (pitcherCache && pitcherCache.expiresAt > Date.now()) {
    return pitcherCache.data
  }

  if (pitcherPromise) return pitcherPromise

  pitcherPromise = Promise.resolve(
    supabaseAdmin
      .from('pitcher_stats')
      .select('team, era, whip, k_per_9, is_probable_starter')
  )
    .then(({ data, error }) => {
      if (error) {
        if (shouldLog(lastPitcherErrorAt)) {
          console.error('Pitcher factor error:', error.message)
          lastPitcherErrorAt = Date.now()
        }

        return pitcherCache?.data ?? []
      }

      pitcherCache = {
        data: (data ?? []) as PitcherStatRow[],
        expiresAt: Date.now() + CACHE_TTL,
      }

      return pitcherCache.data
    })
    .finally(() => {
      pitcherPromise = null
    })

  return pitcherPromise
}

async function loadInjuries() {
  if (injuryCache && injuryCache.expiresAt > Date.now()) {
    return injuryCache.data
  }

  if (injuryPromise) return injuryPromise

  injuryPromise = Promise.resolve(
    supabaseAdmin.from('injuries').select('team, status, impact_score')
  )
    .then(({ data, error }) => {
      if (error) {
        if (shouldLog(lastInjuryErrorAt)) {
          console.error('Injury factor error:', error.message)
          lastInjuryErrorAt = Date.now()
        }

        return injuryCache?.data ?? []
      }

      injuryCache = {
        data: (data ?? []) as InjuryRow[],
        expiresAt: Date.now() + CACHE_TTL,
      }

      return injuryCache.data
    })
    .finally(() => {
      injuryPromise = null
    })

  return injuryPromise
}

async function loadWeatherImpacts() {
  if (weatherCache && weatherCache.expiresAt > Date.now()) {
    return weatherCache.data
  }

  if (weatherPromise) return weatherPromise

  weatherPromise = Promise.resolve(
    supabaseAdmin.from('weather_impacts').select('game_id, impact_score')
  )
    .then(({ data, error }) => {
      if (error) {
        if (shouldLog(lastWeatherErrorAt)) {
          console.error('Weather factor error:', error.message)
          lastWeatherErrorAt = Date.now()
        }

        return weatherCache?.data ?? []
      }

      weatherCache = {
        data: (data ?? []) as WeatherImpactRow[],
        expiresAt: Date.now() + CACHE_TTL,
      }

      return weatherCache.data
    })
    .finally(() => {
      weatherPromise = null
    })

  return weatherPromise
}

async function getPitcherAdvantage(teamName: string, opponentName: string) {
  const rows = await loadPitchers()

  const teamPitcher =
    rows.find(
      (row) =>
        normalizeTeamName(row.team) === normalizeTeamName(teamName) &&
        row.is_probable_starter === true
    ) ??
    rows.find((row) => normalizeTeamName(row.team) === normalizeTeamName(teamName)) ??
    null

  const opponentPitcher =
    rows.find(
      (row) =>
        normalizeTeamName(row.team) === normalizeTeamName(opponentName) &&
        row.is_probable_starter === true
    ) ??
    rows.find((row) => normalizeTeamName(row.team) === normalizeTeamName(opponentName)) ??
    null

  const teamRating = calculatePitcherRating(teamPitcher)
  const opponentRating = calculatePitcherRating(opponentPitcher)

  return Number(clamp((teamRating - opponentRating) * 0.08, -5, 5).toFixed(2))
}

async function getInjuryImpact(teamName: string) {
  const rows = await loadInjuries()

  const activeInjuries = rows.filter((row) => {
    const status = String(row.status ?? '').toLowerCase()

    return (
      normalizeTeamName(row.team) === normalizeTeamName(teamName) &&
      !status.includes('available') &&
      !status.includes('healthy') &&
      !status.includes('cleared')
    )
  })

  const totalImpact = activeInjuries.reduce(
    (sum, row) => sum + safeNumber(row.impact_score, 0),
    0
  )

  return Number(clamp(totalImpact, 0, 8).toFixed(2))
}

async function getWeatherImpact(gameId: string) {
  const rows = await loadWeatherImpacts()
  const row = rows.find((item) => String(item.game_id ?? '') === String(gameId)) ?? null

  return Number(clamp(safeNumber(row?.impact_score, 0), -4, 4).toFixed(2))
}

export async function getAdvancedPredictionFactors({
  sportKey,
  gameId,
  teamName,
  opponentName,
}: {
  sportKey: string
  gameId: string
  teamName: string
  opponentName: string
}): Promise<AdvancedPredictionFactors> {
  const isMlb = sportKey === 'baseball_mlb'

  const [pitcherAdvantage, injuryImpact, weatherImpact] = await Promise.all([
    isMlb ? getPitcherAdvantage(teamName, opponentName) : Promise.resolve(0),
    getInjuryImpact(teamName),
    getWeatherImpact(gameId),
  ])

  return {
    pitcherAdvantage,
    injuryImpact,
    weatherImpact,
  }
}