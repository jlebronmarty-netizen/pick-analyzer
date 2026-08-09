# Pregame Market Line Versioning V1

Status: `ODDS_02E_TOTAL_LINE_CONTRACT_READY_FOR_CUTOVER_DESIGN`

Provider calls: `0`.

Database mutations: `0`.

## Purpose

ODDS-02E closes the contract gap discovered during ODDS-02D: exact-line odds were compared safely, but the captured certification response did not preserve the full non-exact total-line universe by bookmaker.

The production rule is:

`PREDICTION_LINE` and `CURRENT_BETTABLE_LINE` are separate market identities.

An `Over 8.0` probability must never be paired with an `Over 8.5` price unless a future certified line-adjustment model explicitly supports that. No such model exists today.

## Canonical Market Identity

For odds-backed line markets, identity is:

| Field | Required |
| --- | --- |
| event | yes |
| provider | yes |
| bookmaker | yes |
| market | yes |
| side / selection | yes |
| line | yes for totals and run lines |
| price | yes for EV/edge |
| source timestamp | yes for actionability |
| captured at | yes for acquisition audit |

Moneyline has no numeric line identity. Run line and total markets do.

## Implemented Contract

`src/services/market-line-versioning-contract.service.ts` defines the provider-neutral contract:

- `MarketLineEvidence`
- `PredictionLineIdentity`
- `marketLineIdentityKey`
- `filterExactLineEvidence`
- `classifyLineMovement`
- `evaluatePregameRepredictionEligibility`
- `buildSupersessionLineageDraft`
- `lineSpecificTotalSettlement`

This is server-only. It does not call providers, write predictions, change odds authority, or expose provider payloads.

## Line Movement Classification

| Classification | Meaning |
| --- | --- |
| `EXACT_LINE_AVAILABLE` | Current evidence includes the prediction line. |
| `HALF_POINT_MOVE` | Closest current line differs by 0.5. |
| `FULL_POINT_MOVE` | Closest current line differs by 1.0. |
| `MULTI_POINT_MOVE` | Closest current line differs by more than 1.0. |
| `ALTERNATE_LINES_AVAILABLE` | Current line differs by another nonzero amount. |
| `NO_CURRENT_MARKET` | No current evidence exists for that market/side. |
| `UNKNOWN` | Prediction line is not numeric or cannot be compared. |

Direction is `UP`, `DOWN`, `UNCHANGED`, or `UNKNOWN`.

## Pregame Re-Prediction Eligibility

ODDS-02E implements only deterministic dry-run eligibility. It creates no production predictions.

A future production re-prediction for a changed line is eligible only when:

- event is still pregame;
- current time is before certified cutoff;
- market is supported;
- fresh current price exists;
- required features are available;
- current line identity differs from latest canonical prediction;
- no prediction already exists for the exact new line.

## Supersession Lineage

Original predictions remain immutable. A future changed-line prediction must link lineage:

| Field | Purpose |
| --- | --- |
| `predictionId` | original prediction identity |
| `eventId` | event identity |
| `market` | market identity |
| `selection` | side identity |
| `line` | exact prediction line |
| `generatedAt` | point-in-time generation |
| `cutoffAt` | cutoff proof |
| `supersedesPredictionId` | newer prediction points back |
| `supersededByPredictionId` | older prediction points forward |
| `supersedeReason` | `MARKET_LINE_CHANGED` |
| `sourcePriceTimestamp` | underlying market evidence time |

## Settlement

Every prediction settles against its own line.

Example:

| Prediction | Final Total | Result |
| --- | ---: | --- |
| Over 8.0 | 8 | push |
| Over 8.5 | 8 | loss |

The settlement contract is line-specific and does not require a settlement-rule change.

## Surface Policy

Current decision surfaces must use the latest valid cutoff-safe prediction for the currently bettable exact line when available.

If current line evidence exists but no prediction exists for that exact line, the safe state is:

`WAITING_FOR_CURRENT_LINE_PREDICTION`

The UI must not fabricate edge or EV by mixing old-line probability with new-line odds.

## ODDS-03 Readiness

ODDS-03 is not authorized by this document.

The Odds API cutover design is closer, but provider replacement still requires a future capture contract that preserves raw/current line evidence by event, book, market, side, and line for certification.
