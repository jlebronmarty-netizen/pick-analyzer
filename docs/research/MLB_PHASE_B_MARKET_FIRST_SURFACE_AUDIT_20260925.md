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


## Final Phase B closeout

The prior exact line-surface work was recovered before opening any new thresholds.

- **Batter Hits 0.5:** PR #194 already tested the exact surface. No >=75% stable-signal candidate exists. Frozen FAIL.
- **Batter Total Bases U1.5 <=1.20:** 2025 76.24% with +9.70 pp lift, but 2026 was 7,081/9,471 = **74.77%**. Frozen external FAIL; no threshold rescue.
- **Batter Total Bases U3.5 <=1.20:** 2026 was 8,583/9,471 = **90.62%**, but lift was only **+4.12 pp**, below the 5 pp signal gate. No promotion.
- **Batter RBI U0.5 <=0.10:** existing exact contract remains strong: 85.47% in 2025 and 82.88% exact 2026. Move to forward market/price crossing rather than new formula search.
- **Batter H/R/RBI U1.5 <=0.90:** development passes at 3,607/4,795 = **75.22%**, +7.12 pp lift, worst month 71.77%. However the frozen 2026 external snapshot was not persisted.

### HRRBI 2026 lineage recheck

A bounded recovery attempt used the exact frozen checksums. Current MLB Official gameLog history no longer matches the PR #158 snapshot:

- frozen reference: 30,889 raw rows / 25,729 eligible / U2.5 control 1,073/1,255;
- current official source: 30,927 raw rows / 25,707 eligible / U2.5 control 1,079/1,263.

The current source has both added raw rows and fewer eligible rows, so this cannot be repaired by excluding the six extra current player identities. It is historical source revision, not merely an identity-universe mismatch.

State:

`DEVELOPMENT_GATE_PASS_EXTERNAL_BLOCKED_SOURCE_SNAPSHOT_DRIFT`

Do not score U1.5 against revised history and label it the frozen external test. The clean path is untouched forward validation at exact 1.5 lines.

### Phase B conclusion

No new surface is promoted from Phase B today. The operationally useful preserved contracts are still:

- Batter Hits U1.5;
- Batter Total Bases U2.5;
- Batter RBI U0.5;
- Batter H/R/RBI U2.5.

H/R/RBI U1.5 is retained as a **forward-only candidate** at the frozen threshold, not as a certified formula.
