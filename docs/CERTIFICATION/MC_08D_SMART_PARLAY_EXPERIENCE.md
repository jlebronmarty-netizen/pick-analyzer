# MC-08D Smart Parlay Experience Certification

Status: `PRODUCTION_CERTIFIED`

MC-08D certifies the Smart Parlay homepage experience as a presentation-only improvement over existing stored betting evidence.

## Validation Plan

- MC-08D validator.
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

- MC-08D validator: `PASS` 47/47.
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

Production certification passed on runtime commit `f9faf649d89cd343034e935225d7215dafcc754b`.

- `/api/system/version`: HTTP 200, commit `f9faf649d89cd343034e935225d7215dafcc754b`, provider calls 0.
- `/`: HTTP 200.
- `/api/dashboard/today`: HTTP 200, provider calls 0.
- `/api/current-board?mode=current&limit=100`: HTTP 200.
- `/api/market-opportunities/most-likely`: HTTP 200, provider calls 0.
- `/api/market-opportunities/best-value`: HTTP 200, provider calls 0.
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`: HTTP 200, provider calls 0.
- `/api/operations/health`: HTTP 200, provider calls 0.
- `/betting-workbench`: HTTP 200.
- `/mlb-operations`: HTTP 200.
- Desktop render: `PASS`; Smart Parlay present after Moneyline Bet and before Watchlist, status `NO_SAFE_COMBINATION`, available legs `8`, default selected legs `0`, selection/deselection `PASS`, no horizontal overflow.
- Mobile render: `PASS`; Smart Parlay present after Moneyline Bet and before Watchlist, status `NO_GAMES`, available legs `0`, no horizontal overflow.

Production evidence showed the honest current state: no safe selected parlay is currently actionable. Joint probability remains `NOT_CERTIFIED`, and combined odds remain unavailable until the selected legs all expose valid canonical prices.
