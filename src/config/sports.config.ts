export type SupportedSport = {
  key: string
  title: string
  enabled: boolean
  supportsScores: boolean
  defaultBackfillDays: number
}

export const MAX_ODDS_API_SCORES_DAYS_FROM = 3

export const SUPPORTED_SPORTS: SupportedSport[] = [
  {
    key: 'baseball_mlb',
    title: 'MLB',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'basketball_nba',
    title: 'NBA',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'americanfootball_nfl',
    title: 'NFL',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'icehockey_nhl',
    title: 'NHL',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'soccer_epl',
    title: 'EPL',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'basketball_ncaab',
    title: 'NCAAB',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
  {
    key: 'americanfootball_ncaaf',
    title: 'NCAAF',
    enabled: true,
    supportsScores: true,
    defaultBackfillDays: 3,
  },
]

export function getEnabledSports() {
  return SUPPORTED_SPORTS.filter(
    (sport) => sport.enabled && sport.supportsScores
  )
}

export function getSupportedSport(key: string) {
  return SUPPORTED_SPORTS.find((sport) => sport.key === key)
}

export function clampScoresDaysFrom(daysFrom: number) {
  if (!Number.isFinite(daysFrom)) return MAX_ODDS_API_SCORES_DAYS_FROM

  return Math.min(
    Math.max(Math.floor(daysFrom), 1),
    MAX_ODDS_API_SCORES_DAYS_FROM
  )
}