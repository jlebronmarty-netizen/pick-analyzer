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
- `NOT_YET_UNIFIED`
- `BLOCKED_LABEL_ATTRIBUTION`
- `BLOCKED_LABEL_SEMANTICS`
- `BLOCKED_DEPENDENCY_LABELS`
- `BLOCKED_SETTLEMENT_SEMANTICS`
- `DFS_ONLY_DEFERRED`: market has not yet completed the unified protocol.

## Current market scoreboard

| Market | Current best / frozen model | Validation class | Development / historical result | 2026 external / forward result | Coverage / sample | >=75% evidence? | Unified protocol status | Next action |
|---|---|---|---:|---:|---:|---|---|---|
| **Moneyline** | `pregame_high_conf_home_v2` | `LEGACY_ADAPTIVE_2026` | Development folds: 63/81 = **77.78%** | Untouched adaptive holdout: 17/21 = **80.95%**; full selected 2026 set: 80/102 = **78.43%** | 102 selected games in recorded 2026 set | **YES**, adaptive evidence | Not a pristine 2025→2026 one-shot test | Preserve as current selective ML reference. Do not relabel adaptive evidence as pure external validation. |
| **Run Line / Spread** | `rl_v2_home_p15_alt_favorite_tsh_q92_v1` — HOME +1.5 alternate when primary HOME -1.5 | `HISTORICAL_2026_SEEN_BEFORE_FREEZE` + prospective forward | 2025: 92/107 = **85.98%** | Historical 2026 through Sep 10: 49/62 = **79.03%**; sealed prospective score still accumulating | 2025 coverage **4.40%**; 107 dev selections | **YES**, historical evidence | External one-shot field remains NULL because 2026 was seen pre-freeze | Continue fixed-clock prospective freezes. Never retro-freeze Sep 17/18. |
| **First 5 Innings Moneyline** | `f5_ml_sp0p5_ops0p08_win0p05_v1` — symmetric side rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025 certified: 60/88 = **68.18%**; worst month **64.71%**; 15 pushes | 2026 one-shot: 34/61 = **55.74%**; worst month **40.00%**; 9 pushes | 2026 selection coverage **3.56%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve frozen fallback; do not threshold-rescue from 2026. Revisit with materially different architecture/F5 pricing. |
| **First 5 Innings Totals** | `f5_total_over_ref4p5_proj5p0_v1` — OVER reference 4.5 when projected F5 total >=5.0 | `UNIFIED_2025_TO_2026_ONE_SHOT_REFERENCE_LINE` | 2025: 371/679 = **54.64%**; worst month **48.57%** | 2026: 719/1,373 = **52.37%**; worst month **49.32%**; baseline OVER ref4.5 50.14% | 2026 coverage **63.04%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | 4.5 is research reference only; obtain certified historical F5 lines before price-aware revisit. |
| **First 5 Innings 3-Way ML** | `f5_3way_sp1p0_ops0p05_win0p20_v1` — HOME/AWAY selective rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 53/84 = **63.10%**; worst month **45.45%**; draw-only best 23.21% | 2026: 22/48 = **45.83%**; worst month **39.29%**; 9 selected outcomes were DRAW | 2026 coverage **2.44%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve fallback; no 2026 threshold rescue. Draw model also failed to approach target. |
| **First 3 Innings Moneyline** | `f3_ml_winpct_extreme_q95_v1` — side from extreme prior win% advantage | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 55/77 = **71.43%**; worst month **66.67%**; 22 pushes | 2026: 36/80 = **45.00%**; 25 pushes | 2026 coverage **4.69%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve frozen fallback; no 2026 threshold rescue. |
| **First 3 Innings 3-Way ML** | `f3_3way_sp1p5_ops0p05_win0p20_v1` — HOME/AWAY selective rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 44/73 = **60.27%**; worst month **28.57%**; draw-only best 33.33% | 2026: 20/41 = **48.78%**; 7 selected outcomes were DRAW | 2026 coverage **2.09%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve fallback; no 2026 threshold rescue. |
| **First 3 Innings Totals** | `f3_total_over_ref2p5_proj3p0_v1` — OVER reference 2.5 when projected F3 total >=3.0 | `UNIFIED_2025_TO_2026_ONE_SHOT_REFERENCE_LINE` | 2025: 368/715 = **51.47%**; worst month **49.12%** | 2026: 410/841 = **48.75%**; baseline OVER ref2.5 48.94%; worst month **45.22%** | 2026 coverage **38.61%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | 2.5 is research reference only; no historical F3 line corpus. |
| **First 1 Inning Moneyline** | `f1_ml_sp1p0_win0p20_v1` — selective HOME/AWAY rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 51/74 = **68.92%**; worst month **50.00%**; 60 pushes | 2026: 24/40 = **60.00%**; 39 pushes | 2026 coverage **4.02%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Rejected unstable 76.36% q95 candidate before external; preserve stable fallback, no 2026 rescue. |
| **First 1 Inning 3-Way ML** | `f1_3way_draw_close_sp0p5_ops0p05_win0p20_v1` — selective DRAW rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 125/221 = **56.56%**; baseline DRAW 52.33%; worst month **45.61%** | 2026: 159/285 = **55.79%**; baseline DRAW 53.05%; worst month **48.78%** | 2026 coverage **14.50%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Modest lift only; preserve frozen DRAW rule, no 2026 rescue. |
| **First 1 Inning NRFI** | `f1_nrfi_both_starters_scoreless_0p80_v1` — NRFI if both starters prior F1 scoreless rate >=80% | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 58/108 = **53.70%**; baseline 50.96%; worst month **36.84%** | 2026: 68/130 = **52.31%**; baseline 51.57%; worst month **25.00%** on n=4 | 2026 coverage **14.57%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Offense filter was redundant; preserve simple starter-only rule, no 2026 rescue. |
| **First 7 Innings Moneyline** | `f7_ml_run_diff_extreme_q95_v1` — side from extreme prior run-diff advantage | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 69/91 = **75.82%**; worst month **66.67%**; 8 pushes | 2026: 35/79 = **44.30%**; 12 pushes | 2026 coverage **4.06%** | **NO externally** | `REVISIT_AFTER_FIRST_PASS` | Preserve frozen q95 cutoff; failed external validation, no 2026 rescue. |
| **First 7 Innings 3-Way ML** | `f7_3way_sp2p0_win0p20_v1` — HOME/AWAY selective rule | `UNIFIED_2025_TO_2026_ONE_SHOT` | 2025: 62/89 = **69.66%**; worst month **50.00%**; draw-only best 16.80% | 2026: 33/59 = **55.93%**; 5 selected outcomes were DRAW | 2026 coverage **3.00%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve fallback; no 2026 threshold rescue. |
| **Game Totals O/U** | `totals_v37_xyear_under_catboost_v1` — CatBoost UNDER-only, confidence 0.65 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling OOF: 265/479 = **55.32%**; worst month **52.63%** | One-shot 2026: 143/310 = **46.13%**; worst selected month **36.84%** | 2025 coverage **25.38%**; 2026 coverage **20.49%** of non-push | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve V37 without retuning. Prior V10 remains a historical reference at 72/102 = 70.59%, but was not validated under this unified cross-year protocol. Revisit Totals only after the first pass across markets with new information/architecture. |
| **Totals FULL diagnostic** | `totals_full_oracle_v1` | `DIAGNOSTIC_ONLY` | 2025 non-push: 1,809/2,321 = **77.94%** | 2026 external diagnostic: 1,137/1,513 = **75.15%** | large sample | **YES**, but NON-DEPLOYABLE | Never promote as PREGAME | Keep only as teacher/diagnostic target. |
| **Pitcher Earned Runs** | `pitcher_er_over_1p5_p70_v1` over frozen R2 | 2025 official Retrosheet ER + external 2026 outcome pending | 2025 VALIDATION+TEST: 73/91 = **80.22%**; worst split **79.66%**; baseline 64.70% | **NOT OPENED** — no canonical exact 2026 ER outcome contract yet | 2025 n=91 | **YES**, 2025 event accuracy | `TARGET_MET_75_PLUS_EXTERNAL_PENDING_CANONICAL_OUTCOME` | Preserve rule. Continue PA-13 forward price capture and exact outcome-contract work; do not substitute Runs Allowed. |
| **Pitcher Strikeouts** | `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0` data path | evidence/corpus gate | 38 replay-PASS stored rows after closeout | training not authorized | corpus too small / temporally uneven | **NO MODEL YET** | `BLOCKED_CORPUS_TOO_SMALL` | Accumulate materially new evidence; do not brute-force or mutate V2.0.0. |
| **Pitcher Walks** | `pitcher_bb_under_2p5_p85_v1` — UNDER 2.5 BB when calibrated UNDER probability >=85% | `HISTORICAL_2026_SEEN_BEFORE_MARKET_RULE_FREEZE` | 2025 rolling: 111/122 = **90.98%**; worst month **82.35%**; baseline 75.83% | 2026 historical frozen-rule result: 125/137 = **91.24%**; worst month **86.67%**; baseline 74.57% | 2025 n=122; 2026 n=137; 2026 selected coverage **3.95%** | **YES**, event accuracy | `TARGET_MET_75_PLUS_EVENT_ACCURACY`; historical pricing not certified | Preserve frozen rule. Next gate is real pregame 2.5 pricing / forward market evidence; do not claim ROI/EV/CLV yet. |
| **Pitcher Outs** | `pitcher_outs_under_18p5_p90_v1` — UNDER 18.5 when empirical UNDER probability >=90% | `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` | 2025 VALIDATION+TEST: 123/126 = **97.62%**; worst split **95.52%**; baseline 83.94% | 2026 frozen-rule: 215/226 = **95.13%**; worst month **89.23%**; baseline 82.39% | 2026 coverage **9.45%** | **YES**, event accuracy | `TARGET_MET_75_PLUS_EVENT_ACCURACY` | Preserve frozen rule; historical prices not certified, so ROI/EV/CLV remain pending. |
| **Pitcher Hits Allowed** | `pitcher_hits_allowed_under_6p5_proj_5p0_v1` — UNDER 6.5 when projected hits <=5.0 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 634/761 = **83.31%**; worst month **77.78%**; baseline 75.17% | 2026 one-shot: 968/1,226 = **78.96%**; worst month **75.69%**; baseline 75.47% | 2026 coverage **47.74%** | **YES** | `TARGET_MET_75_PLUS` | Preserve frozen rule; historical price coverage not yet certified. |
| **Pitcher Record a Win** | `pitcher_record_win_no_prior_rate_0p10_v1` — NO when prior starter win rate <=10% | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025: 147/185 = **79.46%**; worst month **75.00%**; baseline NO 68.74% | 2026 one-shot: 83/118 = **70.34%**; worst month **64.44%**; baseline NO 67.45% | 2026 coverage **6.73%** after prior-start gate | **NO externally** | `REVISIT_AFTER_FIRST_PASS` | Preserve frozen 10% rule; do not threshold-rescue from 2026. Revisit with better team/game context. |
| **Batter Hits** | `batter_hits_under_1p5_edge_0p75_v1` — UNDER 1.5 when projected hits <=0.75 | `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` | 2025 rolling: 6,123/7,011 = **87.33%**; worst month **85.19%**; baseline 79.55% | 2026 frozen-rule: 8,496/9,833 = **86.40%**; worst month **83.73%**; baseline 80.23% | 2026 coverage **27.65%** | **YES**, event accuracy | `TARGET_MET_75_PLUS_EVENT_ACCURACY` | Preserve frozen rule; historical prices not certified, so ROI/EV/CLV remain pending. |
| **Batter Total Bases** | `batter_total_bases_under_2p5_edge_1p5_v1` — UNDER 2.5 when projected TB <=1.0 | `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` | 2025 rolling: 1,081/1,187 = **91.07%**; worst month **90.19%**; baseline 80.41% | 2026 frozen-rule: 2,021/2,336 = **86.52%**; worst month **83.33%**; baseline 80.74% | 2026 coverage **6.57%** | **YES**, event accuracy | `TARGET_MET_75_PLUS_EVENT_ACCURACY` | Preserve frozen rule; historical prices not certified, so ROI/EV/CLV remain pending. |
| **Batter Home Runs** | `batter_hr_under_0p5_proj_0p10_v1` — UNDER 0.5 when projected HR <=0.10 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 11,176/12,016 = **93.01%**; worst month **92.31%**; baseline 88.75% | 2026 one-shot: 12,448/13,507 = **92.16%**; worst month **90.77%**; baseline 89.00% | 2026 coverage **37.99%** | **YES** | `TARGET_MET_75_PLUS` | Preserve frozen rule; historical prices not certified, so ROI/EV/CLV remain pending. |
| **Batter Strikeouts** | `batter_k_under_1p5_proj_0p5_v1` — UNDER 1.5 when projected K <=0.5 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 564/592 = **95.27%**; worst month **92.86%**; baseline 80.11% | 2026 one-shot: 1,000/1,074 = **93.11%**; worst month **91.30%**; baseline 80.38% | 2026 coverage **3.02%** | **YES** | `TARGET_MET_75_PLUS` | Preserve frozen rule; historical prices not certified. |
| **Batter Walks** | `batter_walks_under_0p5_proj_0p20_v1` — UNDER 0.5 when projected BB <=0.20 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 1,253/1,489 = **84.15%**; worst month **81.49%**; baseline 73.92% | 2026 one-shot: 2,590/3,106 = **83.39%**; worst month **79.13%**; baseline 72.66% | 2026 coverage **8.74%** | **YES** | `TARGET_MET_75_PLUS` | Preserve frozen rule; historical prices not certified. |
| **Batter Singles** | `batter_singles_under_1p5_proj_0p50_v1` — UNDER 1.5 when projected singles <=0.50 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 7,822/8,328 = **93.92%**; worst month **93.10%**; baseline 89.96% | 2026 one-shot: 12,690/13,634 = **93.08%**; worst month **91.16%**; baseline 90.30% | 2026 coverage **33.54%** | **YES** | `TARGET_MET_75_PLUS` | Preserve frozen rule; historical prices not certified. |
| **Batter Doubles** | `batter_doubles_under_0p5_proj_0p16_v1` — UNDER 0.5 when projected doubles <=0.16 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 12,507/14,454 = **86.53%**; worst month **84.94%**; baseline 85.07% | 2026 one-shot: 17,632/20,282 = **86.93%**; worst month **85.87%**; baseline 85.65% | 2026 coverage **49.90%** | **YES**, modest lift | `TARGET_MET_75_PLUS` | Preserve frozen rule; signal lift is modest and pricing remains uncertified. |
| **Batter Triples** | `batter_triples_under_0p5_proj_0p015_v1` — UNDER 0.5 when projected triples <=0.015 | `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT` | 2025 rolling: 27,562/27,832 = **99.03%**; worst month **98.90%**; baseline 98.74% | 2026 one-shot: 29,689/30,045 = **98.82%**; worst month **98.61%**; baseline 98.63% | 2026 coverage **73.92%** | **YES**, baseline-dominated | `TARGET_MET_75_PLUS_LOW_INCREMENTAL_SIGNAL` | Preserve only as accuracy reference; incremental lift is tiny and pricing is uncertified. |
| **Batter Runs Scored** | — | label-integrity gate | — | — | — | **NO MODEL** | `BLOCKED_LABEL_ATTRIBUTION` | 2025 total runs reconcile, but 1,409 scorer identities are missing. Recover exact runner identity or certify another per-player game outcome source. |
| **Batter RBIs** | — | label-semantics gate | — | — | — | **NO MODEL** | `BLOCKED_LABEL_SEMANTICS` | Current Retrosheet batter-appearance `rbi` equals parser play-runs, not an official RBI contract. Build/certify RBI semantics first. |
| **Batter Hits + Runs + RBIs** | — | dependency gate | Hits exact; Runs/RBI not certified | — | — | **NO MODEL** | `BLOCKED_DEPENDENCY_LABELS` | Unblock only after exact Runs and RBI outcome contracts exist. |
| **Batter Stolen Bases** | — | label-integrity gate | — | — | — | **NO MODEL** | `BLOCKED_LABEL_ATTRIBUTION` | Current `SB` flag identifies an SB event during the PA, not the runner. Require exact stolen-base runner identity. |
| **Batter First Home Run** | — | settlement gate | Raw Statcast can identify first HR hitter when a HR occurs | — | 2,132 2025 games with >=1 HR | **NO MODEL** | `BLOCKED_SETTLEMENT_SEMANTICS` | Certify sportsbook settlement for games with no HR; never condition model evaluation on postgame HR occurrence. |
| **Batter Fantasy Score** | — | DFS scoring-contract gate | — | — | — | **DEFERRED** | `DFS_ONLY_DEFERRED` | Freeze a DFS scoring-system contract before modeling; different DFS scoring systems are not assumed interchangeable. |
| **NRFI / YRFI** | `nrfi_p52_fallback_v1` — NRFI when calibrated p>=52% | `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` | 2025: 190/340 = **55.88%**; worst month **39.13%**; baseline 49.51% | 2026: 162/301 = **53.82%**; worst month **48.24%**; baseline 50.37% | 2026 coverage **18.35%** | **NO** | `REVISIT_AFTER_FIRST_PASS` | Preserve fallback; do not threshold-rescue from 2026. Revisit with materially better first-inning features/architecture. |

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

