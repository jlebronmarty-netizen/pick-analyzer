# PA14 V4 — Real Pregame Target Probe

Date: 2026-09-14

This is a read-only evidence probe against `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`. It does not certify a Consumer row and does not weaken the frozen contract.

## Target selected

The stored September 14 MLB Official schedule observation includes:

- `canonicalGamePk`: `824465`
- target start: `2026-09-14T22:40:00Z`
- away: Los Angeles Dodgers
- home: Cincinnati Reds
- probable away starter MLBAM: `669373`
- probable away starter: Tarik Skubal
- probable home starter MLBAM: `666157`
- probable home starter: Nick Lodolo

Tarik Skubal is also the player identity previously used by the certified N3.3 quote path, but no quote timestamp or market field is used as PA14 feature authority.

## Stored Skubal raw history

From `pick2_raw_mlb_statcast_pitches`, 2026 history strictly before September 14:

- stored appearances/start-like games: `23`
- first stored date: `2026-03-26`
- latest stored date: `2026-09-08`
- raw pitch rows: `2,106`
- frozen vocabulary conflicts in his stored history: `0`
- valid delivered pitches with missing velocity: `0`
- automatic events excluded from delivered-pitch workload: `1`

A raw-only, non-admissible reconstruction produces the following diagnostic values before BF reconciliation / census / temporal authority gates:

- delivered pitches: `2,105`
- `seasonPitches`: `91.52173913`
- latest-five delivered pitches: `494`
- `l5Pitches`: `98.80000000`
- reconstructed completed starter PA: `548`
- reconstructed `seasonBF`: `23.82608696`
- latest-five reconstructed BF: `129`
- reconstructed `l5BF`: `25.80000000`
- terminal strikeouts: `164`
- raw-only `pitcherKRateV2`: `0.29927007`
- raw-only `avgReleaseSpeedV2`: approximately `92.58902613` mph
- validated S delivered pitches: `1,080`
- raw-only `strikeRateV2`: `0.51306413`
- raw calendar `daysRest`: `6`

These values are diagnostics only. They MUST NOT be serialized as an eligible V2 row because required evidence gates remain unresolved.

## Blocking gates

### 1. Authoritative BF reconciliation

No persisted authoritative box-score BF was identified for the 23 qualifying source starts. Reconstructed terminal PA cannot substitute for the frozen box-score reconciliation rule.

`BF_RECONCILIATION = BLOCKED_AUTHORITATIVE_BF_NOT_PERSISTED`

### 2. Opponent complete census

The target opponent is Cincinnati. The canonical September 13 slate contains game `823734`, Cincinnati at Milwaukee, but the production Statcast raw horizon currently ends on `2026-09-12`.

Therefore the September 14 Cincinnati season batting census cannot be complete from stored raw pitches.

`OPPONENT_CENSUS = BLOCKED_MISSING_2026_09_13_RAW_GAME`

### 3. Historical completion authority

The frozen contract requires a certified completion upper bound for every qualifying source game. No persisted `endTime` / certified completion-bound evidence was located in `pick2_mlb_games.metadata`, `pick2_mlb_runtime_state.checkpoint`, or MLB `sport_events.metadata` during this probe.

`SOURCE_GAME_COMPLETION_AUTHORITY = BLOCKED_NOT_PERSISTED`

### 4. Target starter source-state time

The September 14 schedule observation proves that Tarik Skubal was observed as probable starter before the target start, but only collector/acquisition time is retained in the inspected temporary schedule record. The frozen contract explicitly prohibits acquisition time alone from satisfying source-state authority.

`TARGET_STARTER_TEMPORAL_AUTHORITY = BLOCKED_SOURCE_STATE_TIMESTAMP`

### 5. Canonical current-game horizon

`pick2_mlb_games` currently ends on September 13 and contains no September 14 row, including no row for `824465`.

`CURRENT_CANONICAL_GAME_HORIZON = BLOCKED_NOT_MATERIALIZED`

## Result

`REAL_PREGAME_ROW_824465_669373 = BLOCKED`

The stored raw pitcher history is encouraging: it satisfies the five-start minimum and shows no V2 pitch-vocabulary or delivered-velocity defect. The blocker is evidence completeness/provenance, not a reason to alter the frozen feature definitions.

No provider calls, production DML, production DDL, model training, endpoint creation or deployment were performed by this probe.
