# Operating Day Cron Reliability V1

## Root Cause

Production `POST /api/cron/operating-day?dryRun=false` could return a generic HTTP 500 while the current slate was already healthy. The scheduler selected `morning_sync` even when all 15 MLB games had odds, features and predictions. Local reproduction showed that path regenerated from stored checkpoints with zero provider calls, but returned the full nested provider-preparation payload. In serverless production that is an unnecessary timeout/serialization risk.

## Fix

The cron route now returns a compact structured no-op when the selected slate is already current:

- status: `already_current`
- selected action: `status`
- providerCallsMade: 0
- writes: 0
- retryable: false

Known operational outcomes are normalized into auditable statuses: `completed`, `no_op`, `already_current`, `waiting`, `locked`, `quota_blocked`, `provider_error`, `partial`, `invalid_stage` and `configuration_error`.

## Validation

Local real cron validation:

`POST /api/cron/operating-day?dryRun=false`

returned `already_current`, providerCallsMade 0 and writes 0 for `2026-07-17`.

Dry-run remains zero-call and reports current stage, next action, stale events and scheduler configuration.
