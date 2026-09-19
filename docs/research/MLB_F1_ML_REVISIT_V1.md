# MLB First 1 Inning Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

The 2025 target preserves the previously certified score after inning 1:

- mapped games: 2,430;
- exact Statcast/Retrosheet matches: 2,428;
- one-run mismatches excluded fail-closed: 2;
- exact-match rate: 99.92%.

2026 uses complete Statcast F1 scores only. Rows without a complete score are excluded fail-closed and are never treated as pushes.

Usable surface:

- 2025: 2,428 games;
- 2026: 2,255 games;
- total source rows: 4,683;
- 2025 pushes: 1,280;
- 2026 pushes: 1,202;
- rolling OOF: 4,149 games;
- rolling OOF non-push: 1,959;
- actual max target date used: 2026-09-14.

## Architectures tested

The second pass materially changed the first-pass architecture.

Tested:

- CatBoost HOME-vs-AWAY probability ensemble;
- HOME-only / AWAY-only / symmetric confidence filters;
- CatBoost regression of F1 run margin;
- classifier + predicted-margin agreement;
- prior win-percentage sign agreement;
- original stable F1 composite rule as benchmark;
- original rejected q95 prior-win-percentage rule as benchmark.

All folds were chronological. Pushes were excluded from event accuracy.

Because the F1 outcome has many pushes, there were 215 non-push training rows before May 2025. The operational fold guard was therefore 180 non-push rows; labels, features, hyperparameters, thresholds, and certification gates were unchanged.

## Closest second-pass candidate

Research identifier:

`f1_ml_revisit_classifier_margin_p0625_m050_fallback_v1`

Rule:

- classifier confidence: p(HOME) >= 0.625 or p(HOME) <= 0.375;
- predicted absolute F1 run margin >= 0.50;
- classifier and margin-regression side must agree;
- predict the agreed HOME/AWAY side.

Rolling OOF:

- correct: **51 / 69**;
- accuracy: **73.91%**;
- selected total including pushes: 147;
- pushes: 78;
- non-push OOF coverage: **3.52%**;
- months with selections: 6;
- minimum monthly non-push n: 2;
- worst month: **63.16%**;
- unconditional majority baseline: **55.54%**;
- lift: **+18.37 pts**.

This candidate misses both the 75% accuracy target and the frozen worst-month stability floor of 65%.

## Original q95 benchmark on unified OOF

The previously rejected win-percentage extreme candidate with absolute prior win-percentage advantage >= **0.267999190778826** produced:

- **61 / 88 = 69.32%**;
- 73 pushes;
- worst month **0.00%**;
- minimum monthly n = 1.

Its earlier 2025-only 42/55 = 76.36% result does not survive unified rolling evaluation.

## Original stable composite benchmark

The original composite rule using starter RA9 advantage, offense OPS advantage, and prior win-percentage advantage produced:

- **75 / 114 = 65.79%**;
- 99 pushes;
- worst month **50.00%**.

## Closeout

No second-pass candidate reached the frozen 75% gate with acceptable stability.

State:

`REVISIT_SECOND_PASS_BELOW_75`

- forward eligible: false;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- do not threshold-rescue from prospective outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

The temporary Supabase research exporter was closed after the bounded run.