## First-pass closeout — Pitcher Walks

Frozen market rule: `pitcher_bb_under_2p5_p85_v1`.

- underlying point model: `MLB_PITCHER_BB_V1` unchanged;
- target: pitcher walks / bases on balls only, excluding HBP;
- line: 2.5;
- direction: UNDER;
- select only when calibrated UNDER probability >=85%;
- calibration minimum bin n = 20.

2025 expanding rolling evidence:

- 111/122 = **90.98%**;
- worst month = **82.35%**;
- baseline UNDER 2.5 = **75.83%**;
- lift = **+15.15 percentage points**.

Frozen-rule 2026 historical evidence:

- 125/137 = **91.24%**;
- selected coverage = **3.95%** of eligible rows;
- worst month = **86.67%**;
- baseline UNDER 2.5 = **74.57%**;
- lift = **+16.67 percentage points**;
- retuned after external rule result: **NO**.

Validation caveat: the underlying point/Brier model had 2026 diagnostics before the exact market-rule freeze, so this is not labeled a pristine untouched-season holdout. The exact line/direction/threshold was selected using 2025 only.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical sportsbook prices for these exact prop opportunities are not certified, so ROI/EV/CLV remain unclaimed.

## First-pass closeout — Batter Hits

Frozen market rule: `batter_hits_under_1p5_edge_0p75_v1`.

