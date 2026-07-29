# Model Promotion Policy V1

Date: 2026-07-29

Status: DESIGN ONLY

No model training. No production prediction changes.

## Promotion Principle

Promotion is a controlled governance action, not a side effect of training. No candidate may become production champion because it merely has better offline metrics.

## Required Gates

Future promotion requires:

- frozen dataset manifest;
- training artifact checksum;
- walk-forward validation report;
- calibration report;
- champion comparison;
- prospective shadow evaluation;
- no leakage findings;
- no safety regression;
- rollback target identified;
- manual approval.

## Metric Gates

Future candidate evaluation must include:

- Brier score;
- calibration error;
- accuracy;
- log loss;
- precision and recall where applicable;
- ROI with real odds only;
- CLV where closing-line evidence exists;
- expected value validation;
- profit simulation;
- Sharpe;
- drawdown.

Profit metrics cannot override leakage, calibration or policy failures.

## Shadow Requirement

Candidate models must run as shadow-only before promotion. Shadow output must not appear as Official Picks, Current Board champion rows or production recommendation logic until explicitly promoted.

## Rollback Policy

Rollback restores the prior champion and records the cause. It must not delete candidate rows, validation artifacts, historical predictions, feature snapshots or settlement labels.

## Hard Blocks

- No automatic promotion.
- No promotion from trial, preview or scrambled evidence.
- No promotion without prospective shadow results.
- No model training in this phase.
- No production prediction changes in this phase.
