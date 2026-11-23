# MLB Batter Strikeouts 0.5 YES — Opportunity V1

Status: **RESEARCH-ONLY / FROZEN BEFORE 2026 OOS**

## Exact contract

- Market: Batter Strikeouts
- Exact line: 0.5
- Side token: **YES**
- YES is not aliased to OVER in market matching.
- Settlement target: batter records >0.5 strikeouts.

## New architecture

This is not the prior projection-threshold O0.5 architecture that failed 2026 at 74.37%.

The new rule uses strict-prior opportunity rates only:

- prior K / PA >= **0.30**
- prior PA / game >= **3.75**
- minimum 10 prior games
- all history must satisfy `source_game_date < target_game_date`
- same-date history is forbidden; Game 1 of a doubleheader cannot enter Game 2.

## 2025 development

Frozen grid:
- K/PA: 0.18, 0.22, 0.26, 0.30, 0.34
- PA/game: 3.25, 3.50, 3.75, 4.00, 4.25

Gate:
- n >= 60
- accuracy >= 75%
- lift >= 5 pp
- >=5 months
- worst month >=65%

Champion policy: maximum n among passing thresholds.

Frozen champion:
- K/PA >= 0.30
- PA/game >= 3.75
- 958 / 1,270 = **75.43%**
- baseline = 58.81%
- lift = **+16.62 pp**
- worst month = **72.43%**
- minimum month n = 219

Batter K 1.5 YES produced zero passing thresholds and is closed.

The 0.5 YES threshold is frozen before opening 2026.

## Boundaries

- no YES/OVER aliasing
- no threshold rescue after 2026
- no same-date/doubleheader leakage
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
- no production promotion

## Untouched 2026 OOS

The frozen 2025 rule was applied once with no threshold changes:

- 1,304 / 1,732 = **75.29%**
- baseline = 56.57%
- lift = **+18.72 pp**
- May 75.18%
- Jun 82.61%
- Jul 77.91%
- Aug 75.46%
- Sep **63.57%**

The pooled accuracy passes 75%, but September is below the permanent 65% worst-month stability gate.

State:

`EXTERNAL_75_PLUS_STABILITY_FAIL_NO_RETUNE`

No threshold rescue is authorized.
