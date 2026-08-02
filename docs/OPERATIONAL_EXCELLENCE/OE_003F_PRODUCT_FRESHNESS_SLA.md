# OE-003F Product Freshness SLA

Status: PASS pending production deployment.

OE-003F adds a canonical read-only freshness contract for betting decision surfaces. It does not change prediction math, probability, confidence, EV, edge, Official Pick thresholds, Rent Play ranking, Moneyline ranking, Smart Parlay math, Kelly, settlement, learning, scheduler cadence, provider mappings or provider budgets.

## Contract

The contract is `product_freshness_sla_v1` and is implemented in `src/services/product-freshness-sla.service.ts`.

Required semantics:

- Market freshness uses provider/source market timestamps from stored odds evidence.
- Page render time, API fetch time and `generatedAt` are never substituted as market freshness.
- Future market timestamps are `INVALID_FUTURE` and `BLOCKED`.
- Post-start pregame markets are `POST_START` or `MARKET_CLOSED` and `BLOCKED`.
- Missing timestamps are `UNAVAILABLE`.
- Stale active prices downgrade to `WAIT_FOR_REFRESH`, not recommendation promotion.

## Surface Policy

Decision-critical surfaces use stricter final-window tolerances:

- Rent Play
- Moneyline Bet
- Smart Parlay
- Official Picks

Exploratory/informational surfaces expose the same evidence with less aggressive tolerances:

- Today and Daily Brief
- Current Board
- Most Likely
- Best Value
- Best Opportunity
- Betting Workbench
- Game Intelligence
- AI Bet Finder

## Runtime Integration

Integrated services and components:

- `src/services/current-board.service.ts`
- `src/services/dashboard-today.service.ts`
- `src/services/market-opportunity-suite.service.ts`
- `src/services/best-value-scanner.service.ts`
- `src/services/ai-bet-finder.service.ts`
- `src/services/game-intelligence.service.ts`
- `src/services/mlb-operations-center.service.ts`
- `src/components/home/HomeBettingPlan.tsx`
- `src/components/market-opportunities/BettingDecisionWorkspace.tsx`
- `src/components/market-opportunities/MostLikelyTool.tsx`
- `src/components/market-opportunities/BestValueTool.tsx`

## Guardrails

- Product surfaces remain stored-data readers.
- Provider calls made by OE-003F certification: 0.
- Remote mutations made by OE-003F certification: 0.
- Scheduler cadence unchanged.
- Refresh cadence unchanged.
- Official Pick policy unchanged.
- Unsupported markets remain unsupported.

## Certification

Local build passed with `npm.cmd run build`.

OE-003F validator: `scripts/oe003f-product-freshness-sla-validate.mjs`.

Certification artifact: `docs/CERTIFICATION/oe-003f-product-freshness-sla.json`.
