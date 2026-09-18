# MLB Market Model Tracker

Repository: `jlebronmarty-netizen/pick-analyzer`  
Canonical Supabase: `ynuocvexviorgdjrfthw`  
Tracker status: `ACTIVE / RESEARCH-ONLY`  
Target benchmark: **>= 75% predictive accuracy on a sufficiently stable selective sample**  
Official Picks: unchanged  
APOSTAR: disabled

## Purpose

This file is the canonical cross-market progress tracker for MLB model research.

The operating rule is:

1. work each market independently;
2. use 2025 as development data;
3. prefer chronological / expanding-window validation inside 2025;
4. freeze the selected formula/model before external evaluation;
5. use 2026 as a one-shot external evaluation **only when that market has an uncontaminated 2026 holdout**;
6. if no defensible formula reaches 75%+, preserve the best stable formula found, mark the market `REVISIT_AFTER_FIRST_PASS`, and continue to the next market;
7. after the first pass across markets, return to below-target markets with new information or materially different architectures rather than threshold rescue.

A high-accuracy selective model is acceptable even when coverage is low. Accuracy, temporal stability, sample size, coverage, and validation lineage must all remain visible.

## Validation labels

- `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`: selected only from 2025 chronological development; 2026 opened once after freeze.
- `LEGACY_ADAPTIVE_2026`: model/search used 2026 during development; useful evidence, but not a pristine 2025→2026 external test.
- `HISTORICAL_2026_SEEN_BEFORE_FREEZE`: 2026 historical results were inspected before final freeze; useful evidence, but not a pristine one-shot external test.
- `PROSPECTIVE_FORWARD`: fixed pregame formula evaluated only on future observations captured after freeze.
- `DIAGNOSTIC_ONLY`: same-game/FULL information; never deployable as a pregame betting model.
- `NOT_YET_UNIFIED`: market has not yet completed the unified protocol.

## Current market scoreboard

| Market | Current best / frozen model | Validation class | Development / historical result | 2026 external / forward result | Coverage / sample | >=75% evidence? | Unified protocol status | Next action |
|---|---|---|---:|---:|---:|---|---|---|
| **Moneyline** | `pregame_high_conf_home_v2` | `LEGACY_ADAPTIVE_2026` | Development folds: 63/81 = **77.78%** | Untouched adaptive holdout: 17/21 = **80.95%**; full selected 2026 set: 80/102 = **78.43%** | 102 selected games in recorded 2026 set | **YES**, adaptive evidence | Not a pristine 2025→2026 one-shot test | Preserve as current selective ML reference. Do not relabel adaptive evidence as pure external validation. |
| **Run Line / Spread** | `rl_v2_home_p15_alt_favorite_tsh_q92_v1` — HOME +1.5 alternate when primary HOME -1.5 | `HISTORICAL_2026_SEEN_BEFORE_FREEZE` + prospective forward | 2025: 92/107 = **85.98%** | Historical 2026 through Sep 10: 49/62 = **79.03%**; sealed prospective score still accumulating | 2025 coverage **4.40%**; 107 dev selections | **YES**, historical evidence | External one-shot field remains NULL because 2026 was seen pre-freeze | Continue fixed-clock prospective freezes. Never retro-freeze Sep 17/18. |
| **Game Totals O/U** | `totals_v37_xyear_under_catboost_v1` — CatBoost UNDER-only, confidence 0.65 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling OOF: 265/479 = **55.32%**; worst month **52.63%** | One-shot 2026: 143/310 = **46.13%**; worst selected month **36.84%** | 2025 coverage **25.38%**; 2026 coverage **20.49%** of non-push | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve V37 without retuning. Prior V10 remains a historical reference at 72/102 = 70.59%, but was not validated under this unified cross-year protocol. Revisit Totals only after the first pass across markets with new information/architecture. |
| **Totals FULL diagnostic** | `totals_full_oracle_v1` | `DIAGNOSTIC_ONLY` | 2025 non-push: 1,809/2,321 = **77.94%** | 2026 external diagnostic: 1,137/1,513 = **75.15%** | large sample | **YES**, but NON-DEPLOYABLE | Never promote as PREGAME | Keep only as teacher/diagnostic target. |
| **Pitcher Earned Runs** | PA-12 forward point-shadow V2 | `PROSPECTIVE_FORWARD` | Point-model math frozen from sealed prior research | Sep 18 pilot: 23 eligible point forecasts; settlement/accumulation in progress | prospective sample still small | N/A — point forecast, not market accuracy yet | Not market-certified | Accumulate fixed-clock forecasts + PA-13 real prices. Do not infer ROI/EV yet. |
| **Pitcher Strikeouts** | `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` data path | evidence/corpus gate | 38 replay-PASS stored rows after closeout | training not authorized | corpus too small / temporally uneven | **NO MODEL YET** | `BLOCKED_CORPUS_TOO_SMALL` | Accumulate materially new evidence; do not brute-force or mutate V2.0.0. |
| **Pitcher Walks** | — | `NOT_YET_UNIFIED` | — | — | — | TBD | Pending first-pass review | Evaluate after game markets / currently prioritized props. |
| **Pitcher Outs** | — | `NOT_YET_UNIFIED` | — | — | — | TBD | Pending first-pass review | Evaluate under unified protocol when reached. |
| **Batter Hits** | — | `NOT_YET_UNIFIED` | — | — | — | TBD | Pending first-pass review | Evaluate under unified protocol when reached. |
| **Batter Total Bases** | — | `NOT_YET_UNIFIED` | — | — | — | TBD | Pending first-pass review | Evaluate under unified protocol when reached. |
| **NRFI / YRFI** | — | `NOT_YET_UNIFIED` | — | — | — | TBD | Pending first-pass review | Evaluate under unified protocol when reached. |

