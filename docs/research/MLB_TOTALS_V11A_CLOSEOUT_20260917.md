# MLB Totals V11-A Closeout — 2026-09-17

Repository: `jlebronmarty-netizen/pick-analyzer`

Branch: `research/totals-2025-historical-backfill`

Supabase: `ynuocvexviorgdjrfthw`

Status: `RESEARCH_ONLY / REJECTED_VALIDATION_GATE`

## Guardrails preserved

- Official Picks writes: 0
- APOSTAR activation: false
- production promotion: false
- historical Odds API credits consumed: 0
- 2026 used for V11-A selection: false
- same-game FULL values used as pregame features: false
- final runs/winner used as pregame features: false

## Purpose

Test whether two previously underused pregame information layers improve MLB Game Totals prediction:

1. strict-prior rolling offense splits versus the handedness of the opposing starter;
2. timestamped bullpen quality features already stored in `pick2_mlb_bullpen_daily_features`.

## Pregame coverage

Development surface: 2025-04-01 through 2025-08-31.

- non-push games: 1,895
- games with both new layers usable: 1,875
- rolling handedness coverage with >=50 prior PA on both sides: approximately 99%
- bullpen pregame quality rates available for nearly all development games

Bullpen historical quality fields available:

- `bullpen_k_rate`
- `bullpen_bb_rate`
- `bullpen_k_minus_bb_rate`
- `bullpen_whiff_rate`
- strict-prior source window metadata

Critical limitation discovered:

- `pitches_previous_24h = 0` throughout Apr-Aug 2025
- `pitches_previous_72h = 0` throughout Apr-Aug 2025
- `high_workload_reliever_count = 0` throughout Apr-Aug 2025

Therefore the 2025 table does **not** provide genuine historical bullpen availability/workload intensity even though it does provide strict-prior bullpen quality rates. These zero-valued workload fields were excluded as signal rather than treated as real zero workload.

## Handedness construction

Source: `mlb_ml_xyear_team_hand_game_v1`.

Pregame features were reconstructed using cumulative windows ending strictly before the target game:

- prior PA versus starter hand
- prior K rate versus starter hand
- prior hard-hit rate versus starter hand
- offense-hand x opposing-starter contact pressure
- offense-hand K x opposing-starter K suppression

No same-game hand-split statistics were used as inputs.

## Direct V11-A classifier

Features combined:

- closing total / no-vig market context
- park context
- recent scoring
- lineup/offense quality
- starter quality
- bullpen historical quality
- rolling handedness splits
- strict-prior bullpen K/BB/K-BB/whiff
- matchup interactions

Training: 2025-04-01 through 2025-06-30.

Validation: 2025-07-01 through 2025-08-31.

Frozen gate:

- accuracy >= 75%
- worst validation month >= 70%
- n >= 30
- minimum monthly n >= 10

Best full-coverage ridge validation accuracy: **48.86%**.

Best stable selective tail:

- side: OVER
- n = 44
- correct = 26
- accuracy = **59.09%**
- worst month = **57.89%**
- minimum monthly n = 19

Result: no direct V11-A candidate passed the gate.

## Process-proxy experiment

The new layers did add genuine process signal.

Out-of-sample Jul-Aug correlations of train-only correlation-weighted proxies versus the FULL process targets:

- offense: **0.2630**
- starter vulnerability: **0.2626**
- contact: **0.2124**
- bullpen vulnerability: **0.0908**

Selected train-period primitive examples:

- `total_hand_contact_sp_pressure` vs actual offense: corr about **0.1340**
- rolling hand hard-hit vs actual contact: corr about **0.1215**
- bullpen daily whiff/K-BB had weaker inverse relationship with actual bullpen vulnerability

However, combining predicted processes with the frozen FULL oracle weights `3/1/1/3` produced only **48.59%** validation accuracy.

A train-only reliability-weighted process ensemble produced only **49.13%** full validation accuracy. Its best stable selective tail was again only **59.09%**.

## Final V11-A decision

Registry candidate:

`totals_v11a_hand_bullpen_pregame_v1`

State:

`REJECTED_VALIDATION_GATE`

September 2025 was **not opened** for rescue/tuning because it was already consumed by previous Totals families.

2026 was **not opened** for V11-A because the candidate failed the 2025 Jul-Aug validation gate.

Do not retune V11-A thresholds.

## Research implication

Rolling handedness is useful as a process predictor, but it is insufficient by itself to reach a deployable 75% Totals classifier.

The largest unresolved information deficit is **true pregame bullpen availability/workload**, not generic bullpen quality. The historical 2025 workload fields currently stored are zero-filled and cannot be treated as evidence.

For a genuinely new next architecture, prioritize one or more of:

1. reconstruct true reliever usage/availability from prior-game pitcher appearances;
2. timestamp-proven confirmed/projected lineups;
3. reliable historical weather/roof context;
4. player-level handedness and lineup composition rather than team-level aggregate hand splits.

Do not spend Odds API historical credits for these features; The Odds API is not the missing source for them.