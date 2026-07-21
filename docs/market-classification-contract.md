# Market Classification Contract

Date: 2026-07-21

## Canonical Priority

The shared classifier in `src/services/market-intelligence-category.service.ts` evaluates Current Board rows in this order:

1. Invalid identity, leakage or post-start signals.
2. Missing or unaligned market data.
3. Shadow, trial or historical rows.
4. Quarantined preview rows.
5. Stale or expired market input.
6. Material negative value.
7. Insufficient data.
8. AI Lean.
9. Watchlist.
10. Official.

## User-Facing States

Canonical states are `OFFICIAL`, `AI_LEAN`, `WATCHLIST`, `AVOID`, `NO_MARKET`, `STALE`, `INVALID`, `QUARANTINED`, `INSUFFICIENT_DATA` and `SHADOW`.

The legacy four-category field remains available for backward compatibility, but API cards now also expose `canonicalMarketState`, `marketValueQuality`, `marketFreshnessState`, `primaryBlocker` and `improvementPath`.

## Material Negative Value

Material negative value is currently defined as EV at or below `-20%` or edge at or below `-15` percentage points. This matches the previous clear-avoid thresholds already present in the product and prevents production-blocked rows with very poor value from appearing as Watchlist.

## Watchlist

Watchlist requires a realistic path to actionability. Examples include fresher market input, exact aligned market price, better price, confidence closer to threshold or a specific missing input that may arrive.

Rows with material negative value, invalid inputs, stale/expired markets, quarantine, shadow status or no aligned market are not Watchlist.