- strict-prior-date rolling projection;
- line = 1.5 hits;
- direction = UNDER;
- select when projected hits <=0.75;
- same-day doubleheader game 1 is excluded from game 2 prior history.

2025 expanding rolling:

- 6,123/7,011 = **87.33%**;
- worst month = **85.19%**;
- baseline UNDER 1.5 = **79.55%**;
- lift = **+7.78 percentage points**.

2026 frozen-rule historical evidence:

- 8,496/9,833 = **86.40%**;
- coverage = **27.65%**;
- worst month = **83.73%**;
- baseline UNDER 1.5 = **80.23%**;
- lift = **+6.18 percentage points**;
- retuned after external result: **NO**.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical prop prices are not certified; do not claim ROI/EV/CLV.

## First-pass closeout — Batter Total Bases

Frozen rule: `batter_total_bases_under_2p5_edge_1p5_v1`.

2025 expanding rolling: **1,081/1,187 = 91.07%**, worst month **90.19%**, baseline UNDER 2.5 **80.41%**, lift **+10.66 pts**.

2026 frozen-rule historical evidence: **2,021/2,336 = 86.52%**, coverage **6.57%**, worst month **83.33%**, baseline **80.74%**, lift **+5.78 pts**, no retuning.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — NRFI / YRFI

