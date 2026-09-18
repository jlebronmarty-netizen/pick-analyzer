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
2. `FULL_DIAGNOSTIC`: same-game process oracle used only to discover which processes explain the market outcome. It is never deployable as pregame prediction.

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
- promising primitive proxies include starter K% (inverse), starter hard-hit allowed, lineup/offense hard-hit, lineup OPS, park runs environment, starter RA9 and WHIP;
- proxy searches so far have not produced a stable >75% deployable pregame rule.

## Superseding PREGAME research update — V3 through V10

The earlier next-path checklist has now been executed and superseded by the experiments below. September 2025 was consumed as a holdout by earlier V8 research and must not be reused to tune later architectures.

### V5–V9 summary

- V5 manual nonlinear rules produced apparent development signals but failed September holdout.
- V7 pair/triple/scorecard searches did not produce a validation-gate candidate with adequate sample stability.
- V8 matchup-cross architecture produced two Jul-Aug candidates above 81% and they were frozen before opening September:
  - `totals_v8_cross_core_plus_l1_close_disagreement_q05_v1`: Jul-Aug 26/32 = 81.25%, Sep 7/14 = 50.00%.
  - `totals_v8_cross_core_plus_l10_close_disagreement_q05_v1`: Jul-Aug 30/37 = 81.08%, Sep 12/19 = 63.16%.
- Both V8 candidates are `REJECTED_SEP_HOLDOUT` and must not be rescued or retuned on September.
- V9 CART-like SQL trees also failed validation transfer.

### V10 — side-specific run projection experiment

Registry entry:

- `totals_v10_side_runs_ridge_family_v1`
- state: `REJECTED_VALIDATION_GATE`

V10 architecture:

1. predict HOME runs and AWAY runs separately;
2. use only pregame side-specific matchup features;
3. sum the two projected run counts;
4. compare projected total to the real closing total;
5. final HOME/AWAY runs are training/evaluation targets only, never features.

Coverage and feature integrity:

- market-covered 2025 games: 2,425
- side rows: 4,850
- lineup coverage: about 99.4%
- bullpen coverage: about 99.4%
- starter coverage: about 92.4%
- historical weather coverage on the xyear feature surface: 0%; weather was excluded rather than fabricated/imputed
- features per side: 46
- normalization learned only on Apr-Jun 2025

Research tables:

- `mlb_totals_v10_side_base_2025_v1`
- `mlb_totals_v10_feature_stats_2025_v1`
- `mlb_totals_v10_side_matrix_2025_v1`
- `mlb_totals_v10_ridge_runs_v1`
- `mlb_totals_v10_ridge_weights_v1`
- `mlb_totals_v10_count_runs_v1`
- `mlb_totals_v10_count_weights_v1`

Protocol:

- fit: 2025-04-01 through 2025-06-30
- selection/validation: 2025-07-01 through 2025-08-31
- frozen gate: accuracy >=75%, worst month >=70%, n>=30, minimum monthly n>=10
- September was not used to rescue/tune V10
- 2026 was not opened because no V10 candidate passed the 2025 validation gate

Raw-run ridge full-coverage best:

- HOME model: `totals_v10_home_l1`
- AWAY model: `totals_v10_away_l100`
- 406/743 = 54.64%

Best raw selective two-month accuracy:

- HOME `totals_v10_home_l1`
- AWAY `totals_v10_away_l10`
- OVER when projected-total edge >=1.75
- 22/28 = 78.57%
- failed gate because the minimum monthly sample was only 1

Best stable deployable daily policy:

- HOME `totals_v10_home_l10`
- AWAY `totals_v10_away_l0p1`
- choose daily Top-1 UNDER by projected edge
- 72/102 = 70.59%
- worst month = 70.00%
- minimum monthly n = 21
- stable sample, but below 75% accuracy gate

Count-target variants were also tested:

- `LOG1P(runs)`
- `SQRT(runs)`
- lambdas 0.01, 0.1, 1, 10, 100 for both HOME and AWAY

Best two-month count-transform near-candidate:

- HOME `totals_v10_home_sqrt_l0p1`
- AWAY `totals_v10_away_sqrt_l100`
- OVER edge >=0.5
- 26/34 = 76.47%
- worst month = 75.00%
- failed gate because minimum monthly n = 1

Affine train-only calibration and Top-K daily variants were also tested. None satisfied the complete frozen gate.

Final V10 decision:

`REJECTED_VALIDATION_GATE`

Do not open 2026 for this V10 family. Do not rescue the near-candidates by changing thresholds after seeing validation.

## V6 temporary infrastructure cleanup

The failed V6 nonlinear runtime experiment left no open research capability:

- temporary V6 SQL RPCs were dropped; remaining temp V6 functions = 0
- `mlb-totals-v6-train-temp` now requires JWT and returns 410 Gone
- `mlb-totals-v6-trigger-temp` now requires JWT and returns 410 Gone
- `mlb-totals-v6-export-temp` now requires JWT and returns 410 Gone

No raw research dataset was committed or exposed.

## Security / database closeout

All seven V10 research tables have RLS enabled.

For both `anon` and `authenticated`:

- SELECT = false
- INSERT = false

Supabase security/performance advisors were checked after V10. Remaining lints are global/pre-existing schema findings; no V10-specific privilege opening or production-surface change was introduced. Research tables intentionally use RLS with no public policy.

## Current decision gate

No Totals PREGAME candidate is certified for production or APOSTAR.

The FULL oracle remains the only Totals architecture currently above the 75% target across a large sample, but it is `FULL_DIAGNOSTIC` and therefore non-deployable.

Current frozen conclusions:

1. `totals_full_oracle_v1` remains a valid diagnostic teacher: 77.94% full 2025 and 75.15% external 2026.
2. Direct PREGAME V1–V10 families have not produced a candidate that survives the complete accuracy + temporal stability + sample-size gate.
3. V10 side-specific run projection is closed as `REJECTED_VALIDATION_GATE`.
4. 2026 remains unopened for V10 and therefore uncontaminated by V10 model selection.
5. No Official Picks writes, no APOSTAR activation, no production promotion and no historical Odds API credit spend occurred in the Totals closeout.

Next research should be a genuinely new PREGAME information/architecture path rather than further threshold tuning of V1–V10. Highest-priority missing/weak inputs are timestamp-proven historical lineup quality, reliable weather, handedness/splits and better pregame bullpen-availability/exposure modeling. Preserve the frozen FULL oracle as the diagnostic target.

## Superseding PREGAME research update — V24 through V35

This section supersedes the earlier `V1–V10` next-path guidance for the current branch.

### V24 — real-ML protocol

A bounded sklearn real-ML protocol was implemented with:

- Apr-May 2025 = fitting only;
- June 2025 = internal model/threshold selection;
- Jul-Aug 2025 = frozen pre-gate, opened only if June passes;
- 2026 = unopened;
- candidate families included ExtraTrees, RandomForest and HistGradientBoosting.

The protected preview / CI execution path was blocked operationally before a certified V24 result artifact could be produced. V24 was not used to open Jul-Aug or 2026.

### V26 — full-surface ExtraTrees

Source:

- `mlb_totals_v26_full_ml_dataset_2025_v1`
- rows = 1,891
- features used = 135
- train Apr-May = 769
- June internal validation = 381
- Jul-Aug frozen rows = 741
- weather 24h-prior coverage = 1,453 rows

Grid:

- 12 ExtraTrees specs
- 200 trees
- depths 3 / 5 / unlimited
- min leaf 5 / 15
- max_features sqrt / 0.5
- thresholds 0.55 / 0.60 / 0.65 / 0.70 / 0.75 / 0.80
- two-sided / over-only / under-only selection

June result:

- gate candidates = 0
- best full-June accuracy = 56.69%
- best selective accuracy observed = 63.46% on n=52
- corresponding worst-half accuracy = 47.83%

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V28 — individual projected-lineup handedness surface

Source:

- `mlb_totals_v28_full_individual_ml_dataset_2025_v1`
- rows = 1,891
- features used = 198
- information delta = projected-lineup batter-level rolling performance vs opposing starter handedness

June result:

- gate candidates = 0
- best full-June accuracy = 56.96%
- best stable selective summary = 49/78 = 62.82%
- worst-half accuracy = 62.50%

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V29 PVP semantic audit

The V29 projected batter-vs-pitcher layer was audited before use.

Checks:

- projected batter rows = 35,802
- V29 projected batter identity/order rows match V11-E projected lineup rows exactly
- V29-not-V11E identity mismatch count = 0
- V11E-not-V29 identity mismatch count = 0
- `prior_pvp_pa` mismatches vs strictly earlier games = 0
- `prior_pvp_pitches` mismatches vs strictly earlier games = 0
- 60-day PVP PA mismatches = 0

Conclusion:

The V29 PVP layer is legitimate PREGAME/prior evidence. Same-game PVP rows are not used as PREGAME features.

### V31 — pitch-type / repertoire matchup surface

Source:

- `mlb_totals_v31_full_pitchtype_ml_dataset_2025_v1`
- rows = 1,891
- features used = 232
- information delta = V28 plus pitch-type/repertoire matchup features

June result:

- gate candidates = 0
- best full-June accuracy = 57.22%
- best selective summary = 131/223 = 58.74%
- worst-half accuracy = 57.01%

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V32 — PVP + pitch-type surface

Constructed research table:

