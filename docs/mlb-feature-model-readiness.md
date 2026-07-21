# MLB Feature Store And Model Input Readiness

Certification: pending production smoke

Date: 2026-07-21

## Scope

`mlb_feature_model_readiness_v1` verifies whether existing MLB prediction and feature-store paths can use the best available stored 2026 MLB data without leaking future information.

It does not replace Prediction Engine V4, MLB Prediction Engine V1, the SportsDataIO MLB prospective preview engine, the shared Sport Prediction Engine SDK, recommendation policy, Current Board, settlement or dashboard logic.

## Route

- `GET /api/mlb/features/model-readiness?season=2026`
- `GET /api/mlb/features/model-readiness?season=2026&includeValidation=true`

The route is read-only and reports providerCallsMade 0 and remoteMutationsMade 0.

## Feature Inventory

The audit classifies model inputs as active, available-but-unused, partially populated, limited, blocked by data/source or unsafe without cutoff evidence. It covers team recent form, home/away context, opponent strength, starter identity, pitcher recent performance, bullpen indicators, run production, run prevention, standings context, rest days, schedule density, market implied probability, consensus odds, line movement, feature quality, data sufficiency and missing-data behavior.

## Leakage Protection

The audit requires prediction cutoffs, excludes final game stats from pregame features, keeps settlement data out of pregame features, requires odds snapshot cutoffs and flags post-start prediction rows for exclusion from backtesting/model-audit cohorts.

## Blocked Features

The audit intentionally keeps these blocked unless real stored data supports them:

- weather without verified prediction-cutoff source data
- confirmed lineups without a trusted lineup feed
- injuries without a trusted injury feed
- advanced pitch tracking without source data
- player props without prop odds and settlement support
- CLV/line movement without genuine opening and closing odds history

## Validation

Operations Validation includes fixture checks for zero provider calls, line-movement blocking without open/close odds, settlement exclusion from pregame features, post-start cohort exclusion, no fuzzy identity matching, deterministic classifications, shared Feature Store validation composition and additive API behavior.
