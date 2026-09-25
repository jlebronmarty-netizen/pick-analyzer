# MLB Batter Total Bases U1.5 — Low-Volume Architecture V1

Status: **RESEARCH-ONLY / FROZEN BEFORE 2026 OOS**

## Why this is a new architecture

The prior Total Bases U1.5 surface used the existing batter event projection and froze:

`UNDER 1.5 when projection <= 1.20`

That rule failed the untouched 2026 accuracy gate at 74.77% and remains closed. It is not retuned here.

This experiment uses a materially different input: strict-prior playing-time volume.

## Exact contract

- Market: Batter Total Bases
- Exact line: 1.5
- Side: UNDER
- Rule: prior PA/game <= **3.50**
- Minimum prior games: 10
- Prior PA/game = sum of plate appearances from games with `game_date < target_game_date` divided by the number of those prior games.
- Same-date history is forbidden. Therefore Game 1 of a doubleheader cannot enter Game 2.

## Development protocol

Only 2025 was opened for model selection.

Frozen threshold grid:
- 2.50 through 4.50
- step 0.05

Gate:
- n >= 60
- accuracy >= 75%
- lift >= 5 pp over unconditional U1.5 baseline
- >=5 months
- worst month >=65%

Champion policy:
- maximize n among passing thresholds.

## Frozen 2025 result

Unfiltered eligible baseline:
- n = 37,744
- U1.5 baseline = 66.55%

Frozen rule `prior_PA_per_game <= 3.50`:
- 7,406 / 9,813
- accuracy = **75.47%**
- lift = **+8.92 pp**
- months = 5
- worst month = **74.27%**
- minimum month n = 1,761

The threshold is frozen at 3.50 before any 2026 OOS evaluation.

## Boundaries

- exact U1.5 UNDER only
- no line extrapolation
- no threshold rescue after 2026 is opened
- no same-date/doubleheader leakage
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
- no production promotion
