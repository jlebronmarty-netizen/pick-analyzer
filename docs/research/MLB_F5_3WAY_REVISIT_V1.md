# MLB First 5 Innings 3-Way Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

The target is HOME / AWAY / DRAW from the certified fail-closed F5 score corpus.

- 2025: 2,423 games;
- 2026: 2,255 games;
- total source rows: 4,678;
- class counts: HOME 2,122 / AWAY 1,823 / DRAW 733;
- rolling OOF: 4,147;
- actual max target date used: 2026-09-14.

2025 retains the exact Statcast/Retrosheet parity gate; the seven known mismatches remain excluded.

## Architectures tested

- CatBoost multiclass HOME/DRAW/AWAY probability ensemble;
- side-only confidence filters;
- draw-only confidence filters;
- F5 run-margin regression;
- multiclass + margin side agreement;
- draw confidence + near-zero predicted margin;
- original first-pass side rule as benchmark.

All folds were chronological and used PREGAME features only.

## Preserved fallback

Research identifier:

`f5_3way_revisit_side_margin_p045_m050_fallback_v1`

Rule:

- multiclass confidence >=0.45;
- predicted class must be HOME or AWAY;
- absolute predicted F5 run margin >=0.50;
- classifier side and margin side must agree.

Rolling OOF:

- correct: **644 / 1,298**;
- accuracy: **49.61%**;
- coverage: **31.30%**;
- 11 months;
- minimum monthly n: **67**;
- worst month: **44.95%**;
- unconditional majority baseline: **45.02%**;
- lift: **+4.59 pts**.

## Original side-rule benchmark

The original F5 3-Way side rule produced on unified OOF:

- **75 / 132 = 56.82%**;
- worst month **39.29%**;
- minimum monthly n **2**.

It remains higher pooled accuracy than the stable fallback, but is temporally unstable and well below target.

## Closeout

No second-pass candidate reached the frozen 75% gate.

State: `REVISIT_SECOND_PASS_BELOW_75`.

- forward eligible: false;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- no prospective threshold rescue is allowed.

Official Picks writes: 0.  
APOSTAR: disabled.  
Production promotion: none.  
Historical Odds API credits consumed: 0.

The temporary exporter was closed after the bounded run.