Frozen fallback: `nrfi_p52_fallback_v1`.

2025: **190/340 = 55.88%**, baseline NRFI **49.51%**, lift **+6.37 pts**, but worst month only **39.13%**.

2026 frozen-rule evidence: **162/301 = 53.82%**, coverage **18.35%**, baseline **50.37%**, lift **+3.46 pts**, worst month **48.24%**.

State: `REVISIT_AFTER_FIRST_PASS`.

Do not retune this candidate using 2026. Revisit later with new first-inning information or a materially different model.

## First-pass closeout — Pitcher Outs

Frozen rule: `pitcher_outs_under_18p5_p90_v1`.

2025 VALIDATION+TEST: **123/126 = 97.62%**, worst split **95.52%**, baseline UNDER 18.5 **83.94%**, lift **+13.68 pts**.

2026 frozen-rule historical evidence: **215/226 = 95.13%**, coverage **9.45%**, worst month **89.23%**, baseline **82.39%**, lift **+12.74 pts**, no retuning.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Pitcher Earned Runs

Frozen rule: `pitcher_er_over_1p5_p70_v1`.

Underlying model: `MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2`.

2025 VALIDATION+TEST:

- 73/91 = **80.22%**;
- worst split = **79.66%**;
- baseline OVER 1.5 = **64.70%**;
- lift = **+15.52 percentage points**;
- TEST model checksum MAE = **1.53265**, RMSE = **1.89392**.

