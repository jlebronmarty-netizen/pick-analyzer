# MLB Phase B Market-First Surface Audit — 2026-09-25

Status: **RESEARCH-ONLY**

## Objective

Prioritize Batter Hits, Total Bases, RBI, and Hits+Runs+RBIs by the lines actually appearing at sportsbooks before spending more research effort.

## Existing strong contracts

- Batter Hits U1.5 — 86.40% 2026 frozen-rule accuracy.
- Batter Total Bases U2.5 — 86.52% 2026 frozen-rule accuracy.
- Batter RBI U0.5 — 82.88% exact 2026 reconciliation.
- Batter H+R+RBI U2.5 — 85.50% exact 2026 reconciliation.

These remain exact-line contracts only.

## What the stored sportsbook feed actually shows

### Batter Hits
- 0.5 OVER: 5,856 quote rows, 5 days, 19 games, 101 players, 9 books.
- 0.5 UNDER: 1,352 rows, 99 players, 4 books.
- 1.5 OVER: 4,152 rows, 101 players, 9 books.
- 1.5 UNDER: only 76 rows, 3 players, 4 books.

Implication: our strong U1.5 contract has poor practical line-side availability. **0.5 is the highest-priority new Hits surface.**

### Batter Total Bases
- 1.5 OVER: 4,808 rows, 101 players, 9 books.
- 1.5 UNDER: 1,115 rows, 41 players, 7 books.
- 2.5 OVER: 3,131 rows.
- 2.5 UNDER: only 3 rows.
- 3.5 OVER: 2,799 rows.
- 4.5 OVER: 2,623 rows.

Implication: our strong U2.5 model is poorly aligned to the actual quoted side. **1.5 is the first new TB surface; 3.5 is next.**

### Batter RBI
- 0.5 OVER: 651 rows.
- 0.5 UNDER: 442 rows.

This is operationally useful because the existing U0.5 formula is already strong. No new line-surface search is required before forward price/availability testing.

### Batter Hits + Runs + RBIs
- 0.5: both sides observed.
- 1.5: 724 rows on each side, 79 players, 6 books.
- The strong existing U2.5 contract is not the line surface dominating the stored feed.

Therefore **H/R/RBI 1.5** becomes the first new HRRBI research target.

## Phase B research order

1. Batter Hits 0.5
2. Batter Total Bases 1.5
3. Batter H/R/RBI 1.5
4. Batter Total Bases 3.5
5. Batter RBI 0.5 — forward validation/price crossing only

## Methodology requirement

The new backtests must reuse the certified strict-prior builder:

`source_game_date < target_game_date`

Game 1 of a doubleheader must never enter Game 2 history.

An interactive all-grid SQL attempt timed out. That is not permission to simplify the lineage. New line-surface work should run through a bounded repository backtest/replay using the existing certified batter-history logic.

## Boundaries

- no line extrapolation
- no threshold rescue after reading future outcomes
- no fuzzy player identity
- no Official Picks
- APOSTAR disabled
- no historical Odds API spend
