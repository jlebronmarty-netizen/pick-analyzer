# Model Governance V1

Date: 2026-07-29

Status: DESIGN ONLY

No model training. No production prediction changes.

## Governance Scope

Model governance controls future training, validation, shadow evaluation, promotion and rollback. It does not authorize model execution changes by itself.

## Epoch Lifecycle

Allowed lifecycle states for future governance:

- `draft`: design exists, no training artifact.
- `trained_candidate`: future training artifact exists but is inactive.
- `validated`: offline validation passed minimum checks.
- `shadow`: candidate produces shadow outputs only.
- `approved`: human approval exists for promotion.
- `active`: explicitly activated champion epoch.
- `rolled_back`: active epoch replaced by prior champion.
- `archived`: retained for audit, not executable.

This phase creates no epoch rows and activates no epoch.

## Required Approvals

Future model evolution requires separate approvals for:

- dataset freeze;
- training run;
- validation report;
- shadow deployment;
- production promotion;
- rollback when needed.

Automatic training remains disabled. Automatic promotion remains disabled.

## Reproducibility

Every future training run must record:

- dataset manifest fingerprint;
- accepted row IDs;
- feature snapshot references;
- code commit;
- model configuration;
- deterministic seed;
- dependency versions;
- training start and end timestamps;
- validation metrics;
- artifact checksum;
- promotion and rollback metadata.

## Audit Rules

No model training. No production prediction changes. No Learning Brain weight changes. No Official Pick policy changes. No probability, confidence or Trust formula changes. No historical prediction rewrite. No settlement mutation.

## Catastrophic Rollback

Rollback restores the previous champion pointer and marks the failed candidate as rolled back. Historical predictions, candidate predictions, feature snapshots and validation reports remain auditable and are never deleted to hide failure.
