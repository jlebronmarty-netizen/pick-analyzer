# MLB First 5 Innings Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

2025 preserves the previously certified F5 target:

- mapped games: 2,430;
- exact Statcast/Retrosheet F5 matches: 2,423;
- one-run mismatches excluded fail-closed: 7;
- exact-match rate: 99.71%.

2026 uses complete Statcast F5 scores only. Missing post-inning scores are excluded fail-closed and never treated as pushes.

Usable surface:

- 2025: 2,423 games;
- 2026: 2,255 games;
- total source rows: 4,678;
- rolling OOF: 4,147;
- rolling OOF non-push: 3,500;
- 2025 pushes: 386;
- 2026 pushes: 347;
- actual max target date used: 2026-09-14.

## Architectures tested

The second pass materially changed the first-pass architecture.

Tested:

- CatBoost HOME-vs-AWAY probability ensemble;
- HOME-only / AWAY-only / symmetric confidence filters;
- CatBoost regression of F5 run margin;
- classifier + predicted-margin agreement;
- prior win-percentage sign agreement;
- original stable F5 composite rule as benchmark.

All folds were chronological. Pushes were excluded from event accuracy.

## Closest second-pass candidate

Research identifier:

`f5_ml_revisit_winpct_sign_p075_fallback_v1`

Rule:

- model probability must be at least 0.75 for the selected side;
- model side must agree with the sign of prior home-vs-away win-percentage advantage;
- predict the agreed HOME/AWAY side.

Rolling OOF:

- correct: **43 / 64**;
- accuracy: **67.19%**;
- selected total including pushes: 77;
- pushes: 13;
- non-push coverage: **1.83%**;
- months with selections: 6;
- minimum monthly non-push n: 1;
- worst month: **64.10%**;
- unconditional majority baseline: **53.34%**;
- lift: **+13.84 pts**.

This candidate misses the 75% accuracy target and narrowly misses the frozen worst-month stability floor of 65%.

## Original composite benchmark

The original F5 composite using:

- starter RA9 advantage >=0.50;
- offense OPS proxy advantage >=0.08;
- prior win-percentage advantage >=0.05;

with symmetric inverse for AWAY produced on the unified OOF surface:

- **94 / 149 = 63.09%**;
- 24 pushes;
- worst month **40.00%**.

The original 2025-only 60/88 = 68.18% result therefore does not survive unified rolling evaluation.

## Closeout

No second-pass F5 Moneyline candidate reached the frozen 75% gate with acceptable stability.

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