## First-pass closeouts

### Game Totals O/U — CLOSED FOR FIRST PASS

Canonical unified candidate: `totals_v37_xyear_under_catboost_v1`.

- 2025 chronological development: **265/479 = 55.32%**.
- 2025 worst month: **52.63%**.
- 2025 coverage: **25.38%** of rolling non-push OOF rows.
- frozen before opening 2026: **YES**.
- exact cross-year feature parity: **YES** — 128 shared feature/meta columns, 0 name mismatches, 0 type mismatches.
- 2026 one-shot external: **143/310 = 46.13%**.
- 2026 coverage: **20.49%** of 1,513 non-push games.
- retuned after external result: **NO**.
- target >=75%: **NOT MET**.
- state: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue V37 using its 2026 result. Preserve V10/V36/V37 lineage and return to Totals only after the first pass across the remaining markets.

## Unified 2025 rolling-development protocol

For a market with suitable 2025 PREGAME data, the default chronological development design is:

- fold 1: train through April → validate May;
- fold 2: train through May → validate June;
- fold 3: train through June → validate July;
- fold 4: train through July → validate August;
- fold 5: train through August → validate September.

Opening Day / March rows may be used as training history where feature semantics permit, but no future game may enter a prior-game feature.

Model selection must use only 2025 information.

Track at minimum:

- pooled out-of-fold accuracy;
- correct / incorrect;
- selected n;
- coverage;
- per-month accuracy;
- worst-month accuracy;
- temporal standard deviation;
- direction split (OVER/UNDER, HOME/AWAY, etc.) where applicable;
- model / feature contract;
- threshold / selection rule;
- contamination status.

### Market closeout rule

At the end of a market's first pass:

- if a stable candidate reaches the >=75% target, freeze it and record it as the market champion;
- if no candidate reaches 75%, freeze/document the best defensible stable candidate anyway and mark `REVISIT_AFTER_FIRST_PASS`;
- do **not** keep tuning against 2026 to rescue it;
- move to the next market.

After all target markets receive a first pass, revisit the below-75% markets using new information surfaces or materially different architectures.

## 2026 external evaluation rule

For markets whose 2026 data has not been used for model selection:

1. freeze all features, parameters, thresholds, routes, and selection policy from 2025;
2. record a model hash/version before opening 2026;
3. evaluate 2026 once;
4. persist accuracy, n, coverage, monthly stability, and any applicable pricing metrics;
5. never retune that frozen version using its external 2026 result.

If 2026 has already been inspected during development, the tracker must say so. Such evidence remains useful, but the `2026 one-shot external` field must not be falsely populated.

## Market completion states

- `TARGET_MET_75_PLUS`
- `TARGET_MET_75_PLUS_EXTERNAL_PENDING`
- `REVISIT_AFTER_FIRST_PASS`
- `PROSPECTIVE_VALIDATION_PENDING`
- `BLOCKED_DATA_SUFFICIENCY`
- `NOT_YET_UNIFIED`

## Research boundaries

- Never use final score, final runs, winner, RBI, or FULL/same-game values as PREGAME features.
- Outcomes may be labels/targets only.
- Do not modify Official Picks.
- Do not activate APOSTAR.
- Do not claim EV, ROI, CLV, or betting profitability without real certified pricing evidence.
- Do not spend historical Odds API credits until existing canonical coverage is exhausted and an explicit need is documented.
- Moneyline and frozen Run Line candidates must not be silently retuned while other markets are being researched.
- Every percentage in this tracker must be traceable to a persisted registry, artifact, or certified research document.

## Update discipline

Update this tracker whenever one of these events occurs:

1. a market gets a new best stable candidate;
2. a candidate crosses or falls below the 75% benchmark under a new validation stage;
3. a 2026 one-shot external result is opened;
4. a prospective frozen model accumulates a meaningful new block of results;
5. a market is closed for first pass and moved to `REVISIT_AFTER_FIRST_PASS`;
6. a previously blocked market obtains sufficient data to resume.
