export type Pick2MlbGameIdentity = {
  game_pk: number
  season: number | null
  game_date: string | null
  scheduled_at: string | null
  home_team_id: string | null
  away_team_id: string | null
  game_type: string | null
  official_status: string | null
  doubleheader: string | null
  game_number: number | null
  source: 'mlb_official' | 'statcast' | string
  source_payload_digest: string | null
  legacy_sport_event_id: string | null
}

export type Pick2MlbPlayerIdentity = {
  mlbam_person_id: number
  full_name: string | null
  first_name: string | null
  last_name: string | null
  primary_position: string | null
  bat_side: string | null
  throw_side: string | null
  active: boolean | null
  first_seen_date: string | null
  last_seen_date: string | null
  source: 'mlb_official' | 'statcast' | string
  source_payload_digest: string | null
  legacy_sport_player_id: string | null
}

export type Pick2NativeFeatureIdentity = {
  target_game_pk: number
  team_id?: string | null
  mlbam_person_id?: number | null
  mlbam_pitcher_id?: number | null
  mlbam_batter_id?: number | null
  as_of_timestamp?: string | null
  feature_version: string
}

export type Pick2NativePredictionIdentity = {
  sport_key: 'baseball_mlb'
  game_pk: number
  model_version_id: string
  target: string
  predicted_at: string
  frozen_input_digest: string
}

export function assertPositiveMlbamId(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive MLBAM integer identity`)
  }

  return value
}
