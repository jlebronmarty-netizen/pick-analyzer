# MLB Model Research — Canonical Handoff

**Repository:** `jlebronmarty-netizen/pick-analyzer`  
**Canonical Supabase project:** `ynuocvexviorgdjrfthw` (`Pick Analyzer`)  
**Last updated:** 2026-09-18  
**Status:** ACTIVE RESEARCH / CONTINUE FROM HERE


## 2026-09-18 First 5 Innings Totals first-pass closeout — authoritative

Frozen fallback: `f5_total_over_ref4p5_proj5p0_v1`.

- no historical F5 sportsbook lines exist in the current corpus;
- 4.5 is a research reference line only;
- model uses strict-prior-date team F5 scored/allowed history with minimum 5 prior games per team;
- final 2025 fit: intercept 2.14443614450973, slope 0.591475378488326;
- select OVER reference 4.5 when projection >=5.0.

2025: 371/679 = **54.64%**, worst month **48.57%**.

2026 one-shot: 719/1,373 = **52.37%**, coverage **63.04%**, reference-line baseline **50.14%**, worst month **49.32%**.

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version with 2026. No ROI/EV/CLV claim without certified F5 lines/prices.

## 2026-09-18 First 5 Innings Moneyline first-pass closeout — authoritative

Frozen fallback: `f5_ml_sp0p5_ops0p08_win0p05_v1`.

Target certification:

- F5 score from Statcast post-inning score;
- 2,423/2,430 2025 mapped games agree exactly with Retrosheet F5 score;
- 7 one-run disagreements excluded fail-closed from 2025 development;
- ties are pushes.

Rule is symmetric:

- HOME when starter RA9 advantage >=0.50, offense OPS advantage >=0.08 and prior win% advantage >=0.05;
- AWAY on the symmetric inverse.

2025: 60/88 = **68.18%**, 15 pushes, worst month **64.71%**.

2026 one-shot: 34/61 = **55.74%**, 9 pushes, coverage **3.56%**, worst month **40.00%**.

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version using 2026. No certified historical F5 price corpus exists.

## 2026-09-18 standard MLB prop coverage integrity audit — authoritative

Canonical audit:

`docs/research/MLB_MARKET_COVERAGE_INTEGRITY_AUDIT_20260918.md`

The standard MLB prop inventory now explicitly tracks markets that cannot yet receive a valid first-pass model because the outcome or settlement contract is incomplete.

Blocked states:

- `batter_runs_scored` → `BLOCKED_LABEL_ATTRIBUTION`
  - Retrosheet parser reproduces all 21,596 2025 runs at game/season level;
  - 1,409 explicit advances to home lack a certified scorer identity;
  - do not model player Runs until attribution is complete.
- `batter_rbis` → `BLOCKED_LABEL_SEMANTICS`
  - current batter-appearance `rbi` is parser play-runs, not an official RBI scoring contract.
- `batter_hits_runs_rbis` → `BLOCKED_DEPENDENCY_LABELS`
  - Hits are exact, but Runs and RBI remain blocked.
- `batter_stolen_bases` → `BLOCKED_LABEL_ATTRIBUTION`
  - current `SB` flag identifies an SB event during the PA, not the certified runner.
- `batter_first_home_run` → `BLOCKED_SETTLEMENT_SEMANTICS`
  - raw Statcast identifies the first HR hitter when a HR occurs;
  - no-HR sportsbook settlement is not certified;
  - never condition evaluation on postgame HR occurrence.
- `batter_fantasy_score` → `DFS_ONLY_DEFERRED`
  - no canonical DFS scoring-system contract is frozen.

Identity audit:

- Retrosheet 2025 lineup IDs: 661 player IDs;
- 643 map uniquely to MLBAM through canonical game/team/batting-order crosswalk;
- 18 are ambiguous and remain fail-closed;
- 0 are wholly unmapped in that lineup crosswalk.

Do not introduce fuzzy identity matching merely to unblock these markets.

Alternate `*_alternate` markets reuse the same base outcome family and should be handled later by line-specific / price-aware calibration, not by inventing separate outcome targets.

Historical Odds API credits consumed by this audit: 0.
Official Picks writes: 0.
APOSTAR: disabled.
Production promotion: none.

## 2026-09-18 Pitcher Record a Win first-pass closeout — authoritative

Frozen rule: `pitcher_record_win_no_prior_rate_0p10_v1`.

- market key = `pitcher_record_a_win`;
- selection = NO;
- maximum prior starter win rate = 10%;
- minimum prior starts = 5;
- same-date prior starts excluded.

2025 evidence:

- 147/185 = **79.46%**;
- worst month = **75.00%**;
- baseline NO = **68.74%**;
- lift = **+10.72 pts**.

2026 one-shot evidence from already-stored SportsDataIO starter game rows through 2026-07-19:

- 83/118 = **70.34%**;
- coverage after prior-start gate = **6.73%**;
- worst month = **64.44%**;
- baseline NO = **67.45%**;
- lift = **+2.89 pts**;
- null provider player IDs excluded fail-closed;
- retuned after external = **NO**.

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this version by changing the 10% threshold after seeing 2026.

## 2026-09-18 Batter Triples first-pass closeout — authoritative

Frozen rule: `batter_triples_under_0p5_proj_0p015_v1`.

2025 rolling: 27,562/27,832 = **99.03%**; worst month **98.90%**; baseline UNDER 0.5 **98.74%**; lift **+0.29 pts**.

