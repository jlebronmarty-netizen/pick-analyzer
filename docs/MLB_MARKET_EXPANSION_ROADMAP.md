# MLB Market Expansion Roadmap V1

Status: Complete read-only roadmap and implementation plan.

Source of truth:
- `/api/production-readiness/audit`
- `/api/mlb/odds/coverage?date=2026-07-19`
- `/api/mlb/markets/expansion-roadmap`
- `src/services/mlb-market-capability-registry.service.ts`
- `src/config/sportsdataio-endpoint-catalog.ts`

## Verified Baseline

Latest verified operating date: `2026-07-19`.

Current state:
- Games: 16
- Provider odds records: 16
- Stored odds rows: 94
- Market groups stored: `moneyline`, `run_line`, `total`
- Prediction rows: 47
- Current Board candidates: 32 at validation time
- Official Picks: 0
- AI Leans: 0
- Watchlist: 24
- Avoid: 17
- Core full-game coverage: 100%
- Broader market-group coverage: 16.7% across the requested expansion taxonomy
- Audited registry coverage: 37.5% across the existing compact capability registry
- Provider calls made by this roadmap: 0

The prompt's 41 Current Board candidates was no longer current when revalidated; production returned 32 candidates.

## Ingestion Funnel

| Stage | Count | Meaning |
| --- | ---: | --- |
| Provider | 16 | SportsDataIO game odds records for the active date |
| Received | 16 | Records available to the importer |
| Stored | 16 | Provider game records mapped to internal games |
| Normalized | 94 | Stored odds rows across moneyline, run line and total |
| Feature-ready games | 16 | Games with feature snapshots |
| Modeled games | 16 | Games with predictions |
| Predicted rows | 47 | Prediction history rows |
| Current Board | 32 | Active Current Board candidates |
| Official Gate | 0 | Rows passing official-pick policy |

## Supported Today

Production-supported and modeled:
- Moneyline
- Run Line
- Game Total

Not production-supported:
- Team Totals
- Alternate Run Lines
- Alternate Totals
- First Five markets
- First Inning markets
- Pitcher Props
- Batter Props
- Team/Game Props
- Same Game combinations
- Arbitrage

Consensus-only pricing means Pick Analyzer cannot prove arbitrage or multi-book value dispersion today.

## Priority Result

The recommended first implementation epic is **Team Totals V1**.

Why:
- Closest extension from existing full-game architecture.
- Uses deterministic team-score settlement.
- Avoids player identity and late lineup risk that prop markets carry.
- Adds a meaningful opportunity universe without changing official-pick standards.

Team Totals cannot be activated until verified team-total prices and historical settled team-total rows exist.

## Recommended Waves

Wave 1: Team Totals V1
- Complexity: Medium
- Prerequisites: verified team-total odds, team-score settlement target, historical line snapshots
- Expected expansion: about 30-32 potential rows on a 16-game slate after data gates

Wave 2: First Five Markets V1
- Complexity: High
- Prerequisites: first-five odds, inning score storage, starter-change rules
- Expected expansion: about 45-60 potential rows per full slate after data gates

Wave 3: Pitcher Props V1
- Complexity: Very High
- Start with pitcher strikeouts and outs recorded only after prop odds and player-stat settlement exist.

Wave 4: Batter Props, First Inning, Alternates and Same Game combinations
- Complexity: Very High
- These carry the highest late-news, volatility, correlation and sportsbook-rule risk.

## Guardrails

This roadmap does not:
- Change prediction formulas
- Change model weights
- Change official thresholds
- Change Current Board policy
- Change champion, challenger or V7 status
- Change settlement policy
- Change learning policy
- Acquire new provider data
- Rewrite historical rows
- Activate new betting markets

## First Epic Specification

Epic: MLB Team Totals V1.

Build as shadow-only:
1. Verify provider or import source for team-total odds.
2. Extend odds normalization with team-total market keys.
3. Store immutable team-total line snapshots.
4. Build team-scoring features from existing Feature Store patterns.
5. Add deterministic team-score settlement.
6. Replay historical rows.
7. Backtest and calibrate separately from full-game totals.
8. Add AI Performance Center visibility.
9. Add Current Board preview category only.
10. Keep Official Picks disabled until all activation gates pass.

No official-pick threshold should be lowered to create more picks.
