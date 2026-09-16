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