2026 external event accuracy remains unopened because the canonical exact ER outcome contract is currently certified for 2025 only.

State: `TARGET_MET_75_PLUS_EXTERNAL_PENDING_CANONICAL_OUTCOME`.

Do not substitute Runs Allowed or uncertified 2026 provider fields. PA-13 forward price capture remains separate and prospective.

## First-pass closeout — Batter Home Runs

Frozen rule: `batter_hr_under_0p5_proj_0p10_v1`.

2025 rolling: **11,176/12,016 = 93.01%**, worst month **92.31%**, baseline UNDER 0.5 **88.75%**, lift **+4.26 pts**.

2026 one-shot external: **12,448/13,507 = 92.16%**, coverage **37.99%**, worst month **90.77%**, baseline **89.00%**, lift **+3.16 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Batter Strikeouts

Frozen rule: `batter_k_under_1p5_proj_0p5_v1`.

2025 rolling: **564/592 = 95.27%**, worst month **92.86%**, baseline UNDER 1.5 **80.11%**, lift **+15.16 pts**.

2026 one-shot external: **1,000/1,074 = 93.11%**, coverage **3.02%**, worst month **91.30%**, baseline **80.38%**, lift **+12.73 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Batter Walks

Frozen rule: `batter_walks_under_0p5_proj_0p20_v1`.

