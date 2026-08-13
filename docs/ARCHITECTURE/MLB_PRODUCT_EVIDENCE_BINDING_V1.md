# MLB Product Evidence Binding V1

Status: `MLB_MODEL_PROBABILITY_EVIDENCE_BINDING_REPAIR_READY_FOR_DEPLOYMENT`

## Purpose

Current Board product candidates must expose the same model probability, price, implied probability, edge and EV bundle that was used to build the candidate. The product layer may also expose canonical/complement review evidence, but it must not mix that evidence into the source-selection fields.

## Root Cause

Production Current Board rows contained valid stored MLB model probabilities in `rawProbability` and valid same-selection value math in `marketAlignment`, but the top-level product DTO omitted `modelProbability` and `winProbability`. The homepage adapter reads those top-level aliases first, so the rendered cards could show odds, implied probability, confidence, edge or EV while rendering model probability as `N/A`.

This was a DTO/evidence-binding defect, not a prediction-generation defect.

## Binding Contract

- `modelProbability`, `winProbability` and `probability` are aliases for the stored same-selection `prediction_history.model_probability` already exposed as `rawProbability`.
- `edgePercentagePoints` and `expectedValuePercent` are aliases for the same-selection `marketAlignment` value math.
- `analysisSnapshotTimestamp` is the prediction row `generated_at` timestamp for product evidence traceability.
- `canonicalOutcome`, `canonicalPrice`, `canonicalMarketAlignment` and `canonicalEv` remain available for canonical/complement review evidence.
- Homepage review cards may use canonical EV fallback only when explicitly reading canonical review evidence; source-selection probability must not be dropped.

## Candidate Selection And Review Contract

- Current Board starts from 27 current-day MLB prediction-backed candidates: 9 Moneyline, 9 Run Line and 9 Total.
- The homepage review universe may be larger than Current Board because it also includes Today selectors and grounded opportunities, then deduplicates by event, market, selection, exact line and sportsbook.
- Rent Play is not Most Likely. Rent Play is the safest currently actionable wager only after probability, odds, freshness, value and policy gates pass.
- Moneyline is not Most Likely. Moneyline is evaluated only inside the Moneyline universe and still requires price, freshness, value and policy evidence.
- When no primary Rent Play or Moneyline qualifies, the fallback card is the most evidence-complete review candidate, not the highest-probability candidate.
- Most Likely remains the probability-first surface in its certified universe.

## Complement Semantics

- Moneyline is binary in the current MLB product contract, so the opposite side may be represented as a certified complement when the exact opposite side and price evidence exist.
- Fractional Run Line pairs such as Team A -1.5 and Team B +1.5 are binary complements when exact event, market and opposite line identity match.
- Fractional Totals such as Over/Under 7.5 or 8.5 are binary complements when exact event, market and opposite selection identity match.
- Integer Run Lines and Totals are push-capable. The opposite probability is not certified as `1 - p` unless push probability is known, so EV may remain unavailable.
- No product surface may auto-flip a low-probability selected side into the opposite side unless the certified market semantics and exact price binding prove the complement.

## Value And Timestamp Semantics

- Null EV means EV is unavailable. It must not be coerced to `0.00%` for gates or display.
- Downstream product consumers may carry null EV for display and audit, but positive-value filters and official-eligibility gates must treat null EV as unavailable/not positive.
- `Analysis Snapshot` is sourced from prediction generation evidence, normally `prediction_history.generated_at`.
- `Market Evidence Time` is sourced from provider/source market evidence time, not prediction generated time or render time.
- `Observed At` is render/fetch observation time and must not be used as market freshness.

## Safety

No prediction formula, model probability, confidence, EV formula, ranking, Official Pick policy, provider authority, settlement, learning, HR-03 calibration status, NBA historical foundation or Vercel configuration changed.

Certification reads use 0 provider calls and 0 database mutations.
