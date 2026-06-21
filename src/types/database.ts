export type Sport = {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type League = {
  id: string
  sport_id: string
  name: string
  slug: string
  country: string | null
  region: string | null
  season_type: string | null
  is_active: boolean
  external_api: string | null
  external_league_id: string | null
  created_at: string
  updated_at: string
}

export type Team = {
  id: string
  sport_id: string
  league_id: string | null
  name: string
  short_name: string | null
  abbreviation: string | null
  slug: string
  city: string | null
  country: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  external_api: string | null
  external_team_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Game = {
  id: string
  sport_id: string
  league_id: string
  home_team_id: string | null
  away_team_id: string | null
  game_date: string
  status: string
  venue: string | null
  city: string | null
  country: string | null
  home_score: number | null
  away_score: number | null
  season: string | null
  week: string | null
  round: string | null
  is_neutral_site: boolean
  weather: Record<string, unknown> | null
  stats_snapshot: Record<string, unknown> | null
  external_api: string | null
  external_game_id: string | null
  created_at: string
  updated_at: string
}

export type Odd = {
  id: string
  game_id: string
  sportsbook: string
  market: string
  home_moneyline: number | null
  away_moneyline: number | null
  draw_moneyline: number | null
  spread_home: number | null
  spread_home_odds: number | null
  spread_away: number | null
  spread_away_odds: number | null
  total_points: number | null
  over_odds: number | null
  under_odds: number | null
  raw_data: Record<string, unknown> | null
  fetched_at: string
  created_at: string
  updated_at: string
}

export type Prediction = {
  id: string
  game_id: string
  recommended_pick: string
  market: string
  confidence_score: number
  win_probability: number | null
  implied_probability: number | null
  expected_value: number | null
  analysis: string | null
  risks: string | null
  value_detected: boolean
  model_name: string | null
  model_version: string | null
  input_snapshot: Record<string, unknown> | null
  output_snapshot: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TeamStats = {
  id: string
  team_name: string
  sport_key: string
  season: string
  wins: number
  losses: number
  ties: number
  home_wins: number
  home_losses: number
  away_wins: number
  away_losses: number
  last_5_wins: number
  last_5_losses: number
  last_10_wins: number
  last_10_losses: number
  streak: string | null
  win_percentage: number | null
  raw_data: Record<string, unknown> | null
  created_at: string
  updated_at: string
}