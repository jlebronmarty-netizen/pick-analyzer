# Prospective Official Eligibility Gate V1

Status: completed as a zero-provider, zero-real-promotion safety layer.

## Purpose

Prospective Official Eligibility Gate V1 separates technical validation rows from real prospective candidates that may eventually become official picks. It does not lower thresholds, bypass calibration, place wagers or promote the current `NYM @ PHI` slate.

## Row Classes

- `HISTORICAL_VALIDATION`
- `TRIAL_VALIDATION`
- `SCRAMBLED_VALIDATION`
- `FIXTURE_VALIDATION`
- `PROSPECTIVE_PREVIEW`
- `PROSPECTIVE_OFFICIAL_ELIGIBLE`
- `PROSPECTIVE_OFFICIAL`

Classification uses persisted evidence: event start time, prediction generated time, `prospective_preview`, `trial`, `scrambled`, `production_eligible`, feature snapshot lineage, model version, feature-set version, provider provenance, recommendation status and settlement state.

Historical, settled, trial, scrambled and fixture rows never classify as prospective official rows.

## Eligibility Contract

A real prospective row is eligible for official review only when every gate passes:

- future unstarted event
- valid event mapping
- valid snapshot linkage
- real current pregame-safe odds
- odds timestamp before cutoff
- odds not stale or anomalous
- no explicit leakage block
- `trial=false`
- `scrambled=false`
- prospective preview lineage
- current model and feature-set versions
- supported sport and market
- valid model probability
- meaningfully positive edge
- meaningfully positive EV
- confidence threshold
- reliability threshold
- feature quality threshold
- data sufficiency threshold
- market stability threshold
- no critical missing-domain blocker
- calibration maturity acceptable or mature
- Recommendation Eligibility Policy returns `QUALIFIED`, `BEST_BET_CANDIDATE` or `PLAY_OF_DAY_CANDIDATE`

`PROSPECTIVE_OFFICIAL_ELIGIBLE` is an audit/result state meaning the candidate is ready for exact candidate-specific approval. It is not public official status. `PROSPECTIVE_OFFICIAL` requires exact candidate activation.

## Candidate-Specific Activation

Existing official consumers already require `production_eligible=true` and policy-qualified rows, but there was no safe candidate-specific action before this module.

This module extends the existing `/api/recommendation-readiness` route:

- `GET /api/recommendation-readiness?eligibilityGate=true`
- `GET /api/recommendation-readiness?validate=eligibilityGate`
- protected `POST /api/recommendation-readiness` with `action=promote_prospective_official_candidate`

The POST action requires:

- exact prediction ID
- exact event ID
- exact feature snapshot ID
- exact odds snapshot ID
- sport
- market
- model version
- feature-set version
- reason
- idempotency key
- `confirmed=true` for mutation

It rejects missing identity, batch promotion, historical rows, settled rows, trial rows, scrambled rows, fixture rows, stale odds, post-cutoff odds, unsupported markets, non-positive edge or EV, insufficient calibration and duplicate promotion.

The current slate was validated only with dry-run rejection; no real candidate was promoted.

## Current Slate Result

Current `NYM @ PHI` candidates remain `PROSPECTIVE_PREVIEW` and `NOT AN OFFICIAL PICK`.

- `Under 9.5`: negative edge, negative EV, low confidence, insufficient calibration
- `NYM +1.5`: negative edge, negative EV, low confidence, insufficient calibration
- `NYM moneyline`: negative edge, negative EV, low confidence, insufficient calibration

Official state remains:

- Top Picks: 0
- Play of the Day: none
- Bet Slip: no ticket
- AI Bet Finder official ticket: none

## Fixture Coverage

Deterministic fixtures prove:

- excellent prospective candidate passes and would be eligible for official review
- insufficient calibration blocks
- stale odds block
- historical rows stay permanently quarantined
- tiny edge blocks
- current `NYM @ PHI` rows remain blocked

Provider calls: 0.
Remote mutations: 0 for validation and current slate.
