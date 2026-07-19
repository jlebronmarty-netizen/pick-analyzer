# MLB Operations

Status: Production Stable
Version: MLB Production Complete v1.0.0

## Operating Workflow

The MLB operating workflow is organized around a Puerto Rico operating day and uses the existing operating-day services and routes.

Stages:

1. Schedule discovery and operating-day selection.
2. Next slate rollover.
3. Odds availability and refresh readiness.
4. Feature and prediction readiness.
5. Recommendation policy evaluation.
6. Current Board publication.
7. Results synchronization when games are terminal.
8. Scoped settlement.
9. Replay, calibration and learning readiness checks.

## Production Validation Snapshot

Production validation on 2026-07-18 confirmed:

- `/api/dashboard?mode=today&includeValidation=true`: HTTP 200, success true, providerCallsMade 0, remoteMutationsMade 0, officialPicks 0.
- `/api/current-board?includeValidation=true`: HTTP 200, success true, mode `current_board_intelligence_engine_v1`.
- `/api/operating-day/status`: HTTP 200, success true, providerCallsMade 0, officialPicks 0.
- `/api/operating-day/automation/status`: HTTP 200, success true, providerCallsMade 0, officialPicks 0.
- `/api/settlement/core`: HTTP 200, success true.
- `/api/model/learning`: HTTP 200, success true.
- `/api/model/calibration`: HTTP 200, success true.

## Operational Readiness

Ready:

- Dashboard status and Today contract.
- Current Board read path.
- Market opportunity read paths.
- Operating-day status.
- Automation status.
- Provider budget status.
- Feature Store status.
- Settlement core.
- Learning and calibration contracts.

Provider-limited:

- Confirmed lineups.
- Detailed injury feed.
- Some player importance inputs.
- Historical sample growth.
- Deeper bullpen workload sample.

Performance note:

Some heavy composite diagnostic routes can exceed a 30-second external smoke-test timeout. This is a known operational issue for internal summary endpoints, not a recommendation-policy blocker. Future work may optimize those summaries without changing architecture.