2026 one-shot external: 29,689/30,045 = **98.82%**; coverage **73.92%**; worst month **98.61%**; baseline **98.63%**; lift **+0.18 pts**; no retuning.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS_LOW_INCREMENTAL_SIGNAL`.

This market is baseline-dominated; do not infer model value or profitability from raw accuracy.

## 2026-09-18 Batter Doubles first-pass closeout — authoritative

Frozen rule: `batter_doubles_under_0p5_proj_0p16_v1`.

2025 rolling: 12,507/14,454 = **86.53%**; worst month **84.94%**; baseline UNDER 0.5 **85.07%**; lift **+1.46 pts**.

2026 one-shot external: 17,632/20,282 = **86.93%**; coverage **49.90%**; worst month **85.87%**; baseline **85.65%**; lift **+1.28 pts**; no retuning.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Incremental signal is positive but modest. Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Batter Singles first-pass closeout — authoritative

Frozen rule: `batter_singles_under_1p5_proj_0p50_v1`.

2025 rolling: 7,822/8,328 = **93.92%**; worst month **93.10%**; baseline UNDER 1.5 **89.96%**; lift **+3.96 pts**.

2026 one-shot external: 12,690/13,634 = **93.08%**; coverage **33.54%**; worst month **91.16%**; baseline **90.30%**; lift **+2.78 pts**; no retuning.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Pitcher Hits Allowed first-pass closeout — authoritative

Frozen rule: `pitcher_hits_allowed_under_6p5_proj_5p0_v1`.

- official Odds API market key: `pitcher_hits_allowed`;
- previous starts only;
- line = 6.5 hits allowed;
- direction = UNDER;
- select when projected hits allowed <= 5.0.

2025 rolling:

- 634/761 = **83.31%**;
- worst month = **77.78%**;
- baseline UNDER 6.5 = **75.17%**;
- lift = **+8.14 pts**.

2026 one-shot external:

- 968/1,226 = **78.96%**;
- coverage = **47.74%**;
- worst month = **75.69%**;
- baseline = **75.47%**;
- lift = **+3.49 pts**;
- retuned after external = **NO**.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Historical prop price coverage is not yet certified in the current snapshot corpus; no ROI/EV/CLV claim.

## 2026-09-18 Batter Walks first-pass closeout — authoritative

Frozen rule: `batter_walks_under_0p5_proj_0p20_v1`.

- strict-prior-date batter history only;
- line = 0.5 batter walks;
- direction = UNDER;
- select when projected walks <= 0.20.

2025 rolling:

- 1,253/1,489 = **84.15%**;
- worst month = **81.49%**;
- baseline UNDER 0.5 = **73.92%**;
- lift = **+10.23 pts**.

2026 one-shot external:

- 2,590/3,106 = **83.39%**;
- coverage = **8.74%**;
- worst month = **79.13%**;
- baseline = **72.66%**;
- lift = **+10.73 pts**;
- retuned after external = **NO**.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Batter Strikeouts first-pass closeout — authoritative

Frozen rule: `batter_k_under_1p5_proj_0p5_v1`.

- strict-prior-date batter history only;
- line = 1.5 batter strikeouts;
- direction = UNDER;
- select when projected strikeouts <= 0.50.

2025 rolling:

- 564/592 = **95.27%**;
- worst month = **92.86%**;
- baseline UNDER 1.5 = **80.11%**;
- lift = **+15.16 pts**.

2026 one-shot external:

- 1,000/1,074 = **93.11%**;
- coverage = **3.02%**;
- worst month = **91.30%**;
- baseline = **80.38%**;
- lift = **+12.73 pts**;
- retuned after external = **NO**.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Batter Home Runs first-pass closeout — authoritative

Frozen rule: `batter_hr_under_0p5_proj_0p10_v1`.

- strict-prior-date batter history only;
- line = 0.5 HR;
- direction = UNDER;
- select when projected HR <= 0.10.

2025 rolling:

- 11,176/12,016 = **93.01%**;
- worst month = **92.31%**;
- baseline UNDER 0.5 = **88.75%**;
- lift = **+4.26 pts**.

2026 one-shot external:

- 12,448/13,507 = **92.16%**;
- coverage = **37.99%**;
- worst month = **90.77%**;
- baseline = **89.00%**;
- lift = **+3.16 pts**;
- retuned after external = **NO**.

Validation class: `UNIFIED_2025_ROLLING_TO_2026_ONE_SHOT`.

State: `TARGET_MET_75_PLUS`.

Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Pitcher Earned Runs first-pass closeout — authoritative

Frozen market rule:

`pitcher_er_over_1p5_p70_v1`

Underlying research model:

`MLB_PITCHER_EARNED_RUNS_RESEARCH_V1_R2`

Frozen R2 coefficients reproduced from official 2025 Retrosheet `data,er` outcomes and strict-prior PREGAME features:

- base intercept = 1.90273530551357;
- base slope on prior ER all-history = 0.227085168912444;
- residual intercept = 0.653408289475203;
- residual slope on pregame pitcher K-rate = -3.0156054216154.

TEST checksum:

- MAE = **1.53264877098586**;
- RMSE = **1.89392266393888**.

Frozen rule:

- line = 1.5 ER;
- direction = OVER;
- select when empirical P(OVER 1.5 ER) >= 70%.

2025 VALIDATION + TEST:

- 73/91 = **80.22%**;
- worst split = **79.66%**;
- baseline OVER 1.5 = **64.70%**;
- lift = **+15.52 percentage points**.

State:

`TARGET_MET_75_PLUS_EXTERNAL_PENDING_CANONICAL_OUTCOME`

External 2026 event accuracy remains unopened because the canonical exact Pitcher ER outcome contract currently certifies 2025 only. Do not substitute Runs Allowed or uncertified provider ER fields.

PA-13 forward pregame pricing capture remains separate and prospective. Historical prices are not certified; do not claim ROI/EV/CLV.

## 2026-09-18 Pitcher Outs first-pass closeout — authoritative

Frozen rule: `pitcher_outs_under_18p5_p90_v1`.

Rule:

- underlying model: `MLB_PITCHER_OUTS_RESEARCH_V1`;
- alpha = 0.2;
- beta = 0.7;
- fit intercept = 7.2635858445929635;
- fit slope = 0.547385023095297;
- line = 18.5 recorded outs;
- direction = UNDER;
- select when empirical UNDER probability >= 90% (equivalently P(OVER) <= 10%);
- probability source = 2025 TRAIN residual distribution.

2025 VALIDATION + TEST:

- 123/126 = **97.62%**;
- worst split = **95.52%**;
- baseline UNDER 18.5 = **83.94%**;
- lift = **+13.68 percentage points**.

2026 frozen-rule historical evidence:

- canonical lineage reproduced exactly: 3,005 SportsDataIO starters -> 2,464 Statcast matches -> 2,391 strict-prior scored rows;
- exact frozen-rule selections = 226;
- correct = 215;
- accuracy = **95.13%**;
- coverage = **9.45%**;
- worst selected month = **89.23%**;
- baseline UNDER 18.5 = **82.39%**;
- lift = **+12.74 percentage points**;
- retuned after external result = **NO**.

State:

`TARGET_MET_75_PLUS_EVENT_ACCURACY`

Lineage label: `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` because aggregate 2026 point/Brier diagnostics existed before the exact market-rule freeze. The exact line/direction/confidence rule was selected from 2025 only and was not changed after reading the exact 2026 rule result.

Historical sportsbook prices for the exact selected opportunities are not certified. Do not claim ROI, EV or CLV from this accuracy result.

## 2026-09-18 NRFI / YRFI first-pass closeout — authoritative

Frozen fallback: `nrfi_p52_fallback_v1`.

- direction: NRFI;
- select when calibrated P(NRFI) >= 52%.

2025 evidence: 190/340 = **55.88%**; baseline **49.51%**; lift **+6.37 pts**; worst month **39.13%**.

2026 frozen-rule evidence: 162/301 = **53.82%**; coverage **18.35%**; baseline **50.37%**; lift **+3.46 pts**; worst month **48.24%**.

State: `REVISIT_AFTER_FIRST_PASS`.

Do not rescue this candidate using 2026 threshold changes. Revisit after the first pass with materially better first-inning inputs/architecture.

## 2026-09-18 Batter Total Bases first-pass closeout — authoritative

Frozen rule: `batter_total_bases_under_2p5_edge_1p5_v1`.

- strict-prior-date history;
- line = 2.5 total bases;
- direction = UNDER;
- select when projected total bases <= 1.0.

2025 rolling: 1,081/1,187 = **91.07%**; worst month **90.19%**; baseline UNDER 2.5 **80.41%**; lift **+10.66 pts**.

2026 frozen-rule historical evidence: 2,021/2,336 = **86.52%**; coverage **6.57%**; worst month **83.33%**; baseline **80.74%**; lift **+5.78 pts**.

State: `TARGET_MET_75_PLUS_EVENT_ACCURACY`.

Lineage label: `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE`. Exact line/direction/edge came from strict 2025 rolling and was not retuned after the 2026 rule result.

Historical pricing is not certified; no ROI/EV/CLV claim.

## 2026-09-18 Batter Hits first-pass closeout — authoritative

Frozen market rule:

`batter_hits_under_1p5_edge_0p75_v1`

Rule:

- strict-prior-date batter history only;
- line = 1.5 hits;
- direction = UNDER;
- select when projected hits <= 0.75;
- same-day game 1 is not prior input for game 2.

2025 expanding rolling:

- 6,123/7,011 = **87.33%**;
- worst month = **85.19%**;
- baseline UNDER 1.5 = **79.55%**;
- lift = **+7.78 percentage points**.

Frozen-rule 2026 historical evidence:

- 8,496/9,833 = **86.40%**;
- selected coverage = **27.65%**;
- worst month = **83.73%**;
- baseline UNDER 1.5 = **80.23%**;
- lift = **+6.18 percentage points**.

State:

`TARGET_MET_75_PLUS_EVENT_ACCURACY`

Lineage label: `HISTORICAL_2026_MODEL_DIAGNOSTICS_SEEN_BEFORE_MARKET_RULE_FREEZE` because aggregate 2026 point/Brier diagnostics had already been read before the exact market-rule freeze. The exact line/direction/edge was selected from 2025 strict rolling only and was not retuned afterward.

Historical sportsbook prices are not certified; no ROI/EV/CLV claim.

## 2026-09-18 Pitcher Walks first-pass closeout — authoritative

Frozen market rule:

`pitcher_bb_under_2p5_p85_v1`

Rule:

- underlying point model remains `MLB_PITCHER_BB_V1`;
- target is true BB only; HBP excluded;
- line = 2.5;
- direction = UNDER;
- select only when calibrated UNDER probability >= 85%;
- minimum calibration-bin sample = 20.

2025 expanding rolling evidence:

- 111/122 = **90.98%**;
- worst month = **82.35%**;
- baseline UNDER 2.5 = **75.83%**;
- lift = **+15.15 percentage points**.

Frozen-rule 2026 historical evidence:

- 125/137 = **91.24%**;
- worst month = **86.67%**;
- selected coverage = **3.95%**;
- baseline UNDER 2.5 = **74.57%**;
- lift = **+16.67 percentage points**.

State:

`TARGET_MET_75_PLUS_EVENT_ACCURACY`

Important lineage caveat: the underlying point/Brier model had 2026 diagnostics before this exact market-rule freeze, so this evidence is labeled `HISTORICAL_2026_SEEN_BEFORE_MARKET_RULE_FREEZE`, not a pristine untouched-season external holdout. The exact line/direction/threshold was selected from 2025 only and was not retuned after reading rule accuracy in 2026.

Historical sportsbook pricing for the exact selected prop opportunities is not certified. Do not claim ROI, EV or CLV from this accuracy result.

## 2026-09-18 unified market protocol addendum — authoritative

The user has explicitly authorized a unified cross-market research workflow:

- use **2025 as the development season**;
- use chronological / expanding-window validation inside 2025 where the required PREGAME feature surface is available;
- freeze the chosen formula/model before external evaluation;
- use **2026 as a one-shot external evaluation only when that market's 2026 data remains uncontaminated by model selection**;
- if no defensible model reaches the >=75% target, preserve the best stable model found, mark that market `REVISIT_AFTER_FIRST_PASS`, and continue to the next market;
- after all target markets receive a first pass, revisit the below-target markets with new information or materially different architectures rather than threshold rescue.

Canonical cross-market tracker:

`docs/research/MLB_MARKET_MODEL_TRACKER.md`

The tracker must distinguish:

- pure 2025→2026 one-shot external tests;
- adaptive 2026 evidence;
- historical 2026 evidence seen before freeze;
- prospective forward evidence;
- FULL/diagnostic-only results.

Never relabel adaptive or already-seen 2026 evidence as an untouched external holdout.

For Totals specifically, the old repeated-June V26–V35 stop gate is superseded by this user-authorized protocol reset. The next valid Totals path is to extend the same PREGAME feature surface through September 2025, evaluate candidates with rolling/expanding 2025 folds, freeze the best stable candidate even if it remains below 75%, and only then open 2026 once.

## 2026-09-18 continuity addendum — authoritative newer state

The sections below preserve older research history, but the following states supersede any earlier continuation pointer when they conflict.

### Pitcher Strikeouts / PA-14 V2

- V1 remains terminal: `HISTORICAL_ARTIFACT_INCOMPLETE`.
- frozen V2 input contract: `PE_PITCHER_K_V2_INPUT_CONTRACT/2.0.0`.
- frozen builder hash: `697ead7e1d596aa3aeee50fbeafe45424735af5ca32f58c5786a4965064a0fc3`.
- canonical stored corpus after historical closeout: **38** replay-PASS rows:
  - 37 historical 2025;
  - 1 source-certification 2026;
  - Apr 13 / May 9 / Jun 5 / Jul 3 / Aug 3 / Sep 4.
- two independent balanced audits: 20/72 and 14/72 ELIGIBLE;
- directed September audit: 3/40 ELIGIBLE;
- disposition: `HISTORICAL_PATH_CERTIFIED_BUT_CORPUS_TOO_SMALL_AND_TEMPORALLY_UNEVEN_FOR_TRAINING`;
- `PE_PITCHER_K_V2_TRAINING_AUTHORIZED = NO`;
- `PE_PITCHER_K_V2_MODEL_STATUS = NOT_STARTED`.

Pick Analyzer PR #46 merged at:

`daebdd2651f0092bbae32161b619079a195bbf77`

Do not continue brute-force historical sampling as if it were guaranteed to solve sufficiency. Accumulate materially new forward evidence or explicitly gate a separately versioned future contract. Do not mutate V2.0.0.

### Run Line V2 prospective candidate

Frozen candidate:

`rl_v2_home_p15_alt_favorite_tsh_q92_v1`

Rules remain unchanged:

- standard market condition: HOME -1.5 favorite;
- target alternate market: HOME +1.5;
- score: `(team_strength + starter + history) / sqrt(3)`;
- threshold: `2.065112`;
- research/shadow only.

Prospective chronology:

- Sep17: alternate market evidence captured, but no valid fixed-clock freeze; date cannot count as scored prospective evidence.
- Sep18: core pregame market capture and HOME +1.5 alternates were captured, but the original 10:45 daily route returned 500 before a valid freeze. Sep18 also cannot count as a scored prospective date.
- an independent Run Line forward cron was subsequently added at 10:46 PR.
- PR #48 hardened new freeze writes to **10:45–10:59 America/Puerto_Rico** and prohibits late reconstruction.

PR #48 merge:

`034429aa70b54bda5bff725a510a942103555bf1`

The next valid scored prospective date is the first future date with a real fixed-clock freeze and later exact settlement. Never retro-freeze Sep17 or Sep18.

### PA-13 Pitcher Earned Runs forward pricing

Historical pricing remains absent.

First certified forward capture on 2026-09-18:

- 180 quote rows;
- 14 canonical games;
- 26 exact MLBAM pitchers;
- 4 sportsbooks;
- 31 distinct pitcher/line combinations;
- 90 pitcher-book-line groups;
- 90/90 complete Over/Under pairs;
- 0 timing violations;
- one provider event excluded fail-closed for `PROVIDER_EVENT_IDENTITY_MISMATCH`.

Contract:

`PA13_PITCHER_ER_FORWARD_CAPTURE/1.0.0`

Current gates:

- `PA13_FORWARD_CURRENT_PRICING_SOURCE_READY = YES`;
- `PA13_HISTORICAL_PRICING_CERTIFIED = NO`;
- `PA13_ROI_CERTIFIED = NO`;
- `PA13_CLV_CERTIFIED = NO`;
- `PA13_EV_CERTIFIED = NO`.

PR #49 merge:

`3a830d45953af2d411ce2149ac8ea05731fb3a90`

### PA-12 Pitcher Earned Runs forward point-shadow V2

The sealed PA-12 V1 research result remains **not promoted** and is not reopened.

A separately versioned forward point-shadow path is now certified:

`MLB_PITCHER_ER_PA12_FORWARD_SHADOW_V2`

Frozen math is inherited unchanged from the validation-selected V1 candidate:

- base intercept: `1.90273530551357`;
- base slope on exact prior ER starts: `0.227085168912444`;
- K residual intercept: `0.653408289475204`;
- K-rate residual slope: `-3.0156054216154`;
- minimum prior exact starts: 3.

Source validation:

- MLB Official game-log `earnedRuns` vs certified Retrosheet ER: **24/24 exact**;
- K-rate semantic parity: **6/6 exact**, using K/BF over all strict-prior pitcher appearances.

First Sep18 prospective pilot:

- target pitchers: 26;
- eligible point forecasts: 23;
- blocked for <3 prior starts: 3;
- ledger: `415b36ba-6137-4803-ba27-8eca5965f54e`;
- all forecasts pregame;
- settlement pending exact final outcomes.

PR #50 merge:

`14f53864118d8b512abc2997949a94042dc43b61`

PR #51 then merged the research-only runtime:

`5a63d4cbda08a4100c48aed03533ae10f4565228`

Runtime behavior:

1. existing MLB daily cron is reused; no new scheduler;
2. new point freezes only at **10:45–10:59 PR**;
3. freeze executes after PA-13 target capture but before Statcast catch-up;
4. previous-day settlement uses exact MLB Official game-log ER;
5. persisted metrics are forecast-only MAE/RMSE/bias/correlation;
6. late-window no-write probe passed with zero retroactive Sep18 freeze rows.

Current gates:

- `PA12_ER_FORWARD_V2_POINT_SHADOW_READY = YES`;
- probability layer authorized: **NO**;
- market recommendation authorized: **NO**;
- production eligible: **NO**;
- retuning authorized: **NO**.

### Immediate continuation pointer after 2026-09-18

1. Let the existing daily jobs collect the next valid Run Line fixed-clock prospective freeze.
2. Let PA-12 ER V2 settle the Sep18 23-point-forecast pilot only after exact final outcomes exist; do not retune from one day.
3. Accumulate multiple fixed-clock PA-12 ER shadow days before any probability calibration proposal.
4. Preserve PA-13 forward prices for future exact model/quote research joins; historical economics remain absent.
5. Keep Pitcher K V2 training closed until materially new evidence changes corpus sufficiency.
6. Do not modify Official Picks or activate APOSTAR.

This file is the canonical continuity document for the MLB modeling experiment. Future chats/agents should read this file **before making changes** so the experiment is not restarted, reinterpreted, or contaminated by accidental use of test data.

---

## 1. Research objective

Build a production-quality MLB prediction/data platform that can eventually support multiple betting markets. The current methodology began with Moneyline and is now being expanded to **Run Line / Spread first, then Game Totals (Over/Under), then player props**.

The user’s stated goal is not merely to fit one model. We want to search many plausible formulas and submodels, preserve only those with evidence, and identify **high-accuracy selective plays** inside each market. Coverage can be selective if accuracy is materially better. The long-term target is broad market coverage by combining strong market-specific models rather than forcing every game into one recommendation.

Core philosophy:

1. Use the full 2025 regular season to develop formulas.
2. Freeze candidate formulas before using 2026 as external evaluation.
3. Search alternative architectures/segments when sample sizes support them.
4. Preserve interpretable weights/components wherever practical.
5. Separate predictive pregame information from diagnostic same-game information.
6. Never use final score, winner, final runs, RBI, or other postgame labels as pregame inputs.
7. New completed games should append to canonical storage so the dataset improves continuously; no need to repeatedly redownload Savant CSV files if canonical ingestion is functioning.

---

## 2. Critical guardrails

### 2.1 Canonical project

Use only this Supabase project for this research:

`ynuocvexviorgdjrfthw`

Do not use the unrelated Smart Shopping Supabase project.

### 2.2 Moneyline experiment integrity

Do not overwrite or destroy existing Moneyline research tables while developing Run Line or Totals. New markets should be new versioned research paths/tables.

### 2.3 Pregame vs FULL

Two branches exist:

- `PREGAME` / more precisely `PREGAME_RECONSTRUCTED`: features that could plausibly have been known before the game, reconstructed historically from canonical data.
- `FULL`: same-game process diagnostics, used only to learn which processes are associated with winning. FULL is **not deployable as pregame prediction**.

Important rigor note: historical actual starters and first-nine lineups are known retrospectively. They are reasonable pregame-compatible inputs, but this is not the same as having timestamp-proven archival pregame lineup evidence for every old game. Do not oversell this as perfect historical timestamp integrity.

### 2.4 2026 contamination rule

Pure 2025→2026 research candidates must be fit/selected using 2025 only. Then evaluate on 2026.

Some separate adaptive 2026 models already exist and are explicitly labeled adaptive; they must not be confused with pure 2025→2026 holdout models.

### 2.5 Official Picks / betting activation

Do not modify Official Picks or activate APOSTAR without explicit user authorization.

---

## 3. Current canonical cross-year data

The preferred Moneyline experiment source is a cross-year reconstruction using **the same Statcast-based definitions for both 2025 and 2026**, avoiding an artificial 2025 advantage from using a different source such as Retrosheet.

### 3.1 Current counts

As verified on 2026-09-16:

- 2025 cross-year games: **2,430**
- 2026 cross-year games: **2,270**
- latest 2026 Statcast game date currently present: **2026-09-15**
- `mlb_ml_formula_search_v1` currently contains **29** registered formulas/candidates

The 2026 count grows as new games are ingested.

### 3.2 Cross-year game/team tables

- `mlb_ml_xyear_game_v1`
- `mlb_ml_xyear_team_game_v1`
- `mlb_ml_xyear_team_batting_game_v1`
- `mlb_ml_xyear_team_statcast_game_v1`

### 3.3 Cross-year player/process helpers

- `mlb_ml_xyear_pitcher_game_v1`
- `mlb_ml_xyear_team_hand_game_v1`
- `mlb_ml_xyear_pitcher_pitchtype_game_v1`
- `mlb_ml_xyear_team_pitchtype_game_v1`
- `mlb_ml_xyear_batter_game_v1`
- `mlb_ml_xyear_lineup_v1`
- `mlb_ml_xyear_errors_game_v1`

### 3.4 Main feature tables

- `mlb_ml_xyear_features_v1`
- `mlb_ml_xyear_fullgame_v1`

### 3.5 Normalization / scoring tables

- `mlb_ml_xyear_feature_stats_v1`
- `mlb_ml_xyear_feature_values_v1`
- `mlb_ml_xyear_component_scores_v1`
- `mlb_ml_xyear_game_components_v1`
- `mlb_ml_xyear_component_stats_v1`
- `mlb_ml_xyear_game_components_z_v1`

All normalization statistics for the pure cross-year experiment were built from **2025 only**.

### 3.6 Formula registry

- `mlb_ml_formula_search_v1`

This is the research registry for frozen/tested formulas. Preserve it and append new candidates with clear provenance.

---

## 4. Existing Moneyline component architecture

Use `mlb_ml_component_map_v2` rather than manually rebuilding mappings.

### PREGAME components (10)

1. `team_strength`
2. `recent_form`
3. `offense`
4. `starter`
5. `bullpen`
6. `lineup_matchup`
7. `home_away`
8. `history`
9. `fatigue_travel`
10. `defense_context`

### FULL diagnostic components (adds 5)

11. `actual_offense`
12. `actual_contact`
13. `actual_starter`
14. `actual_bullpen`
15. `actual_defense`

The FULL branch deliberately excludes final runs/final score/RBI as model inputs. `actual_winner` is only the label.

---

## 5. Important Moneyline findings so far

### 5.1 Individual PREGAME components — previously measured 2025 → 2026

Approximate accuracies from the cross-year component experiment:

- bullpen: **54.36% → 53.35%**
- recent_form: **53.74% → 50.95%**
- team_strength: **53.42% → 53.17%**
- defense_context: **53.00% → 51.93%**
- starter: **52.55% → 55.48%**
- history: **52.47% → 53.97%**
- home_away: **52.26% → 51.66%**
- offense: **51.77% → 51.09%**
- lineup_matchup: **51.69% → 52.06%**
- fatigue_travel: **48.44% → 48.69%**

Key interpretation: `starter` and `history` were among the more encouraging out-of-sample components. `recent_form` did not transfer well by itself.

### 5.2 FULL diagnostic components — highly informative but not deployable pregame

Previously observed 2025 → 2026:

- `actual_offense`: about **79.8% → 79.4%**
- `actual_bullpen`: about **70.0% → 71.0%**
- `actual_starter`: about **69.5% → 69.1%**
- `actual_contact`: about **65.5% → 63.0%**
- `actual_defense`: about **48.9% → 49.3%**

This strongly suggests the pregame modeling challenge is predicting future offensive, starter, bullpen and contact-game processes better. These FULL percentages are **not** pregame betting model accuracies.

---

## 6. Moneyline formula search already preserved in registry

The registry currently contains 29 candidates. Important entries include:

### Pure / 2025-developed examples

- `pregame_global_stable_v1`
  - 2025 acc ~55.88%
  - stability-oriented
  - `(team_strength + recent_form + home_away + defense_context)/4`
  - home threshold `>= -0.36`

- `pregame_global_subset_bias_v1`
  - 2025 acc ~56.50%
  - `(team_strength + recent_form + defense_context)/3`
  - home threshold `>= -0.36`

- `pregame_day_v1`
  - day games, 2025 acc ~56.71%, n=917
  - `(starter + lineup_matchup)/2`, threshold `-0.08`

- `pregame_night_v1`
  - night games, 2025 acc ~57.57%, n=1513
  - `(recent_form + home_away + history + defense_context)/4`, threshold `-0.20`

- starter-hand matchup formulas for L/L, L/R, R/L, R/R

- season phase formulas: EARLY / MID / LATE

- `pregame_dayhand_hybrid_v1`
  - 2025 combined acc ~59.96%

- `pregame_phasehand_hybrid_v1`
  - 2025 combined acc ~60.37%

- `pregame_ensemble_v1`
  - 2025 combined acc ~60.91%

- `pregame_phase_day_hand_hybrid_v1`
  - 2025 combined acc ~61.56% (1496/2430)

- `full_global_v1`
  - FULL diagnostic only
  - 2025 acc ~80.53%
  - `0.70*actual_offense + 0.10*actual_starter + 0.20*actual_bullpen`, threshold `-0.14`

### Adaptive 2026 research entries — keep conceptually separate

- `pregame_adaptive_elo_starter_defense_v1`
  - adaptive 2026 model, not pure 2025→2026 holdout

- `pregame_champion_starter_teamprior_v2`
  - adaptive 2026 champion-style research path
  - full 2026 previously logged around 57.38%; final historical holdout in its own experiment 61.78%

### High-confidence selective Moneyline rules

These are especially important to preserve because they demonstrate the user’s desired strategy: lower coverage, higher accuracy.

- `pregame_high_conf_home_v1`
  - selective HOME-only rule
  - full selected set previously logged **63/81 = 77.78%**
  - historical untouched final holdout **17/20 = 85%**

- `pregame_high_conf_home_v2`
  - high-confidence HOME union
  - full selected set previously logged **80/102 = 78.43%**
  - historical final holdout **17/21 = 80.95%**
  - development folds all met ~75%+ criteria
  - no symmetric AWAY rule met the same stability standard at that time

These selective rules are valuable proof-of-concept: the system does not need to predict every game if it can identify a small subset with meaningfully better reliability.

---

## 7. Important feature-engineering details

Historical rolling features enforce `game_date < current_game_date`, meaning game 2 of a same-day doubleheader does not use game 1 as prior rolling history.

Examples already reconstructed include:

- prior team win pct
- run differential/game
- Pythagorean win pct (exponent ~1.83)
- L5/L10 win pct and run differential
- home/away splits
- rest days
- games in last 7 days
- errors/game
- park historical home win rate
- road-trip game number
- travel miles in prior 48h
- timezone changes
- OPS proxy
- K%
- hard-hit%, barrel%
- split vs opposing starter hand
- lineup prior performance
- starter RA9, WHIP, K%, BB%, whiff, hard-hit
- starter L5 metrics
- bullpen RA9/WHIP/K%/BB%
- bullpen L7 RA9
- bullpen workload prior 2d
- starter-vs-opponent history
- head-to-head history
- common-opponent history
- simplified pitch-arsenal matchup

NULL historical values are generally neutralized in standardized scoring (z≈0) rather than automatically interpreted as favorable/unfavorable.

---

## 8. Day/night, travel, venue caveat

A modal team-home-venue map exists:

- `mlb_ml_team_venue_map_v1`
- venue geo source: `mlb_ml_venue_geo_2025_v3`

2026 day/night was reconstructed from scheduled time converted using venue UTC offset, with a simple local-time threshold. Special-site games may inherit the club’s modal home venue and therefore should be treated cautiously for exact travel/day-night segmentation.

Do not build fragile stadium-specific models from tiny samples without shrinkage/validation.

---

## 9. Odds / market data currently present

This is now the immediate expansion path.

### 9.1 Existing historical/current odds storage

` sports_odds_snapshots ` currently contains a large historical odds archive across sports. For MLB specifically, as verified 2026-09-16, it contains 2026 records approximately through 2026-09-10 for:

- `moneyline`: ~482,898 rows
- `total`: ~482,120 rows
- `run_line`: ~477,358 rows
- legacy/alternate `spread`: ~1,464 rows

The key point: **2026 already has substantial Run Line and Total market history.**

Relevant tables:

- `sports_odds_snapshots`
- `odds`
- `pick2_mlb_market_event_mappings`
- `pick2_mlb_market_price_observations`
- `pick2_mlb_market_value_evaluations`
- `pick2_mlb_odds_operational_requests`

### 9.2 Existing Run Line research table

- `mlb_runline_market_2026_v1`

Verified state on 2026-09-16:

- **1,883** rows/games
- date range **2026-03-26 through 2026-09-10**

Columns:

- `game_pk`
- `game_date`
- `home_line`
- `away_line`
- `home_price_avg`
- `away_price_avg`
- `books`
- `last_snapshot_at`
- `created_at`

This means Run Line work is **not starting from zero**. The next chat must inspect this table before recreating any equivalent structure.

### 9.3 Market modeling support tables already present

- `mlb_ml_market_model_runs_v1`
- `mlb_ml_market_model_weights_v1`

Inspect existing rows before adding new market experiments.

---

## 10. Immediate NEXT ACTION — Backfill Run Line, then Totals

This is the exact next research phase.

### Step A — inventory existing coverage before spending API credits

1. Inspect all existing 2025 and 2026 MLB rows in:
   - `sports_odds_snapshots`
   - `odds`
   - `pick2_mlb_market_price_observations`
2. Determine exactly how much 2025 Run Line and Totals history already exists.
3. Inspect any existing historical Odds API importer in the repo or connected infrastructure before writing a new one.
4. Estimate gaps by date/game/market.
5. Only call paid historical Odds API endpoints for missing coverage.

The user has subscriptions/resources including BallDontLie and The Odds API. Do not assume either contains a particular 2025 historical market until verified. Prefer canonical stored snapshots if already present.

### Step B — backfill raw market snapshots, not only averaged rows

For Run Line first, preserve the raw bookmaker/time snapshots if available so later research can test:

- opening line
- closing line
- consensus line
- book-specific line
- line movement
- price/vig

Do not throw away raw history and retain only a final average.

For game-level modeling, a canonical derived table can then select a documented snapshot policy (for example closing consensus or a fixed pregame time). The policy must be versioned.

### Step C — create Run Line labels correctly

Run Line outcome is not simply Moneyline winner.

Typical MLB line is ±1.5, but use the actual market line stored for that game/side.

For a home-side line `L_home`, the home bet covers if:

`home_final_runs + L_home > away_final_runs`

Push if equal, when the market/line allows it. Away side is analogous.

The model target should match the actual offered side/line, and price must remain separate from the event probability.

### Step D — build 2025 training + 2026 external evaluation

Once 2025 Run Line odds are adequately backfilled:

- construct a cross-year Run Line research table aligned to canonical game_pk/game_date
- derive pregame features from the existing MLB feature platform rather than rebuilding everything
- develop/search models using 2025 only
- freeze candidates
- evaluate on 2026

Search both full-coverage and high-confidence selective rules.

### Step E — Run Line candidate families

At minimum test:

- global formula
- starter-weighted formula
- offense + bullpen formula
- team-strength + run-differential/Pythagorean formula
- home/away bias/intercept
- day/night segmentation
- starter handedness combinations
- season phase
- favorite/underdog status (using only pregame market information)
- line bucket (+1.5/-1.5 and any alternate lines with sufficient sample)
- price bucket / implied probability bucket
- confidence/margin thresholds
- ensembles of independently stable submodels

Also test whether the high-confidence Moneyline HOME logic transfers to favorite -1.5 or underdog +1.5 contexts, but treat that as a hypothesis, not an assumption.

### Step F — then repeat the framework for Totals

Totals target should be Over/Under relative to the actual offered total line.

Key additional features to emphasize:

- starter run prevention
- bullpen run prevention/workload
- team offense and split offense
- park context
- weather if historically available/reliable
- lineup quality
- contact quality
- strikeout/walk profile
- opposing pitcher arsenal matchup
- recent scoring environment only if validated
- total-line bucket (e.g. 7.0, 7.5, 8.0, 8.5, etc.)
- price/vig

Do not use final total runs as an input; it is only the target.

---

## 11. Recommended formula-search methodology for every new market

The Moneyline experiment established the research discipline that should be reused.

### Development set

Use all available 2025 regular-season games with valid market data.

### Internal 2025 validation

Use chronological/monthly/expanding-window validation to avoid selecting formulas that only fit one period.

Track at minimum:

- raw 2025 accuracy
- monthly/temporal accuracy
- worst-period accuracy
- standard deviation across periods
- selected-game count / coverage

### Candidate search

Test:

- equal-weight subsets
- signed/continuous weights
- thresholds/intercepts
- regularized logistic/ridge models
- direct 0/1 accuracy search when appropriate
- segment routers
- majority/weighted ensembles
- high-confidence selective filters

Avoid tiny-segment winners unless there is enough sample and temporal stability. Use fallback/global rules for small segments.

### Freeze, then test

Once architecture/weights/thresholds are selected using 2025, freeze them. Then evaluate on 2026.

Report:

- correct / incorrect
- accuracy
- sample size
- coverage
- lift versus a simple baseline
- temporal stability
- confidence-bin performance
- for betting research, probability vs implied probability and EV only after predictive calibration is established

### Important distinction

A formula that covers only 4–5% of games can still be highly valuable if it is stable at >75% accuracy. The user explicitly accepts selective coverage because other markets will later add additional high-quality opportunities.

---

## 12. Daily ingestion vision

Long-term workflow:

1. MLB/Statcast/canonical game ingestion adds newly completed games and process stats daily.
2. Odds ingestion archives pregame market snapshots daily for Moneyline, Run Line, Totals and later props.
3. Feature pipelines append/update new game rows.
4. Frozen production research formulas score upcoming games using only available pregame information.
5. Completed outcomes are later joined for evaluation and retraining research.

The goal is that new data accumulates automatically in canonical storage. Manual Savant downloads should become unnecessary except as a recovery/fallback source.

---

## 13. What NOT to do in the next chat

- Do not restart the Moneyline experiment from scratch.
- Do not rebuild all Statcast tables unnecessarily.
- Do not recreate `mlb_runline_market_2026_v1` without first inspecting it.
- Do not spend historical Odds API credits before measuring what is already stored.
- Do not choose a 2025→2026 formula because it looked best on 2026.
- Do not mix adaptive 2026 models with pure 2025-trained holdout models without explicit labels.
- Do not use FULL same-game process values as if they were pregame inputs.
- Do not use final score/runs/winner/RBI as features.
- Do not allow second-game doubleheader rolling features to see same-day game 1 unless a separate live/sequential model is explicitly designed.
- Do not touch Official Picks / APOSTAR without explicit authorization.

---

## 14. Suggested continuation order

1. Read this entire handoff.
2. Verify current `main` HEAD and recent changes in `pick-analyzer`.
3. Verify Supabase state; never assume the counts in this document have not grown.
4. Inspect 2025 coverage for Run Line and Totals in existing odds tables.
5. Locate/reuse any existing historical odds import path if present.
6. Backfill only the missing 2025 Run Line history.
7. Build canonical 2025 Run Line training dataset + 2026 evaluation dataset.
8. Run broad formula/segment/high-confidence search using the same research discipline as Moneyline.
9. Freeze Run Line candidates and evaluate 2026.
10. Repeat for Totals.
11. Only after team markets are stable, expand to player props.

---

## 15. Continuation prompt for a new ChatGPT chat

A future chat should be told explicitly to read this file and execute, not just provide a plan. The user can paste the prompt supplied in the originating chat.

**Canonical handoff path:**

`docs/research/MLB_MODEL_RESEARCH_HANDOFF.md`

<!-- RUNLINE_RESEARCH_STATE_START -->

---

## MLB Run Line / Spread research — canonical state (2026-09-16)

This section supersedes earlier Run Line next-step instructions in this handoff. Do **not** restart the 2025 market backfill or retune the frozen V1 candidate IDs against 2026.

### Guardrails

- Research-only / shadow-only.
- Official Picks remains untouched.
- `APOSTAR` remains disabled.
- No production promotion without an explicit gate.
- FULL remains diagnostic only and is not a pregame feature source.
- No final score/result/postgame field is used as a predictive feature.
- Adaptive 2026 work remains separate from the pure 2025→2026 experiment.

### 2025 Run Line market coverage — COMPLETE

Certified canonical coverage:

- target games: **2,430**
- covered games: **2,430 / 2,430 = 100.0000%**
- missing games: **0**
- games with both sides: **2,430**
- games missing a side: **0**
- canonical market policy: `MLB_RUNLINE_MARKET_2025_V1_OPENING_PAIRED_MODAL_SOURCE_PRECEDENCE`
- historical Odds API credits consumed for this backfill: **0**

Primary historical provenance remains in the existing lineage infrastructure:

- `historical_source_registry`
- `historical_raw_records`

Primary source layers used:

1. `sportsbookreview_via_arnavsaraogi_dataset`
2. `sportsbookreview_direct_scrape`
3. `sportsbookreview_multigame_retry`
4. `sportsbookreview_athletics_runline_v2`
5. `public_web_pregame_runline`
6. `public_web_pregame_runline_zero_fix`

Do not replace the explicit schedule/identity exceptions with general fuzzy date matching.

### 2025 development matrix and baseline

Canonical matrix:

- `mlb_runline_model_matrix_2025_v1`
- rows/games: **2,430**
- feature policy: 10 PREGAME components only
- no missing day/night, starter handedness, or model inputs

Components:

1. `team_strength`
2. `recent_form`
3. `offense`
4. `starter`
5. `bullpen`
6. `lineup_matchup`
7. `home_away`
8. `history`
9. `fatigue_travel`
10. `defense_context`

2025 +1.5 dog-side baseline:

- cover rate: **60.864%**
- average de-vigged market probability: **57.630%**

Frozen market normalization:

- `market_mu_2025 = 0.57629591863738`
- `market_sd_2025 = 0.0754955595992703`
- `market_z = (market_p_dog - market_mu_2025) / market_sd_2025`

### Internal 2025 holdout attempt — FAILED and closed

The earlier Mar-Jul / Aug / Sep protocol failed on September and must not be retuned against that holdout. Those candidates remain historical failed artifacts.

### Full-2025 score search

Canonical score grid table is:

- `mlb_runline_cv_score_grid_2025_v1`
- rows: **153,090**
- games: **2,430**
- masks: **63**
- temporal folds: **5**

### Four V1 candidates frozen before opening 2026

Registry table:

- `mlb_runline_formula_search_v1`

All four were frozen before the external 2026 outcome read and their formulas/thresholds are immutable:

1. `rl_2025_precision_b_v1`
   - B = `AWAY|L/R`
   - score = `(market_z + bullpen + defense_context) / sqrt(3)`
   - threshold = `0.389557831270198`
   - 2025: **50 picks / 80.00%**
2. `rl_2025_stability_c_v1`
   - C = `R/R` and `0.54 <= market_p_dog < 0.58`
   - score = `(starter + bullpen + home_away) / sqrt(3)`
   - threshold = `-0.061850283368138`
   - 2025: **47 / 76.5957%**
3. `rl_2025_balanced_bcd_v1`
   - union B + C + D
   - 2025: **151 / 77.4834%**
4. `rl_2025_broad_abcd_v1`
   - union A + B + C + D
   - 2025: **191 / 76.4398%**

A = `L/R`, `(market_z + history + defense_context)/sqrt(3) >= 0.620506754592367`  
D = `night` and `0.58 <= market_p_dog < 0.62`, `(starter + bullpen + defense_context)/sqrt(3) >= 0.482069880404807`

A reproducibility audit re-applied the frozen formulas to the 2025 matrix and reproduced all four exact n/accuracy values with no discrepancy before accepting the external test state.

### Pure external 2026 evaluation — SEALED, SINGLE READ, FAILED

External market/matrix path:

- `mlb_runline_market_2026_opening_proxy_v1`
- `mlb_runline_model_matrix_2026_opening_proxy_v1`
- `mlb_runline_external_test_ledger_v1`
- test id: `RUNLINE_2026_EXTERNAL_V1_SINGLE_SEALED`

Market policy:

- `MLB_RUNLINE_MARKET_2026_V1_EARLIEST_CAPTURED_PAIRED_MODAL_PROXY`

Feature policy:

- `MLB_RUNLINE_FEATURES_2026_V1_PREGAME_DOG_ORIENTED_2025_FROZEN_COMPONENTS`

External matrix audit:

- games: **1,883**
- date range: **2026-03-26 → 2026-09-10**
- standard ±1.5 paired games: **1,883 / 1,883**
- missing day/night: **0**
- missing starter hands: **0**
- all 10 Run Line components match the canonical cross-year `PREGAME` 2025-frozen component layer exactly after dog-side orientation (`max absolute difference = 0` for every component)
- `team_prior` exists physically in the matrix but was **not used by any of the four frozen V1 formulas**
- exact historical opening flags are unavailable for this archive; all 1,883 rows use the earliest captured complete paired pregame quote proxy, not a fabricated exact opening

The single external outcome read was sealed in `mlb_runline_external_test_ledger_v1`; do not rerun it as if 2026 were unseen.

External results:

| Candidate | n 2026 | Accuracy 2026 | Coverage | 95% Wilson CI |
|---|---:|---:|---:|---:|
| `rl_2025_precision_b_v1` | 55 | 58.1818% | 2.9209% | 45.03%–70.26% |
| `rl_2025_stability_c_v1` | 14 | 64.2857% | 0.7435% | 38.76%–83.66% |
| `rl_2025_balanced_bcd_v1` | 115 | 57.3913% | 6.1073% | 48.26%–66.05% |
| `rl_2025_broad_abcd_v1` | 145 | 57.9310% | 7.7005% | 49.79%–65.66% |

2026 external baselines on the same matrix:

- overall +1.5 dog cover rate: **57.9395%**
- average de-vigged dog market probability: **58.7925%**

Selected-pick average market probability comparison:

- Precision B: accuracy **58.18%** vs selected market p **61.53%**
- Stability C: accuracy **64.29%** vs selected market p **56.32%**, but only **n=14**
- Balanced BCD: accuracy **57.39%** vs selected market p **60.47%**
- Broad ABCD: accuracy **57.93%** vs selected market p **60.56%**

ROI is **not certified** from this external test because the archive path is an earliest-captured paired proxy/consensus path rather than a verified single executable sportsbook price for every selection. Do not invent ROI.

All four V1 candidates are now explicitly:

- `FAILED_2026_EXTERNAL_HOLDOUT`

Do not change their formulas, thresholds, segments, or IDs.

### Transfer diagnosis

The individual frozen rules also degraded:

- A: **79.41% (n=68) in 2025 → 60.00% (n=60) in 2026**
- B: **80.00% (n=50) → 58.18% (n=55)**
- C: **76.60% (n=47) → 64.29% (n=14)**
- D: **78.33% (n=60) → 54.00% (n=50)**

For A, B and D, mean selected scores were not lower in 2026; they were slightly higher. Therefore the failure is not explained by a simple threshold becoming too permissive. The score-to-cover relationship/calibration did not transfer cleanly. C retained a positive point estimate over market probability but collapsed to only 14 selections and has very wide uncertainty.

Home/away diagnostics also show instability: Balanced BCD was 78.95% on 19 HOME-dog selections but 53.13% on 96 AWAY-dog selections; Broad ABCD was 66.67% on 36 HOME-dog selections and 55.05% on 109 AWAY-dog selections. These are post-holdout diagnostics only, not permission to retune V1.

### V2 research family — OPEN, NOT FROZEN

A separate registry entry now exists:

- `rl_v2_transfer_research_family_v1`
- family: `runline_transfer_v2`
- status: `V2_RESEARCH_OPEN_NOT_FROZEN`

This V2 route is explicitly 2026-informed and therefore must never be presented as the untouched 2025→2026 test.

Initial V2 research questions:

1. model/calibrate **residual edge over market probability** instead of only raw cover score;
2. test probability calibration rather than raw score quantile thresholds;
3. diagnose handedness/dog-side interactions with adequate minimum sample requirements;
4. require month/time stability before freezing any V2 candidate;
5. use a genuinely future, untouched forward window for any V2 certification.

No V2 candidate formula is frozen yet. No V2 production promotion exists.

### NEXT ACTION

Stay on Run Line. Do **not** start Game Totals yet.

Continue V2 research-only diagnostics and candidate development under new IDs. Before any V2 certification, define and preserve a future untouched forward evaluation window. Official Picks remains untouched and `APOSTAR` remains disabled.

<!-- RUNLINE_RESEARCH_STATE_END -->
