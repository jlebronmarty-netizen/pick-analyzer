# PI-03S Canonical Market Evidence Propagation

Status: LOCAL VALIDATION COMPLETE, PRODUCTION PROOF PENDING

Starting commit: `e38c95ee1030529b1b9fadcc91170ee786bc4aa3`

## Scope

PI-03S repairs the product propagation gap found after PI-03R. PI-03R certified that Current Board can bind complement-side provider prices, but Homepage decision surfaces could still receive reconstructed selector evidence that treated complement-bound prices as unavailable.

This repair keeps one canonical evidence path:

Current Board `canonicalPrice` and `canonicalEv`

to Dashboard Today selectors and grounded opportunities

to Homepage Rent Play, Moneyline Bet, Smart Parlay and Watchlist.

## Root Cause

`dashboard-today.service.ts` still classified a priced candidate as aligned only when `canonicalPrice.source === selected_stored_price`. PI-03R introduced certified complement provider prices with `canonicalPrice.source === complement_provider_price` and `bindingMode === COMPLEMENT`. Dashboard Today therefore filtered the canonical price, implied probability, edge and EV back to null before the Homepage consumed the selector.

The Homepage then displayed:

- Odds `N/A`
- Implied probability `N/A`
- Edge `N/A`
- EV `N/A`
- stale Product Freshness SLA sometimes obscured by display freshness wording

## Repair

`dashboard-today.service.ts` now uses a canonical availability helper:

`canonicalPrice.status === AVAILABLE` and real `americanOdds`

This accepts both:

- `DIRECT`
- `COMPLEMENT`

The selector contract now includes:

- `predictionId`
- `priceBindingMode`
- source market identity fields
- provider source timestamp
- snapshot captured timestamp
- Product Freshness SLA

`HomeBettingPlan.tsx` now propagates those fields into:

- Rent Play
- Moneyline Bet
- Smart Parlay legs
- Watchlist items

The UI labels distinguish:

- `Market Evidence`
- `Snapshot Captured`
- `Price Binding`

## Safety

No prediction probabilities, confidence values, ranking formulas, Official Pick policy, Rent Play policy, Moneyline policy, Smart Parlay policy, Kelly logic, settlement, learning, scheduler cadence, provider budgets, freshness thresholds, Current Era or Replay behavior were changed.

Stale market evidence remains non-actionable through existing Product Freshness SLA and actionability gates.

## Production Proof Requirement

After deployment, verify the same exact prediction ID across Current Board and Homepage decision surfaces. Prefer:

`5c2a4e28-3afe-54cf-83da-89cdee66f9b3`

Required:

- Current Board odds equal Rent Play odds when the same candidate is selected.
- Binding mode remains `COMPLEMENT`.
- Product Freshness SLA remains authoritative for actionability.
- Stale evidence remains non-actionable.
- Direct-bound candidates still bind as `DIRECT`.