2025 rolling: **1,253/1,489 = 84.15%**, worst month **81.49%**, baseline UNDER 0.5 **73.92%**, lift **+10.23 pts**.

2026 one-shot external: **2,590/3,106 = 83.39%**, coverage **8.74%**, worst month **79.13%**, baseline **72.66%**, lift **+10.73 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Pitcher Hits Allowed

Frozen rule: `pitcher_hits_allowed_under_6p5_proj_5p0_v1`.

2025 rolling: **634/761 = 83.31%**, worst month **77.78%**, baseline UNDER 6.5 **75.17%**, lift **+8.14 pts**.

2026 one-shot external: **968/1,226 = 78.96%**, coverage **47.74%**, worst month **75.69%**, baseline **75.47%**, lift **+3.49 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified in the current snapshot corpus; no ROI/EV/CLV claim.

## First-pass closeout — Batter Singles

Frozen rule: `batter_singles_under_1p5_proj_0p50_v1`.

2025 rolling: **7,822/8,328 = 93.92%**, worst month **93.10%**, baseline UNDER 1.5 **89.96%**, lift **+3.96 pts**.

2026 one-shot external: **12,690/13,634 = 93.08%**, coverage **33.54%**, worst month **91.16%**, baseline **90.30%**, lift **+2.78 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Batter Doubles

Frozen rule: `batter_doubles_under_0p5_proj_0p16_v1`.

2025 rolling: **12,507/14,454 = 86.53%**, worst month **84.94%**, baseline UNDER 0.5 **85.07%**, lift **+1.46 pts**.

2026 one-shot external: **17,632/20,282 = 86.93%**, coverage **49.90%**, worst month **85.87%**, baseline **85.65%**, lift **+1.28 pts**, no retuning.

