# MLB Game Totals Research Status — 2026-09-17

Repository: `jlebronmarty-netizen/pick-analyzer`

Canonical Supabase: `ynuocvexviorgdjrfthw`

Branch: `research/totals-2025-historical-backfill`

Status: `RESEARCH_ONLY / SHADOW_ONLY`

## Non-negotiable guardrails

- Do not modify Official Picks.
- Do not activate APOSTAR.
- Do not promote Totals to production without an explicit user gate.
- Never use FULL/same-game values as pregame features.
- Never use final runs/final score/winner as model inputs.
- Do not retune Moneyline or frozen Run Line V2.
- Do not spend historical Odds API credits for Totals without an explicit authorization gate.

## Dual-branch Totals architecture

Two branches are intentionally preserved for every market:

1. `PREGAME`: deployable-in-principle predictors using only information available before the game.
2. `FULL_DIAGNOSTIC`: same-game process oracle used only to discover which baseball processes explain the market outcome. It is never deployable as pregame prediction.

The FULL oracle is a teacher for PREGAME, not an input to it.

## 2025 Totals market coverage

Corrected SBR coverage audit:

- canonical regular-season games: 2,430
- games with paired opening + closing Totals: 2,425
- coverage: 99.79423868%
- missing: 5 games
- Odds API historical credits consumed: 0
- postgame fields copied into market layer: 0
- ambiguous mappings: 0
- unmapped identities: 0

Corrected Athletics artifact:

- rows: 4,016
- identities: 162
- Odds API credits: 0

The earlier apparent Athletics gap was a mapper/range issue, not source unavailability.

## 2025 compact market layer

Supabase table:

- `mlb_totals_market_2025_v1`

Rows/games: 2,425.

Market consensus policy:

- line: modal actual offered line across paired books
- price: actual offered quote nearest median implied probability
- no fabricated American odds
- opening and closing remain separate semantic roles

The builder rejected the mathematically invalid idea of averaging signed American odds directly (for example `-105` and `+100` must never become `-2.5`).

## PREGAME branch state

Main research tables:

- `mlb_totals_model_2025_v1`
- `mlb_totals_components_2025_v1`
- `mlb_totals_formula_search_v1`

Frozen/reference candidates:

### `totals_pregame_full_v1`

Formula:

`(1*offense + 2*lineup + 1*starter) / 4`

Threshold: `0.0`

2025 Apr-Aug development:

- n = 1,895
- accuracy = 54.51%
- worst month = 52.02%

September untouched holdout:

- 186/363
- 51.24%

Status: `RESEARCH_ONLY_NOT_CERTIFIED`

### `totals_under_selective_v1`

Formula:

`(1*scoring + 2*starter + 1*bullpen) / 4`

Select UNDER when score <= -0.5.

2025 Apr-Aug development:

- n = 175
- accuracy = 60.00%
- worst month = 52.38%

September untouched holdout:

- 12/18
- 66.67%

Status: `RESEARCH_ONLY_NOT_CERTIFIED`

### `totals_pregame_oracle_proxy_over_v2`

Oracle-guided proxy candidate using only pregame temperature + lineup OPS, normalized from Apr-Aug 2025.

Development:

- OVER when mean z-score >= 1.2
- n = 66
- accuracy = 65.15%
- worst development month = 60.00%

September untouched holdout:

- n = 3
- correct = 0
- accuracy = 0.00%

Status: `REJECTED_HOLDOUT_FAILURE`

Do not retune this failed candidate on September.

## FULL_DIAGNOSTIC branch

Main tables:

- `mlb_totals_full_components_2025_v1`
- `mlb_totals_full_component_stats_2025_v1`
- `mlb_totals_full_components_2026_v1`

The FULL feature layer deliberately excludes final score/final runs/winner as inputs.

FULL process components:

