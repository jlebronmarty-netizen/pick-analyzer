# Production Data Gate V1

Last updated: 2026-07-14

## Purpose

Production Data Gate V1 is the shared rule that prevents trial, scrambled or otherwise non-production rows from improving production recommendations, ROI, CLV, calibration, backtesting, model learning, bankroll sizing, Kelly sizing or portfolio construction.

## Canonical Service

- Service: `src/services/production-data-gate.service.ts`
- Policy mode: `production_data_gate_v1`
- Production row predicate: `production_eligible=true`, `trial!==true`, `scrambled!==true`

## Consumers

The gate is used by production-facing feature validation, prediction persistence, settlement metrics, backtesting/calibration, CLV analytics/update selection, model metrics, model learning, adaptive weights, top picks, AI Coach, pattern discovery, closing-line intelligence and downstream recommendation/portfolio surfaces that read from top picks.

## Trial Policy

Trial rows may validate transport, normalization, lineage, settlement mechanics and idempotency only. They cannot:

- Become recommended production picks.
- Improve production confidence.
- Enter production ROI, CLV, calibration or model-promotion metrics.
- Train adaptive weights or model weights.
- Drive bankroll, Kelly or portfolio output.

## Deterministic Validation

Feature Store validation includes a production-like fixture that passes the gate and a trial/scrambled fixture that fails it. NBA backtest and calibration responses keep trial rows visible only under explicit `trialTechnicalValidation` sections while production summaries use production-eligible rows only.

## Current Trial Batch Result

The 27 SportsDataIO NBA trial predictions remain technical-validation data. Production metric rows are 0 until real non-trial, non-scrambled, production-eligible rows with genuine offered prices and required lineage are approved and persisted.

## Current MLB Quarantine Result

SportsDataIO MLB Discovery Lab rows are real and non-scrambled, but remain quarantined with `production_eligible=false`. MLB Line Movement Expansion Batch V1 produced full-date `2026-JUL-12` line-movement coverage with 36,442 line-movement odds rows, 45 quarantined feature snapshots, 45 linked settled technical predictions, 0 production recommendations, 0 production-eligible rows and 0 production leakage. Production ROI, CLV, calibration, model learning, bankroll, Kelly, portfolio output and promotion remain blocked until explicit production approval, a closing-line policy and sufficient production-eligible sample rules exist.
