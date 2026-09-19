# MLB First 7 Innings Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

2025 target remains the previously certified F7 score:

- mapped games: 2,430;
- exact Statcast/Retrosheet F7 matches: 2,418;
- one-run mismatches excluded fail-closed: 12;
- exact-match rate: 99.51%.

2026 uses Statcast F7 score through the historical development boundary.

The current stored Statcast rows for 2026-09-15 through 2026-09-17 contained 39 games with null post-inning scores. Those rows were excluded fail-closed as `TARGET_UNAVAILABLE`; they were not treated as pushes.

Usable development surface:

- 2025: 2,418 games;
- 2026: 2,255 games;
- total: 4,673 games;
- rolling OOF: 4,142 games;
- rolling OOF non-push: 3,688;
- 2025 pushes: 271;
- 2026 pushes: 236;
- actual max target date used: 2026-09-14.

## Architectures tested

The second pass materially changed the first-pass architecture.

Tested:

- CatBoost binary HOME-vs-AWAY probability ensemble;
- HOME-only and AWAY-only confidence filters;
- symmetric confidence selection;
- prior run-differential sign agreement;
- CatBoost regression of F7 run margin;
- classifier + predicted-margin agreement;
- original first-pass q95 run-differential rule as benchmark.

All folds were chronological and all features came from the frozen PREGAME feature surface. Pushes were excluded from event accuracy.

## Gate-selected fallback

Research identifier:

`f7_ml_revisit_home_p058_fallback_v1`

Rule:

- architecture: CatBoost probability ensemble;
- selection: HOME only;
- select when predicted HOME F7 win probability >= 0.58.

Rolling evidence:

- correct: **746 / 1,281**;
- accuracy: **58.24%**;
- selected including pushes: 1,451;
- pushes: 170;
- non-push coverage: **34.73%**;
- months with non-push selections: 11;
- minimum monthly n: 39;
- worst month: **54.03%**;
- unconditional majority baseline: **52.74%**;
- lift: **+5.50 pts**.

It does not satisfy the frozen worst-month >=65% gate and is not forward eligible.

## Highest pooled-accuracy candidate

The highest pooled candidate among sample-eligible second-pass formulas was:

- architecture: classifier + F7 margin agreement;
- probability threshold: 0.675;
- predicted absolute margin threshold: 1.5 runs;
- correct: **120 / 181**;
- accuracy: **66.30%**;
- worst month: **41.67%**;
- minimum monthly n: 1;
- coverage vs non-push OOF: **4.91%**.

It is substantially below 75% and unstable across months.

## Original q95 benchmark on unified OOF

The original `f7_ml_run_diff_extreme_q95_v1` rule produced:

- **95 / 144 = 65.97%**;
- pushes: 15;
- worst month: **44.44%**;
- months with selections: 8.

This confirms that its 2025 performance did not generalize under the unified 2025+2026 rolling surface.

## Closeout

State:

`REVISIT_SECOND_PASS_BELOW_75`

No F7 Moneyline candidate is frozen for prospective validation.

- `forward_eligible=false`;
- 2026-09-19 remains quarantined;
- 2026-09-20+ forward outcomes were not opened or used;
- Official Picks writes: 0;
- APOSTAR: disabled;
- production promotion: none;
- historical Odds API credits consumed: 0.

Preserve this result and move to the next `REVISIT_AFTER_FIRST_PASS` market.
