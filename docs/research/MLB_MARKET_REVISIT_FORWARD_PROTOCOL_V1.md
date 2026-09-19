# MLB Market Revisit Forward Protocol V1

Status: RESEARCH-ONLY

Contract: `MLB_MARKET_REVISIT_FORWARD_PROTOCOL/1.0.0`

## Why this protocol exists

The first pass intentionally used 2025 for development and opened 2026 once for external validation.

For markets that failed that first external test, 2026 is no longer untouched. A second-pass candidate must therefore use a new validation boundary rather than pretending the same historical 2026 evidence is external again.

## Frozen dates

Historical development may use:

- all eligible 2025 evidence;
- eligible 2026 evidence through **2026-09-18**.

Label:

`HISTORICAL_SEEN_DEVELOPMENT`

Quarantine:

- **2026-09-19** is excluded from both tuning and the new initial forward gate.

New prospective validation begins:

- **2026-09-20**

Label:

`PROSPECTIVE_FORWARD_POST_2026_09_20`

No games on or after the prospective start may be used to choose features, architecture, thresholds or side rules.

## Development gate for a revisit candidate

Before a candidate may enter the forward gate:

- selective event accuracy >= **75%**;
- selected n >= **60**;
- selections in at least **5 calendar months**;
- worst selected month accuracy >= **65%**;
- no same-game/postgame features;
- no same-day result used as prior evidence;
- no historical Odds API credit spend.

If no candidate passes, preserve the best documented formula and move to the next failed market.

## Prospective gate

A frozen candidate is evaluated only on future games from 2026-09-20 onward.

- target accuracy >= **75%**
- n < 20 => `INSUFFICIENT_FORWARD_SAMPLE`
- n >= 20 => provisional prospective result
- n >= 40 => stronger prospective evidence

Do not retune during the forward window.

## First revisit market

`GAME_TOTALS_OU`

Reason: the deployable PREGAME model failed badly, while the separate FULL/postgame diagnostic oracle exceeds 75%. This indicates a potentially valuable pregame-information / representation gap worth revisiting before lower-signal markets.

## Hard boundaries

Official Picks unchanged.
APOSTAR disabled.
No production promotion.
No ROI/EV/CLV claim without certified prices.
Historical Odds API credits consumed: 0.
