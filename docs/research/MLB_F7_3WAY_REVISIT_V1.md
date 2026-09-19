# MLB First 7 Innings 3-Way Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical target surface

The target is HOME / AWAY / DRAW from the certified fail-closed F7 score corpus.

- 2025: 2,418 games;
- 2026: 2,255 games;
- total source rows: 4,673;
- class counts: HOME 2,221 / AWAY 1,945 / DRAW 507;
- rolling OOF: 4,142;
- actual max target date used: 2026-09-14.

The 2025 surface retains the exact Statcast/Retrosheet parity gate; the 12 known one-run mismatches remain excluded.

## Architectures tested

- CatBoost multiclass HOME/DRAW/AWAY probability ensemble;
- side-only confidence filters;
- draw-only confidence filters;
- F7 run-margin regression;
- multiclass + margin side agreement;
- draw confidence + near-zero predicted margin;
- original first-pass side rule as benchmark.

All folds were chronological and used PREGAME features only.

## Preserved fallback

Research identifier:

`f7_3way_revisit_side_margin_p040_m150_fallback_v1`

Rule:

- multiclass confidence >=0.40;
- selected class must be HOME or AWAY;
- absolute predicted F7 run margin >=1.50;
- classifier side and margin side must agree.

Rolling OOF:

- correct: **176 / 311**;
- accuracy: **56.59%**;
- coverage: **7.51%**;
- 11 months;
- minimum monthly n: **2**;
- worst month: **48.72%**;
- unconditional majority baseline: **46.96%**;
- lift: **+9.63 pts**.

## Original side-rule benchmark

The original F7 3-Way side rule produced on unified OOF:

- **96 / 149 = 64.43%**;
- worst month **41.18%**;
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
