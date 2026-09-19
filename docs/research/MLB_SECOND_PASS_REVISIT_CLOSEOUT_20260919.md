# MLB Model Research — Second-Pass Revisit Closeout — 2026-09-19

Status: `SECOND_PASS_COMPLETE_EXCEPT_HISTORICAL_LINE_BLOCKERS`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

Official Picks: unchanged.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed during the bounded revisits: 0.

## Executive result

The second-pass revisit program is complete for every currently researchable line-free / already-supported target in scope.

Only one market cleared the frozen development gate:

### Pitcher Record a Win

Frozen champion:

`pitcher_record_win_revisit_catboost_no_p0225_v1`

- **1,126 / 1,386 = 81.24%**;
- worst month **76.47%**;
- 11 months;
- minimum monthly n **82**;
- rolling OOF coverage **16.54%**;
- unconditional NO baseline **70.92%**;
- lift **+10.32 pts**;
- `forward_eligible=true`;
- prospective forward begins 2026-09-20;
- no prospective outcome was opened during development.

This remains research-only pending prospective forward evidence.

## Completed below-target second-pass markets

| Market | Preserved second-pass result | Accuracy | Worst month | State |
| --- | --- | ---: | ---: | --- |
| Game Totals O/U | `totals_revisit_v1_regression_over_edge_1p0_fallback` | **53.48%** (430/804) | **44.64%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 7 Innings ML | `f7_ml_revisit_home_p058_fallback_v1` | **58.24%** (746/1,281) | **54.03%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 5 Innings ML | `f5_ml_revisit_winpct_sign_p075_fallback_v1` | **67.19%** (43/64) | **64.10%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 3 Innings ML | `f3_ml_revisit_classifier_margin_p058_m075_fallback_v1` | **63.13%** (202/320) | **52.94%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 1 Inning ML | `f1_ml_revisit_classifier_margin_p0625_m050_fallback_v1` | **73.91%** (51/69) | **63.16%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 7 Innings 3-Way ML | `f7_3way_revisit_side_margin_p040_m150_fallback_v1` | **56.59%** (176/311) | **48.72%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 5 Innings 3-Way ML | `f5_3way_revisit_side_margin_p045_m050_fallback_v1` | **49.61%** (644/1,298) | **44.95%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 3 Innings 3-Way ML | `f3_3way_revisit_side_margin_p045_m075_fallback_v1` | **52.88%** (165/312) | **37.50%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 1 Inning 3-Way ML | `f1_3way_revisit_multiclass_p055_fallback_v1` | **54.37%** (846/1,556) | **47.92%** | `REVISIT_SECOND_PASS_BELOW_75` |
| First 1 Inning NRFI / YRFI | `f1_nrfi_revisit_both_starters_075_min3_fallback_v1` | **54.07%** (399/738) | **47.95%** | `REVISIT_SECOND_PASS_BELOW_75` |

## Closest miss

First 1 Inning Moneyline was the closest below-target market:

- **51/69 = 73.91%**;
- lift vs unconditional majority baseline **+18.37 pts**;
- but worst month **63.16%**, below the frozen 65% stability floor;
- therefore it is not forward eligible.

No threshold or architecture may be altered using prospective results to rescue this candidate.

## Historical-line blockers

The following markets are not valid candidates for a price/line-aware second-pass evaluation until exact historical sportsbook points are available:

- First 3 Innings Totals;
- First 5 Innings Totals;
- First 7 Innings Totals;
- alternate period totals;
- period spreads / alternate period spreads where the historical point is absent;
- full-game alternate spreads / alternate totals;
- team totals / alternate team totals.

Reference-line studies (F3 2.5, F5 4.5, F7 6.5) remain diagnostic only and are not treated as historical market lines.

State:

`BLOCKED_HISTORICAL_LINE_COVERAGE`

Do not invent, infer, modal-substitute, or current-line-substitute historical points.

## Settlement blocker

Full-game MLB 3-way moneyline remains:

`BLOCKED_SETTLEMENT_SEMANTICS`

The project has no frozen MLB full-game 3-way settlement contract. Standard MLB moneyline includes extra innings and does not imply a draw outcome.

## Forward boundary

The new clean forward window begins:

`2026-09-20`

Only candidates frozen before that boundary may enter prospective validation.

Current forward-eligible second-pass candidate:

- `pitcher_record_win_revisit_catboost_no_p0225_v1`.

All below-target candidates remain closed and must not be retuned from forward outcomes.

## Next valid actions

1. Preserve all completed second-pass artifacts and formulas.
2. Begin prospective forward collection for the frozen Pitcher Record a Win champion on/after 2026-09-20.
3. Do not reinterpret 2026-09-19; it remains quarantined.
4. Reopen blocked period totals/spreads only when exact historical line coverage is obtained under a certified lineage.
5. Do not modify Official Picks or activate APOSTAR without a separate explicit production gate.
