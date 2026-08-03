# MC-08C Moneyline Bet Experience Certification

Status: `PRODUCTION_CERTIFIED`

MC-08C certifies the Moneyline Bet homepage experience as a presentation-only improvement over existing stored Moneyline evidence.

## Validation Plan

- MC-08C validator.
- MC-08B validator.
- MC-08A validator.
- Mission Control validator.
- MC-02 validator.
- OE-003F validator.
- OE-003E validator.
- C1 product validator.
- B2 through B6.1 product validators.
- Route/artifact consistency.
- Unsupported-market policy.
- Scheduler health alignment.
- JSON validation.
- Markdown validation.
- Changed-file ESLint.
- Targeted secret scan.
- `git diff --check`.
- `npm.cmd run build`.

## Local Evidence

- MC-08C validator: `PASS` 43/43.
- MC-08B validator: `PASS` 34/34.
- MC-08A validator: `PASS` 37/37.
- Mission Control validator: `PASS` 57/57.
- MC-02 validator: `PASS` 24/24.
- OE-003F validator: `PASS` 28/28.
- OE-003E validator: `PASS` 32/32.
- C1 product validator: `PASS` 31/31.
- B2 Today Experience validator: `PASS` 35/35.
- B3 Best Opportunity Readiness validator: `PASS` 26/26.
- B4 Decision Dashboard Experience validator: `PASS` 23/23.
- B5 AI Decision Explanation validator: `PASS` 27/27.
- B5.1 Mobile Opportunity Navigation validator: `PASS` 25/25.
- B6 Mobile Decision Experience validator: `PASS` 30/30.
- B6.1 Live Freshness Budget validator: `PASS` 30/30.
- Route/artifact consistency: `PASS` 14/14.
- Unsupported-market policy lock: `PASS` 19/19.
- Scheduler health alignment: `PASS` 6/6.
- JSON validation: `PASS`.
- Markdown validation: `PASS`.
- Changed-file ESLint: `PASS`.
- Targeted secret scan: `PASS`.
- `git diff --check`: `PASS`.
- Build: `PASS` with 396 generated static pages.

## Production Certification

Production certification passed on runtime commit `b748b9f812afeaf7d8c96f561a480a49303a8cd4`.

- `/api/system/version`: HTTP 200, commit `b748b9f812afeaf7d8c96f561a480a49303a8cd4`, provider calls 0.
- `/`: HTTP 200.
- `/api/dashboard/today`: HTTP 200, provider calls 0.
- `/api/current-board?mode=current&limit=100`: HTTP 200.
- `/api/market-opportunities/most-likely`: HTTP 200, stored prediction history, provider calls 0.
- `/api/market-opportunities/best-value`: HTTP 200, provider calls 0.
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`: HTTP 200, estimated provider requests 0 and quota units 0.
- `/api/operations/health`: HTTP 200, status `CRITICAL` from existing operational state.
- `/mlb-operations`: HTTP 200.
- Desktop render: `PASS`; Moneyline card present after Rent Play and before Smart Parlay, status `POLICY_BLOCKED`, candidate `ARI`, event `ARI @ CLE`, rank 1 of 3, 0 eligible candidates, no zeroed unavailable odds/implied probability/edge/EV.
- Mobile render: `PASS`; Moneyline card present, no horizontal overflow, no zeroed unavailable values.

Production evidence showed the honest current state: no actionable Moneyline. The strongest current Moneyline candidate is blocked by existing policy/data-quality and missing price/value evidence. MC-08C did not promote it into Official Picks, Rent Play, Most Likely or Best Value.
