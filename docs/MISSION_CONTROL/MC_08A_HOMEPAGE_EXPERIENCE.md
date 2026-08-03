# MC-08A Homepage Experience

Status: `LOCAL_VALIDATION_PASS_PENDING_PRODUCTION`

MC-08A is the first bounded sub-mission inside MC-08 Daily Betting Product Completion. It transforms the homepage presentation only. It does not change prediction, Official Picks, ranking, probability, confidence, edge, EV, Kelly, model, settlement, learning, scheduler, provider contracts or budgets.

## Scope

The homepage answers one question:

> What should I do today?

The experience now follows this order:

1. Decision Core Morning Brief.
2. Rent Play.
3. Moneyline Bet.
4. Smart Parlay.
5. Today's Watchlist.
6. Decision Summary.
7. Expandable Technical Evidence.

## What Changed

- Removed the old technical-feeling homepage hero.
- Made Decision Core Morning Brief the first section.
- Made Rent Play a full-width primary decision card.
- Kept Moneyline Bet and Smart Parlay as focused secondary decisions.
- Moved remaining qualified looks into Today's Watchlist.
- Moved health, planner, lifecycle, provider, budget, operations, model and diagnostics details into a collapsed technical evidence section.
- Kept secondary navigation to Most Likely, Best Value, Performance, Sports, Operations, Data Coverage and Diagnostics.

## Safety

- Existing `/api/dashboard/today`, `/api/current-board`, `/api/model/intelligence` and `/api/performance` reads are reused.
- No provider calls are introduced.
- No mutation routes are called.
- Parlay toggles remain browser-only presentation math.
- Official Pick and recommendation policies are unchanged.
- Unsupported and non-actionable markets are not promoted.

## Certification

Primary validator:

```powershell
node scripts/mc08a-homepage-experience-validate.mjs
```

Build is required because the homepage runtime component changed.

MC-08B was not started.

## Local Validation

- MC-08A validator: `PASS` 37/37.
- Mission Control validator: `PASS` 57/57.
- C1 product validator: `PASS` 31/31.
- Changed-file ESLint: `PASS`.
- Build: `PASS` with 396 generated static pages.