State: `TARGET_MET_75_PLUS`.

Incremental signal is positive but modest. Historical prop prices are not certified; no ROI/EV/CLV claim.

## First-pass closeout — Batter Triples

Frozen rule: `batter_triples_under_0p5_proj_0p015_v1`.

2025 rolling: **27,562/27,832 = 99.03%**, worst month **98.90%**, baseline UNDER 0.5 **98.74%**, lift **+0.29 pts**.

2026 one-shot external: **29,689/30,045 = 98.82%**, coverage **73.92%**, worst month **98.61%**, baseline **98.63%**, lift **+0.18 pts**, no retuning.

State: `TARGET_MET_75_PLUS_LOW_INCREMENTAL_SIGNAL`.

The market is baseline-dominated. High raw accuracy must not be interpreted as strong model or betting value.

## First-pass closeout — Pitcher Record a Win

Frozen rule: `pitcher_record_win_no_prior_rate_0p10_v1`.

2025: **147/185 = 79.46%**, worst month **75.00%**, baseline NO **68.74%**, lift **+10.72 pts**.

2026 one-shot external: **83/118 = 70.34%**, coverage **6.73%**, worst month **64.44%**, baseline NO **67.45%**, lift **+2.89 pts**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

The frozen 2025 rule failed the external 75% target. Do not change the threshold using 2026.

## First-pass blocked market closeouts — outcome/settlement integrity

Canonical audit:

`docs/research/MLB_MARKET_COVERAGE_INTEGRITY_AUDIT_20260918.md`

Blocked families:

- `batter_runs_scored` → `BLOCKED_LABEL_ATTRIBUTION`;
- `batter_rbis` → `BLOCKED_LABEL_SEMANTICS`;
- `batter_hits_runs_rbis` → `BLOCKED_DEPENDENCY_LABELS`;
- `batter_stolen_bases` → `BLOCKED_LABEL_ATTRIBUTION`;
- `batter_first_home_run` → `BLOCKED_SETTLEMENT_SEMANTICS`;
- `batter_fantasy_score` → `DFS_ONLY_DEFERRED`.

Do not use fuzzy identity, postgame conditioning, Runs Allowed substitutions, or approximate RBI/SB semantics merely to obtain a model score.

Alternate `*_alternate` markets reuse their base outcome family and belong in a later line-specific / price-aware calibration layer rather than a new outcome model.

## First-pass closeout — First 5 Innings Moneyline

Frozen fallback: `f5_ml_sp0p5_ops0p08_win0p05_v1`.

Target certification:

- Statcast F5 score vs Retrosheet 2025: 2,423/2,430 exact matches (**99.71%**);
- 7 one-run disagreements excluded fail-closed from 2025 development;
- F5 ties treated as pushes.

2025 development: **60/88 = 68.18%**, 15 pushes, worst month **64.71%**.

2026 one-shot external: **34/61 = 55.74%**, 9 pushes, selection coverage **3.56%**, worst month **40.00%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

No F5 historical pricing exists in the current snapshot corpus. Do not claim ROI/EV/CLV.

## First-pass closeout — First 5 Innings Totals

Frozen fallback: `f5_total_over_ref4p5_proj5p0_v1`.

Pricing caveat: no historical F5 total line corpus is currently stored. The 4.5 point is a balanced research reference line, not claimed historical sportsbook pricing.

2025: **371/679 = 54.64%**, worst month **48.57%**.

2026 one-shot: **719/1,373 = 52.37%**, coverage **63.04%**, baseline OVER reference 4.5 **50.14%**, worst month **49.32%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

Revisit only with a materially different model and/or certified F5 historical lines.

## First-pass closeout — First 5 Innings 3-Way Moneyline

Frozen fallback: `f5_3way_sp1p0_ops0p05_win0p20_v1`.

2025 side rule: **53/84 = 63.10%**, worst month **45.45%**.

A separate pre-freeze DRAW-only search reached only **13/56 = 23.21%**, versus a 15.97% draw base rate.

