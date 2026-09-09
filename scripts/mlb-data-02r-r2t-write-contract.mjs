import { sha256 } from './mlb-data-02r-r2f-stage-contracts.mjs'

export const identityColumns = Object.freeze({
  pick2_mlb_games: 'game_pk', pick2_mlb_players: 'mlbam_person_id', pick2_raw_mlb_statcast_pitches: 'id',
  pick2_feature_snapshots: 'deterministic_identity', pick2_mlb_team_daily_features: 'feature_snapshot_id',
  pick2_mlb_pitcher_daily_features: 'feature_snapshot_id', pick2_mlb_bullpen_daily_features: 'feature_snapshot_id',
  pick2_mlb_batter_daily_features: 'feature_snapshot_id', pick2_mlb_matchup_daily_features: 'feature_snapshot_id',
  pick2_mlb_first_inning_daily_features: 'feature_snapshot_id', pick2_game_predictions: 'deterministic_identity',
  pick2_mlb_market_event_mappings: 'provider_event_id', pick2_mlb_market_price_observations: 'observation_identity',
  pick2_mlb_market_value_evaluations: 'value_identity', pick2_mlb_official_picks: 'official_pick_identity',
})

export function matches(stored, planned, allowUpdatedAtAdvance = false) {
  return Object.entries(planned).every(([key, expected]) => {
    const actual = stored[key]
    if (key === 'updated_at' && allowUpdatedAtAdvance) return Date.parse(actual) >= Date.parse(expected)
    if (expected === null) return actual === null
    if (typeof expected === 'number') return Number(actual) === expected
    if (typeof expected === 'string' && (/(?:_at|_time|_timestamp|_as_of)$/.test(key) || key === 'provider_last_update') && Number.isFinite(Date.parse(expected))) return Date.parse(actual) === Date.parse(expected)
    return sha256(actual) === sha256(expected)
  })
}