- `mlb_totals_v32_full_pvp_pitchtype_ml_dataset_2025_v1`
- rows = 1,891
- columns = 300
- features used = 296
- added 64 HOME/AWAY aggregated PVP features
- PVP coverage vs the V31 base = 1,891/1,891 for both teams
- forbidden postgame feature count = 0

June result:

- gate candidates = 0
- best full-June accuracy = 56.96%
- best selective summary = 57/96 = 59.38%
- worst-half accuracy = 54.17%

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V33 — categorical CatBoost classifier

Constructed research table:

- `mlb_totals_v33_catboost_entity_dataset_2025_v1`
- rows = 1,891
- columns = 303
- numerical surface = V32
- categorical PREGAME entities = HOME team, AWAY team, venue
- categorical missing rows = 0
- 30 HOME team categories
- 30 AWAY team categories
- 31 venue categories

Architecture:

- CatBoost 1.2.10
- 8 frozen specs
- depths 4 / 6
- iterations 200 / 400
- learning rate 0.03 / 0.06
- no June early stopping
- June used only for model/threshold selection

June result:

- gate candidates = 0
- best full-June accuracy = 55.91%
- best selective summary = 24/39 = 61.54%
- worst-half accuracy = 58.82%

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V34 — side-specific CatBoost Poisson

Constructed research table:

- `mlb_totals_v34_side_poisson_dataset_2025_v1`
- rows = 1,891
- HOME and AWAY final runs are target-only fields
- target-only fields never enter the feature list

Architecture:

1. fit HOME runs with CatBoost Poisson;
2. fit AWAY runs with CatBoost Poisson;
3. sum predicted HOME + AWAY means;
4. compare predicted total with real PREGAME closing total;
5. frozen edge thresholds = 0.5 / 1.0 / 1.5 / 2.0 runs.

June result:

- gate candidates = 0
- best full-June accuracy = 55.12%
- best selective summary = 26/43 = 60.47%
- worst-half accuracy = 58.82%
- best total-runs MAE among tested specs = 3.73 runs

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

### V35 — direct closing-margin CatBoost regression

Constructed research table:

- `mlb_totals_v35_close_margin_dataset_2025_v1`
- rows = 1,891
- target-only field = `y_close_margin = final_total_runs - pregame_close_total`
- `y_close_margin` is explicitly excluded from the model feature list

Architecture:

- CatBoost RMSE regression
- direct prediction of closing-total margin
- prediction sign determines OVER / UNDER
- frozen selection edge thresholds = 0.5 / 1.0 / 1.5 / 2.0 runs

June result:

- gate candidates = 0
- best full-June accuracy = 52.49%
- best selective summary = 31/51 = 60.78%
- worst-half accuracy = 52.94%
- best tested margin MAE = 3.75 runs

Decision:

`REJECTED_INTERNAL_JUNE_GATE`

Jul-Aug was not opened. 2026 was not opened.

## Methodological stop gate after V35

June 2025 has now been inspected repeatedly across materially different research families:

- V26 full-surface ExtraTrees
- V28 individual-handedness ExtraTrees
- V31 pitch-type ExtraTrees
- V32 PVP + pitch-type ExtraTrees
- V33 categorical CatBoost classification
- V34 side-specific CatBoost Poisson
- V35 direct closing-margin CatBoost regression

No family produced a candidate satisfying the frozen June gate:

- accuracy >= 70%
- worst June half >= 65%
- n >= 30
- each June half n >= 10

Continuing to invent additional V36+ architectures and selecting them against this same June period would turn June into a repeatedly optimized development target and materially weaken the meaning of the gate.

Therefore the current research status is:

`BLOCKED_VALIDATION_PROTOCOL_EXHAUSTED`

This is a methodological gate, not a data/provider failure.

Frozen boundaries at this stop:

- Jul-Aug 2025 remains unopened by V26–V35.
- 2026 remains unopened by V26–V35.
- no historical Odds API credits were consumed.
- no Official Picks writes occurred.
- APOSTAR remains disabled.
- no production promotion occurred.
- temporary V26 / V28 / V31 / V32 / V33 / V34 / V35 exporters were closed to JWT-protected `410 GONE`.
- temporary `service_role SELECT` grants used only for research export were revoked after each family.
- `anon` and `authenticated` remained without SELECT access on all research datasets.

### Authorization required for V36+

Do not continue threshold/model search against June under the current protocol.

A V36+ continuation requires an explicit protocol-reset authorization. A clean reset should define a new development/validation scheme without treating Jul-Aug or 2026 as casual tuning data. Preferred options are:

1. add an earlier historical development season (for example 2024) with timestamp-proven PREGAME inputs, design/select the new architecture there, and preserve Jul-Aug 2025 as the untouched validation gate; or
2. explicitly authorize a new validation protocol and document that the old June gate is exhausted.

Do not open Jul-Aug 2025 or 2026 merely to rescue V26–V35.

