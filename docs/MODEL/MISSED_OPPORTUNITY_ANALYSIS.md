# Missed Opportunity Analysis V1

Status: RELEASE 04 LOCAL AUDIT

Source: production `/api/performance?diagnostics=full`, scheduler coverage embedded in `/api/performance`, Current Board contracts, and repository scheduler/prediction safety code.

This analysis did not generate retrospective predictions. Existing cutoff enforcement remains intact: predictions after game start or after the recorded cutoff are excluded from performance and must not be recreated.

## Current Coverage

| Window | Games Scheduled | Eligible Games | Predicted | Pending | Skipped | Coverage | Missed Windows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Today | 15 | 15 | 15 | 0 | 0 | 100% | 0 |
| Yesterday | 10 | 10 | 10 | 0 | 0 | 100% | 0 |

Release 04 found no current scheduler-driven missed-window defect in the read-only performance coverage evidence.

## Existing Skip And Exclusion Reasons

| Reason | Rows |
| --- | ---: |
| TEST_FIXTURE | 1,106 |
| POST_START | 200 |
| IGNORED | 70 |
| EVENT_NOT_FINAL | 54 |
| INVALID_CUTOFF | 30 |
| LEGACY | 24 |
| RESULT_NOT_IMPORTED | 15 |
| UNKNOWN | 11 |
| NO_OUTCOME | 3 |
| POST_FINAL | 2 |

These are exclusions from the performance scope, not proof that bets were missed. They show where future instrumentation should separate intentional ineligibility from operational misses.

## Why Events Are Not Recommended

| Cause | Evidence | Action |
| --- | --- | --- |
| Official policy blocks broad previews | Current Board candidates include production-gate, calibration, confidence, edge, EV, data quality and stale-odds blockers. | Keep policy strict until row-level segment evidence supports changes. |
| Missing critical inputs | Current Board missing-information fields include starter, lineup, injury, weather and bullpen context when unavailable. | Prioritize MLB starter/pitcher/weather completeness before threshold changes. |
| Market value absent | Many rows have non-positive edge or EV. | Improve calibration and market alignment before increasing recommendations. |
| Post-start/post-final exclusions | Performance scope excludes post-start and post-final rows. | Preserve this safeguard; do not create retroactive predictions. |
| Result import lag | 15 `RESULT_NOT_IMPORTED` rows appear in the bounded performance scope. | Monitor, but do not manually settle unless a legitimate protected workflow path owns it. |

## Provider Unavailable

No provider was called during this audit. Provider unavailability is represented only through stored artifacts: missing odds snapshots, stale stored odds, and missing optional feature context. Release 04 does not infer provider failures from absent live calls.

## Scheduler Timing

Performance coverage reported zero missed windows for the current today/yesterday MLB windows. The model-quality issue is therefore not primarily scheduler coverage; it is calibration, feature completeness and market-specific reliability.

## Recommendations

1. Add a read-only model segment export that computes home/away, favorite/underdog, market, edge, confidence and probability buckets from stored `prediction_history`.
2. Keep skipped/excluded rows visible by reason so intentional policy blocks are not mistaken for operational misses.
3. Add a no-provider, read-only missed-opportunity report that joins event schedule, prediction history and odds snapshots.
4. Do not backfill missing predictions after start time; only improve future pregame generation.
