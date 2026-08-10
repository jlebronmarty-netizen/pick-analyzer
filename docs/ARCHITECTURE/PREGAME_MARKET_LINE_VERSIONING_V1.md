# Pregame Market Line Versioning V1

Status: `ODDS_03C_R2_LINE_VERSIONED_WRITER_READY_FOR_DEPLOYMENT`

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

This is server-only. It does not call providers, change odds authority, or
expose provider payloads.

ODDS-03C-R2 adds:

- `executeLineVersionedRepredictionWriter`
- `validateLineVersionedRepredictionWriterFixtures`

The writer consumes already-acquired odds evidence and existing pregame feature
context. Stage 1 remains non-persistent; future primary stages can persist only
after all write gates pass.

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

ODDS-03C-R2 implements deterministic writer eligibility and a bounded writer
path. Stage 1 creates no production predictions because The Odds API is still
shadow-only.

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

## Return-To-Prior-Line Policy

If a market moves from `8.0` to `8.5` and later returns to `8.0`, the writer
does not blindly reactivate an old prediction. The deterministic policy is:

`CREATE_NEW_VERSION_IF_FEATURE_OR_TIME_CONTEXT_CHANGED`

The original row remains auditable. A new row must carry its own generated time,
feature context, odds snapshot, exact line, idempotency key and lineage.

## ODDS-03 Readiness

ODDS-03C-R2 makes the re-prediction writer deployable, but it does not promote
The Odds API. Promotion still requires explicit human authorization and
production certification of the writer in the intended authority stage.
