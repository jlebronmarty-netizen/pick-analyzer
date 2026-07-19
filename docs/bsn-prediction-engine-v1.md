# BSN Prediction Engine V1

Status: Shadow mode only.

BSN Prediction Engine V1 generates probability-only previews for stored upcoming BSN games. It uses existing BSN Intelligence team profiles and Feature Store contracts, then returns home win probability, away win probability, confidence, data quality, prediction quality and reasoning.

## Inputs

- Stored `sport_events` rows for `basketball_bsn`.
- Stored legacy `bsn_games` rows when present.
- BSN Intelligence Engine V1 team profiles.
- Feature Store Core V1 definitions for `basketball_bsn`.
- Shared Sport Prediction SDK market compatibility metadata.
- Basketball Platform and Historical Builder contracts.

## Features

- Team strength.
- League position.
- Momentum.
- Power rank.
- Recent form.
- Consistency.
- Home/away split context.
- Games played.
- Head-to-head context when stored completed games exist.
- Data sufficiency.
- Feature quality.

Missing inputs remain unavailable. The engine does not fabricate odds, lineups, player availability, boxscore depth, injuries, diagnosis, expected return or day-to-day status.

## Guardrails

- Official picks are disabled.
- Current Board activation is disabled.
- EV and value calculations are disabled.
- Bet Slip, AI Leans, Watchlist and Avoid promotion are disabled.
- Champion rows are not mutated.
- Official-pick thresholds are unchanged.
- V7 is not promoted.
- Provider calls and remote mutations remain zero.

## Routes

- `/api/bsn/predictions`
- `/api/bsn/predictions/preview`
- `/api/bsn/predictions/validation`
- `/api/bsn/game/[id]`

## Current Limitation

If stored BSN schedule tables contain no upcoming games, the engine returns an explicit ready empty state rather than manufacturing predictions.
