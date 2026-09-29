# MLB Approved Prop Settlement V1

Status: **RESEARCH-ONLY**

## Purpose

Settle only rows that were already frozen as:

- `model_qualifies = true`
- `market_verified = true`
- `status = QUALIFIES_MARKET_VERIFIED`

from `public.mlb_approved_prop_daily_v1`.

The settlement layer never creates a candidate and never reruns a model.

## Identity

Every outcome requires:

- exact `gamePk`;
- exact MLBAM player/pitcher id.

No fuzzy player-name matching and no cross-game inference are permitted.

## Outcome sources

### Batters

- Hits / HR / strikeouts / walks:
  `mlb_statcast_batter_game_logs`
- Singles / doubles / triples:
  `mlb_statcast_batter_sdt_game_mv`
- Total bases:
  `mlb_statcast_batter_total_bases_game_mv`
- RBI and H+R+RBI:
  MLB Official exact-game boxscore endpoint.

### Pitchers

- Strikeouts / walks / hits allowed / outs:
  `mlb_ml_xyear_pitcher_game_v1`
- Earned runs:
  MLB Official exact-game boxscore endpoint.
- Record a Win:
  authoritative settlement from
  `mlb_pitcher_win_forward_tracker_v1`.

## Missing outcomes

Missing exact outcome data is **not** graded as a loss or win.

The row remains blocked with an explicit blocker such as:

`EXACT_OUTCOME_NOT_AVAILABLE`

or

`MLB_OFFICIAL_BOXSCORE_UNAVAILABLE`.

## Postseason

The independent Pitcher Record a Win runtime previously had regular-season-only
schedule filters. This phase changes only target and decision-winner schedule
eligibility to `R/F/D/L/W`.

No model parameters, feature definitions, threshold, or historical metrics change.

Postseason evidence continues to be separated from regular-season evidence by the
master forward ledger.

## Master ledger

The settlement table is read by
`mlb-forward-master-ledger.service.ts`.

Execution order of the daily research sync:

1. settle approved-prop frozen rows;
2. settle exact-line pitcher shadows;
3. freeze current exact-line pitcher shadows;
4. synchronize all persisted evidence into the master ledger.

## Security

- RLS enabled;
- anon/authenticated revoked;
- service_role only;
- no delete authority granted.

## Boundaries

- Official Picks unchanged;
- APOSTAR off;
- no production promotion;
- no threshold retuning;
- no historical Odds API spend;
- no retro-freeze.
