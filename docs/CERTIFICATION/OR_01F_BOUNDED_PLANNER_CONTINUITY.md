# OR-01F Bounded Planner Continuity Certification

Status: `LOCALLY_COMPLETE_PENDING_PRODUCTION_PROOF`.

Starting commit: `f6cae3ec6bb20b02ca9e4898783ac8d2f49b73c5`

## Verdict

OR-01F implements the approved bounded planner-continuity repair. The protected operating-day writer can now recompute planner state after a material action and continue only to immediately due internal closure work. It cannot execute a second provider action, cannot repeat the same action identity and cannot loop without caps. Production proof is required after deployment before final certification.

## Continuity Policy

| Field | Value |
| --- | --- |
| Policy | `planner_continuity_v1` |
| Max actions per invocation | 3 |
| Max provider actions per invocation | 1 |
| Max duration | 300000 ms |
| Max mutations per invocation | 500 |
| Safe internal continuation | `settle` |

## Certified Chains

| Chain | Result |
| --- | --- |
| Market preparation | Provider market action may run once, existing stored-odds prediction generation remains inside the market action, planner recomputes, then stops before another provider action or continues only to `settle` if due. |
| Result closure | `sync_results` may be followed by `settle` when recomputation proves settlement is immediately due. |
| Settlement-only | `settle` remains provider-free and can trigger derived learning/performance bookkeeping as before. |
| Internal recovery | Only safe internal `settle` is currently enabled for chained execution. |

## Guardrails

- Scheduler cadence unchanged.
- Provider budget unchanged.
- Prediction formulas unchanged.
- Official Pick policy unchanged.
- Settlement math unchanged.
- Learning math unchanged.
- Current Era unchanged.
- Replay unchanged.

## Remaining Blocker

OR-01F reduces dependence on repeated scheduler ticks, but it does not prove sustained GitHub schedule delivery or fresh market cadence. OR-01A and MC-08H remain blocked until sustained market freshness and scheduler readiness are proven.
