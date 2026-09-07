# MLB Statcast Matchup V1

## Status

`MLB_STATCAST_MATCHUP_V1_DESCRIPTIVE_READY`

This layer extends the permanent Statcast foundation with read-only matchup evidence. It does not generate a calibrated betting probability and does not activate any betting market.

## Production data surfaces

The following `security_invoker` source views are active in Supabase and restricted to `service_role`:

- `mlb_statcast_pitcher_hand_split_summary`
- `mlb_statcast_batter_hand_split_summary`
- `mlb_statcast_pitcher_vs_team_summary`
- `mlb_statcast_batter_pitch_type_summary`
- `mlb_statcast_team_vs_pitch_type_summary`
- `mlb_statcast_league_pitch_type_summary`
- `mlb_statcast_pitcher_batter_summary`

Request-time reads use corresponding service-role-only materialized relations with `_mv` suffix. The source views remain available for validation and research; `pick2_raw_mlb_statcast_pitches` remains the single raw source of truth.

2026 validation counts:

- pitcher hand splits: 1,692
- batter hand splits: 1,285
- pitcher vs team: 10,652
- batter vs pitch type: 11,912
- team vs pitch type: 769
- league pitch-type baselines: 32
- pitcher vs batter: 83,068

## Matchup API

`GET /api/mlb/statcast/matchup`

Parameters:

- `pitcherId=<MLBAM>` required
- `opponentTeam=<team abbreviation>` required
- `season=<year>` optional, defaults to 2026
- `batterIds=<id,id,...>` optional, up to 13 unique MLBAM batter IDs

Example shape:

```text
/api/mlb/statcast/matchup?pitcherId=123456&opponentTeam=LAD&season=2026&batterIds=111,222,333
```

The endpoint reads stored Supabase data only.

## Evidence returned

### Pitcher context

- season volume and primary throwing hand
- Whiff%, Chase%, CSW%
- velocity
- split vs left-handed and right-handed batters
- historical pitcher-vs-team record at the pitch/plate-appearance level

### Pitch-type matchup matrix

For each pitch in the pitcher's arsenal:

- usage rate
- pitcher Whiff%, Chase%, xwOBA allowed and exit velocity allowed
- opponent team Whiff%, Chase%, xwOBA, hard-hit and barrel behavior vs that pitch type and pitcher hand
- optional projected-lineup aggregate for the same pitch type
- league baseline for that pitch type and pitcher hand
- descriptive differences from the league baseline

### Optional lineup detail

For each supplied batter ID:

- player name and batting side when available
- batter performance vs the pitcher's throwing hand
- batter-vs-pitch-type history
- direct pitcher-vs-batter history

## Team abbreviation normalization

Baseball Savant uses two abbreviations that differ from canonical Pick Analyzer display abbreviations:

- `AZ` is normalized to/from `ARI`
- `CWS` is normalized to/from `CHW`

The API accepts either form and returns both canonical opponent context and the underlying Statcast source abbreviation when useful.

## Sample tiers

Pitch-type evidence is labeled:

- `HIGH`: at least 200 pitcher pitches and 300 opponent-team pitches of the type
- `MEDIUM`: at least 75 pitcher pitches and 100 opponent-team pitches
- `LOW`: below those thresholds

The tier describes sample volume only. It is not confidence in a wager.

## Descriptive edge definitions

`descriptivePressure` compares pitcher and opponent Whiff% tendencies with the league baseline for the same pitch type and pitcher hand. A positive value means both sides of the matchup are directionally associated with more whiffs than baseline.

xwOBA suppression compares pitcher-allowed or opponent-produced xwOBA with the same league pitch-type baseline. Positive suppression means lower xwOBA than league average.

These are diagnostic deltas, not probabilities, prices, expected value or recommendations.

## Runtime contract

The production migration ledger contains:

- `20260907035256_mlb_statcast_matchup_views_v1`
- `20260907035833_mlb_statcast_runtime_performance_v1`
- `20260907040410_mlb_statcast_team_runtime_rollups_v1`
- `20260907041118_mlb_statcast_matchup_runtime_rollups_v1`
- `20260907041404_mlb_statcast_matchup_runtime_rollups_v1`

The `04:11:18` migration materializes the seven matchup surfaces. The `04:14:04` follow-up records stable refresh entrypoints and adds `refresh_mlb_statcast_all_analytics()` for post-ingest refresh of general and matchup rollups.

A reproduced PHI-vs-RHP team/pitch-type read that previously required roughly 9.6 seconds is served by an indexed materialized relation in approximately 0.139 ms SQL execution time (`EXPLAIN ANALYZE`, 16 result rows).

No request-time Baseball Savant/provider call is performed.

## Validation

Run:

```bash
npm run mlb:statcast:matchup:validate
```

The validator reads the bounded materialized surfaces and requires all seven to be populated, 30 MLB teams in team-vs-pitch-type data, both RHP and LHP league baselines and a valid multi-game pitcher-vs-team sample.

After each successful raw Statcast ingest, the service role can execute:

```text
refresh_mlb_statcast_all_analytics()
```

to refresh coverage/team runtime rollups and the matchup materialized surfaces.

## Activation boundary

`DESCRIPTIVE_ONLY_NO_BETTING_MARKET`

Before any strikeout, outs, hits allowed, walks, NRFI/YRFI, team-total or game-total market can use this layer for production selection, it must pass a separate historical backtest with frozen pregame inputs, out-of-sample evaluation, calibration and explicit activation certification.
