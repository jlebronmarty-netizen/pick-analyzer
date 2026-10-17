# MLB Daily Market Coverage Board — 2026-09-25

Status: **RESEARCH-ONLY**

## Why this board exists

The project now measures coverage from the sportsbook menu outward rather than counting how many formulas exist.

A quote is considered covered only when an authorized research contract matches the exact:

`market + line + side`

No line extrapolation and no YES/OVER aliasing are allowed.

## Today's baseline

Persisted approved-prop sportsbook snapshots currently cover **8 MLB games**.

- unique market/player/book rows: **11,550**
- rows matching an exact model contract: **1,007**
- exact row coverage: **8.72%**
- distinct market/line/side surfaces: **99**
- distinct surfaces covered: **9**
- surface coverage: **9.09%**
- games with quotes: **8**
- games with at least one exact contract: **8 / 8**

This is contract compatibility only. It does **not** mean all 1,007 rows qualify as selections. Model threshold, exact identity, strict-pregame lineage and price requirements still apply.

## Where the exact coverage comes from

| Contract | Games | Players | Books | Unique rows |
|---|---:|---:|---:|---:|
| Batter Walks U0.5 | 8 | 132 | 3 | 368 |
| RBI U0.5 | 8 | 153 | 3 | 292 |
| Batter Doubles U0.5 | 8 | 152 | 2 | 283 |
| Pitcher ER O1.5 | 7 | 8 | 3 | 20 |
| Pitcher Outs O14.5 | 5 | 5 | 4 | 18 |
| Batter Hits U1.5 | 7 | 8 | 2 | 10 |
| Pitcher K O3.5 | 3 | 3 | 4 | 9 |
| Pitcher K U6.5 | 3 | 3 | 3 | 5 |
| Pitcher Walks U2.5 | 2 | 2 | 1 | 2 |

## Main lesson

The formulas reach every game represented in the current prop feed, but only a small fraction of the actual market menu.

The largest uncovered groups are mostly:
- alternate ladders;
- YES-style outcomes;
- common lines whose historical signal already failed our gates.

This means further gains should come from **new information or genuinely different model architectures**, not by lowering thresholds on already-failed surfaces.

## Current no-retune examples

- Batter Hits 0.5: no stable >=75% signal.
- Total Bases U1.5: 74.77% in 2026.
- Total Bases U3.5: 90.62% but only +4.12 pp lift.
- Pitcher Walks 1.5: both directions failed development.
- Batter K O0.5: 74.37% in 2026.

## Boundaries

- exact market + exact line + exact side only
- no YES/OVER equivalence assumption
- no threshold rescue
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
