# MLB First 1 Inning 3-Way Moneyline — Second-Pass Revisit V1

Status: `REVISIT_SECOND_PASS_BELOW_75`

Protocol: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Historical development surface

- 2025 certified F1 games: 2,428;
- 2026 usable F1 games: 2,255;
- total source rows: 4,683;
- rolling OOF rows: 4,149;
- outcomes: HOME 1,219 / AWAY 982 / DRAW 2,482;
- actual max target date used: 2026-09-14.

The 2025 target preserves the certified Statcast/Retrosheet score-after-inning-1 parity gate. 2026 uses complete Statcast F1 scores only. Missing target rows are excluded fail-closed.

## Architectures tested

- CatBoost multiclass HOME/DRAW/AWAY probability;
- HOME/AWAY-only selective classification;
- DRAW-only classification;
- CatBoost F1 run-margin regression;
- classifier + margin-side agreement;
- draw-confidence + near-zero-margin filters;
- original first-pass draw-closeness rule as benchmark.

All folds were chronological and all reused 2026 rows were labeled `HISTORICAL_SEEN_DEVELOPMENT`.

## Preserved second-pass fallback

Research identifier:

`f1_3way_revisit_multiclass_p055_fallback_v1`

Rule:

- multiclass maximum class probability >=0.55;
- emit the highest-probability HOME / DRAW / AWAY class.

Rolling OOF:

- **846 / 1,556 = 54.37%**;
- coverage **37.50%**;
- 11 months represented;
- minimum monthly n **75**;
- worst month **47.92%**;
- unconditional majority baseline **52.78%**;
- lift **+1.59 pts**.

The selected truth mix was DRAW-heavy, consistent with the high first-inning draw rate.

## Highest pooled benchmark

The original first-pass draw-closeness rule was the highest pooled sample-eligible formula:

- **284 / 506 = 56.13%**;
- worst month **45.61%**;
- minimum monthly n **18**.

It remains well below the 75% target.

## Closeout

No F1 3-Way second-pass candidate reached the frozen 75% gate.

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

All temporary F1 3-Way research endpoints were closed after the bounded run.
