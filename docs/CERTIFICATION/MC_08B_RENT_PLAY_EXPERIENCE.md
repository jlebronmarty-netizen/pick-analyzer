# MC-08B Rent Play Experience Certification

Status: `PRODUCTION_CERTIFIED`

MC-08B certifies the Rent Play homepage experience as a presentation-only improvement over existing stored recommendation evidence.

## Validation Plan

- MC-08B validator.
- MC-08A validator.
- Mission Control validator.
- MC-02 validator.
- OE-003F validator.
- OE-003E validator.
- C1 product validator.
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

Production certification passed on runtime commit `310b72ab0b304a1901ce598527043043087c9c83`.

- `/api/system/version`: HTTP 200, commit `310b72ab0b304a1901ce598527043043087c9c83`, provider calls 0.
- `/`: HTTP 200.
- `/api/dashboard/today`: HTTP 200, provider calls 0.
- `/api/current-board?mode=current&limit=100`: HTTP 200.
- `/api/market-opportunities/most-likely`: HTTP 200, stored prediction history, provider calls 0.
- `/api/market-opportunities/best-value`: HTTP 200, provider calls 0.
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`: HTTP 200, estimated provider requests 0 and quota units 0.
- `/api/operations/health`: HTTP 200, status `CRITICAL` from existing operational freshness/closure state.
- `/mlb-operations`: HTTP 200.
- Desktop render: `PASS`; Rent Play card present, status `NO_ELIGIBLE_PLAY`, no zeroed unavailable odds/probability/edge/EV.
- Mobile render: `PASS`; Rent Play card present, status `NO_GAMES`, no zeroed unavailable odds/probability/edge/EV.

Production initially exposed a display-only defect where null odds/probability could render as `0` because `Number(null)` coerced null to zero. The scoped repair preserves null, undefined and blank values as unavailable. No prediction, policy, provider, scheduler, settlement or learning behavior changed.
