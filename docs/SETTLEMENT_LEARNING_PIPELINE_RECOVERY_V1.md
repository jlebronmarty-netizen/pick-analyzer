# Settlement And Learning Pipeline Recovery V1

Date: 2026-07-27

## Classification

Status: LOCALLY IMPLEMENTED.

Root cause: the adaptive refresh scheduler could report settlement freshness, and operating-day status could identify a prior day requiring settlement, but scheduler prioritization did not treat the settlement domain as an executable due-now action. Current-day status refresh could therefore mask prior completed stored results whose prediction rows were ready for deterministic settlement.

## Production Read-Only Evidence

- `prediction_history` contained pending MLB rows from completed scored events.
- The settlement reconciliation dry run for 2026-07-26 audited 45 predictions, found 42 deterministically settleable rows and left 3 awaiting result.
- The operating-day status for 2026-07-26 reported `nextRequiredAction: settle`.
- Provider calls remained 0.
- Remote mutations remained 0.
- No SQL, historical import, feature rebuild, epoch activation, backfill or Learning Brain weight change was executed.

## Repair

- Added read-only settlement backlog detection to the adaptive refresh orchestrator.
- Included settlement in the existing due-now domain decision path.
- Exposed settlement backlog evidence in operations status.
- Routed adaptive dry-run/execution planning for settlement to the oldest settlement-ready local date instead of the current slate date.
- Added an optional protected execution `expectedAction` guard so approved settlement certifications cannot drift into a different due action if live scheduler state changes between preflight and execution.
- Kept settlement scoring, prediction probability, confidence, quality, threshold, model, Official Pick, Learning Brain, Kelly, Portfolio and player-prop logic unchanged.

## Guardrails

- Settlement backlog detection reads stored `prediction_history` and `sport_events` only.
- Provider calls: 0.
- Remote mutations during certification: 0.
- Production mutations during certification: 0.
- Scheduler behavior changed only to surface already-eligible settlement work; it does not create predictions, rebuild features or alter model outputs.
- `expectedAction` is optional and preserves default scheduler behavior for existing cron callers.

## Certification Markers

- SETTLEMENT_BACKLOG_DETECTION_PASS
- SETTLEMENT_SCHEDULER_SELECTION_PASS
- SETTLEMENT_DRY_RUN_ROUTE_PASS
- LEARNING_PIPELINE_INPUT_PRESERVED_PASS
- NO_PROBABILITY_CHANGE_PASS
- NO_CONFIDENCE_CHANGE_PASS
- NO_MODEL_CHANGE_PASS
- NO_LEARNING_BRAIN_WEIGHT_CHANGE_PASS
- NO_PROVIDER_CALL_REGRESSION_PASS
- NO_REMOTE_MUTATION_PASS
- NO_CERTIFIED_PLATFORM_REGRESSION_PASS
