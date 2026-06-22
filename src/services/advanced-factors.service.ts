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

async function getPitcherAdvantage(teamName: string, opponentName: string) {
  const { data, error } = await supabaseAdmin
    .from('pitcher_stats')
    .select('team, era, whip, k_per_9, is_probable_starter')

  if (error) {
    console.error('Pitcher factor error:', error.message)
    return 0
  }

  const rows = (data ?? []) as PitcherStatRow[]

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
    rows.find(
      (row) => normalizeTeamName(row.team) === normalizeTeamName(opponentName)
    ) ??
    null

  const teamRating = calculatePitcherRating(teamPitcher)
  const opponentRating = calculatePitcherRating(opponentPitcher)

  return Number(clamp((teamRating - opponentRating) * 0.08, -5, 5).toFixed(2))
}

async function getInjuryImpact(teamName: string) {
  const { data, error } = await supabaseAdmin
    .from('injuries')
    .select('team, status, impact_score')

  if (error) {
    console.error('Injury factor error:', error.message)
    return 0
  }

  const activeInjuries = ((data ?? []) as InjuryRow[]).filter((row) => {
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
  const { data, error } = await supabaseAdmin
    .from('weather_impacts')
    .select('game_id, impact_score')
    .eq('game_id', gameId)
    .maybeSingle()

  if (error) {
    console.error('Weather factor error:', error.message)
    return 0
  }

  const row = data as WeatherImpactRow | null

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