- `actual_offense_score`
- `actual_contact_score`
- `actual_starter_vulnerability_score`
- `actual_bullpen_vulnerability_score`
- `actual_defense_error_score`

Individual 2025 process signal vs closing-total outcome:

- actual offense: 77.68% sign accuracy, corr(margin)=0.7275
- actual bullpen vulnerability: 71.00%, corr=0.5985
- actual starter vulnerability: 67.64%, corr=0.4771
- actual contact: 62.77%, corr=0.3380
- actual defense errors: 56.61%, corr=0.1408

### Frozen FULL oracle: `totals_full_oracle_v1`

Formula:

`(3*actual_offense + 1*actual_contact + 1*actual_starter_vulnerability + 3*actual_bullpen_vulnerability) / 8`

Threshold: 0.0

Decision:

- score >= 0 => OVER
- score < 0 => UNDER

Defense weight = 0.

This formula was selected only on Apr-Aug 2025 before reading September holdout.

2025 Apr-Aug development:

- 1,488 / 1,895
- 78.52%

Monthly development accuracy:

- Apr: 76.01%
- May: 78.20%
- Jun: 80.37%
- Jul: 80.99%
- Aug: 77.31%

Untouched Sep 2025 holdout:

- 277 / 363
- 76.31%

Full 2025 market non-push set:

- 1,809 / 2,321
- 77.94%

State: `FROZEN_DIAGNOSTIC_ORACLE`

Important: this is not a betting model. It uses same-game process values and is diagnostic only.

## 2026 external FULL validation

Research market table:

- `mlb_totals_market_2026_v1`

Policy:

- SportsDataIO
- sportsbook `Consensus`
- latest paired OVER/UNDER snapshot strictly before scheduled start
- invalid American odds excluded
- no postgame snapshots

Coverage available under this exact policy:

- 1,576 games
- 2026-03-26 through 2026-08-13
- min seconds before start: 1
- non-pregame rows: 0

2026 FULL components use the frozen 2025 normalization constants from `mlb_totals_full_component_stats_2025_v1`.

External 2026 result for frozen `totals_full_oracle_v1`:

- non-push n = 1,513
- pushes = 63
- correct = 1,137
- accuracy = 75.15%

Monthly:

- Mar: 73.44% (47/64)
- Apr: 75.77% (247/326)
- May: 76.22% (266/349)
- Jun: 74.69% (242/324)
- Jul: 73.23% (227/310)
- Aug: 77.14% (108/140)

Interpretation: the FULL diagnostic process formula transfers materially across seasons, even though several individual months are below 75%. It remains non-deployable.

## What FULL teaches PREGAME

The core gap is no longer mysterious:

- same-game offense and bullpen behavior explain a large portion of Totals outcomes;
- PREGAME currently predicts those processes only weakly;
- the existing pregame aggregate bullpen component has almost zero correlation with actual bullpen vulnerability;
- promising primitive proxies include starter K% (inverse), starter hard-hit allowed, lineup/offense hard-hit, lineup OPS, park runs environment, temperature, starter RA9 and WHIP;
- proxy searches so far have not produced a stable >75% deployable pregame rule.

Therefore the next Totals research should focus on predicting the future process components themselves, especially `actual_offense_score` and `actual_bullpen_vulnerability_score`, rather than endlessly retuning direct OVER/UNDER weights.

## Current decision gate

No Totals PREGAME candidate is certified for production or APOSTAR.

The FULL oracle is validated as a diagnostic target but must remain `FULL_DIAGNOSTIC` only.

Next autonomous research path:

1. build process-specific PREGAME proxy models for actual offense/contact/starter/bullpen;
2. fit/select on 2025 development only;
3. use untouched temporal holdouts;
4. combine predicted process proxies using the frozen FULL oracle architecture only after each proxy demonstrates genuine out-of-sample signal;
5. do not open 2026 for model selection; use it only after a proxy/candidate is frozen;
6. keep all work research-only until an explicit production gate.
