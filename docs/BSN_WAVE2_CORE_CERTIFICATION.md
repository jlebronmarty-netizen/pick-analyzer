# BSN Wave 2 Core Certification

Date: 2026-07-20

Status: PARTIAL

Stop gate: Phase 2 - BSN Data And Provider Coverage

## Result

BSN Wave 2 started and reused the existing Sports Brain. Phase 1 reuse certification passed. Phase 2 returned PARTIAL, so work stopped before additional BSN phases and before NBA.

## Reuse Certification

PASS:

- Prediction SDK
- Current Board readiness surface
- Market Alignment
- Recommendation Explanations
- Official Pick Experience
- AI Feed
- Scheduler and provider-budget contracts
- Health and operations validation
- Backtesting and calibration surfaces
- Risk and Kelly stack by reuse contract

No duplicate prediction engine, Current Board, dashboard logic, recommendation service, explanation service, settlement service, health service, scheduler, backtesting service or calibration service was created.

## BSN-Specific Coverage

PARTIAL:

- Verified BSN odds are missing.
- BSN game statistics are missing.
- Approved BSN source ingestion is still required.
- V7 shadow sample coverage is insufficient for production activation.
- Calibration sample coverage is insufficient for production activation.
- Moneyline, spread and totals are blocked until verified odds are available.

## Runtime Evidence

`/api/bsn/core-certification?includeValidation=true`:

- certification: `BSN_CORE_PARTIAL`
- status: `PARTIAL`
- stop: `true`
- stopPhase: `Phase 2 - BSN Data And Provider Coverage`
- validationPassed: 7
- providerCallsMade: 0
- remoteMutationsMade: 0

`/api/operations/validation`:

- `bsnCoreCertification.success`: true
- `bsnCoreCertification.passed`: 7
- providerCallsMade: 0
- remoteMutationsMade: 0

`/api/bsn/model-maturity/backtesting`:

- gamesReplayed: 38
- graded: 38
- correct: 28
- incorrect: 10
- accuracy: 73.68%
- brierScore: 0.21

## Certification

BSN Core: PARTIAL

Closed Beta Activation: NO

NBA Start Eligible: NO