2026 one-shot: **22/48 = 45.83%**, coverage **2.44%**, worst month **39.29%**. Nine selected games finished DRAW and correctly count as losses for a HOME/AWAY prediction.

State: `REVISIT_AFTER_FIRST_PASS`.

No retuning after external evaluation.

## First-pass closeout — First 3 Innings Moneyline

Frozen fallback: `f3_ml_winpct_extreme_q95_v1`.

2025: **55/77 = 71.43%**, 22 pushes, worst month **66.67%**.

2026 one-shot: **36/80 = 45.00%**, 25 pushes, coverage **4.69%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 7 Innings Moneyline

Frozen candidate: `f7_ml_run_diff_extreme_q95_v1`.

2025: **69/91 = 75.82%**, 8 pushes, worst month **66.67%**.

2026 one-shot: **35/79 = 44.30%**, 12 pushes, coverage **4.06%**, worst month **34.62%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

The 2025 75%+ candidate failed external validation. Do not modify the q95 cutoff using 2026.

## First-pass closeout — First 7 Innings 3-Way Moneyline

Frozen fallback: `f7_3way_sp2p0_win0p20_v1`.

2025 side rule: **62/89 = 69.66%**, worst month **50.00%**.

Pre-freeze DRAW-only search: best stable **21/125 = 16.80%**, baseline draw rate **11.33%**.

2026 one-shot: **33/59 = 55.93%**, coverage **3.00%**, 5 selected DRAW outcomes, worst month **41.18%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 3 Innings 3-Way Moneyline

Frozen fallback: `f3_3way_sp1p5_ops0p05_win0p20_v1`.

2025 side rule: **44/73 = 60.27%**, worst month **28.57%**.

Pre-freeze DRAW-only search: best stable **38/114 = 33.33%**, baseline draw rate **25.00%**.

2026 one-shot: **20/41 = 48.78%**, coverage **2.09%**, 7 selected DRAW outcomes, worst month **44.44%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 1 Inning Moneyline

Frozen fallback: `f1_ml_sp1p0_win0p20_v1`.

2025 target certification: 2,428/2,430 exact Statcast/Retrosheet score matches; 2 one-run mismatches excluded.

2025 stable candidate: **51/74 = 68.92%**, 60 pushes, worst month **50.00%**.

A higher pooled win%-extreme candidate reached **42/55 = 76.36%**, but minimum monthly n was only 3, so it failed the predeclared stability gate and was rejected before external validation.

2026 one-shot on the frozen stable rule: **24/40 = 60.00%**, 39 pushes, coverage **4.02%**, worst month **50.00%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 1 Inning 3-Way Moneyline

Frozen fallback: `f1_3way_draw_close_sp0p5_ops0p05_win0p20_v1`.

2025: **125/221 = 56.56%**, baseline DRAW **52.33%**, lift **+4.23 pts**, worst month **45.61%**.

2026 one-shot: **159/285 = 55.79%**, baseline DRAW **53.05%**, lift **+2.74 pts**, coverage **14.50%**, worst month **48.78%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 1 Inning NRFI

Frozen fallback: `f1_nrfi_both_starters_scoreless_0p80_v1`.

Rule: select NRFI when both expected starters have at least 5 prior starts and each has a prior first-inning scoreless rate >=80%.

A team-offense filter was tested before freeze and was redundant; thresholds 0.45–0.55 produced exactly the same selected set, so the simpler starter-only rule was frozen.

2025: **58/108 = 53.70%**, baseline NRFI **50.96%**, lift **+2.75 pts**, worst month **36.84%**.

2026 one-shot: **68/130 = 52.31%**, baseline NRFI **51.57%**, lift **+0.74 pts**, coverage **14.57%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

## First-pass closeout — First 3 Innings Totals

Frozen fallback: `f3_total_over_ref2p5_proj3p0_v1`.

Pricing caveat: 2.5 is a research reference line only; no historical F3 total-line corpus is stored.

2025: **368/715 = 51.47%**, worst month **49.12%**.

2026 one-shot: **410/841 = 48.75%**, baseline OVER reference 2.5 **48.94%**, coverage **38.61%**, worst month **45.22%**, no retuning.

State: `REVISIT_AFTER_FIRST_PASS`.

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
