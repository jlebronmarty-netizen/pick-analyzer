# MLB First 3 Innings 3-Way Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical development surface

- 2025 certified F3 games: 2,425;
- 2026 usable F3 games: 2,255;
- total source rows: 4,680;
- rolling OOF rows: 4,148;
- outcomes: HOME 1,946 / AWAY 1,572 / DRAW 1,162;
- actual max target date used: 2026-09-14.

The 2025 target preserves the certified Statcast/Retrosheet score-after-inning-3 parity gate. 2026 uses complete Statcast F3 scores only. Missing target rows are excluded fail-closed.

## Architectures tested

- CatBoost multiclass HOME/DRAW/AWAY probability;
- HOME/AWAY-only selective classification;
- CatBoost F3 run-margin regression;
- classifier + margin-side agreement;
- draw-confidence + near-zero-margin filters;
- original first-pass F3 3-way side rule as benchmark.

All folds were chronological and all reused 2026 rows were labeled `HISTORICAL_SEEN_DEVELOPMENT`.

## Preserved second-pass fallback

Research identifier:

`f3_3way_revisit_side_margin_p045_m075_fallback_v1`

Rule:

- multiclass confidence >=0.45;
- select HOME/AWAY only;
- predicted absolute F3 margin >=0.75;
- classifier and margin side agree.

Rolling OOF:

- **165 / 312 = 52.88%**;
- coverage **7.52%**;
- 11 months represented;
- minimum monthly n **8**;
- worst month **37.50%**;
- unconditional majority baseline **41.37%**;
- lift **+11.52 pts**.

## Highest pooled candidate

The highest pooled sample-eligible second-pass candidate reached:

- **52 / 91 = 57.14%**;
- worst month **33.33%**;
- minimum monthly n **1**.

It is not stable enough for forward use.

## Original first-pass benchmark

The original F3 3-way side rule produced on unified OOF:

- **64 / 114 = 56.14%**;
- worst month **28.57%**.

The prior 2025-only 44/73 = 60.27% result did not survive unified rolling evaluation.

## Closeout

No F3 3-Way second-pass candidate reached the frozen 75% gate.

State:

`REVISIT_SECOND_PASS_BELOW_75`

- `forward_eligible=false`;
- 2026-09-19 remains quarantined;
- no 2026-09-20+ outcomes were opened;
- no threshold rescue from prospective outcomes.

## Boundaries

Official Picks writes: 0.

APOSTAR: disabled.

Production promotion: none.

Historical Odds API credits consumed: 0.

All temporary F3 3-Way research endpoints were closed after the bounded run.
