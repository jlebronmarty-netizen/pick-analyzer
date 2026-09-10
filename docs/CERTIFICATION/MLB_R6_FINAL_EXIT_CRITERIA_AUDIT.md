# R6 final exit-criteria evidence audit

## Current review supersedes the earlier settlement objection

The user explicitly accepts `IMPLEMENTATION_CERTIFIED_PRODUCTION_DISABLED_PENDING_FIRST_SETTLEABLE_SAMPLE` for final certification. Production settlement remains disabled with zero stored results; Performance is `NO_SETTLED_SAMPLE`. That limitation no longer blocks certification, and no production settlement action is authorized.

Fresh production review nevertheless found a new substantive blocker after the successful 23:45 observation: the 00:00 scheduled run remains RUNNING at FEATURES, with one prediction persisted and one Odds request consumed, but no durable market reference and no persisted market observations after run start. Cron logs show 503 at 00:00 and subsequent slots through 03:45 UTC. This is not a successful terminal run. The original error is unavailable in those logs. Mission Odds is 3/20. MLB scheduling is being contained without resetting or deleting the run, its counters or valid predictions/picks. Final operational certification remains unissued for this separate blocker.

**Final verdict remains NOT ISSUED.** After this evidence audit, automatic review still rejected the final certificate because production settlement is disabled and no settled sample exists. The table below inventories the evidence actually available; it does not override that rejection or promote test evidence to production evidence.

This audit separates retained certification, fresh production observation and disposable tests. It does not assert that the latest scheduled run was nonempty, that it inserted pitches, or that production settlement occurred.

Evidence sources:

- **R**: `MLB_DATA_02R_REPEATABILITY_CERTIFICATION.json`: two genuine September 9 runs, 14 and 13 eligible games, real persisted features/predictions/markets/picks and independent readback. This earlier successful evidence is retained, not substituted with started games.
- **S**: `MLB_R6_SCHEDULED_PRODUCTION_READBACK.json`: actual Vercel GET at 23:45:42 UTC, HTTP 200, package `5de5899ccaa1366ead8d2f8f19bd742c216990df`, PREGAME and INCREMENTAL terminal readbacks.
- **T**: fresh disposable suite: 71 SQL checks, 17 automation/product groups, eight host checks and 27 preflight checks. These include real 76-vector/Champion parity, interruption after features, independent-client resume, zero-write replay, provider races and settlement outcomes. They are not represented as production mutations.
- **U**: 12 production mobile/desktop/API checks after the scheduled run; current durable Data Health agrees with SQL, with no active lease.
- **C**: R3 transitive readiness and all 56 readiness source hashes verified after the activation-aware UI-validator hash repair. Both implementation builds passed; modified-file lint passed.

| Mission exit criterion | Supporting evidence |
|---|---|
| 1. Current schedule acquisition | S: successful bounded Official request in each mode |
| 2. Shared canonical pitch acquisition | R retained acquisition; S shared Statcast request; T bounded batch persistence. S returned zero new pitches, explicitly not a populated-ingest claim |
| 3. Native identities | R and T exact identities; S one planned native update, cap one, readback PASS |
| 4. Pregame provenance | R/T and S blocking newer evidence after run freeze |
| 5. Starter guards | R/T missing or changed starter blocking; no fabricated starter IDs |
| 6. Real feature generation | R retained live results and T real builders |
| 7. Exact 76-vector | R/T, unchanged source contracts C |
| 8. Champion inference | R/T, unchanged source contracts C |
| 9. Prediction persistence | R independent live readback; T fenced persistence/recovery |
| 10. Current h2h acquisition | R two bounded Odds requests; no unnecessary Odds call in S |
| 11. Market matching | R/T and canonical U |
| 12. No-vig | R/T preserved implementation C |
| 13. Edge | R/T preserved implementation C |
| 14. EV | R/T preserved implementation C |
| 15. Policy V1 | R/T/C, no policy changes |
| 16. Official Pick persistence | R independent readback; no new picks in S |
| 17. Value Board | U canonical parity |
| 18. Zero-pick behavior | S NO_VALID_PREGAME_SLATE, zero predictions/values/picks |
| 19. Genuine nonempty refresh | R first real 14-game run; not claimed for S |
| 20. Repeatability | R subsequent real 13-game run |
| 21. Pitch automation active | Vercel registered Cron; S INCREMENTAL COMPLETE for eight scoped games |
| 22. Daily automation active | Same sole Cron; S PREGAME COMPLETE; no parallel MLB Cron retained |
| 23. Settlement works | T and existing settlement certificate: win/loss/push/void, immutable original picks. Production settlement automation remains disabled |
| 24. Performance reporting | T/U; NO_SETTLED_SAMPLE, no unsupported ROI/CLV |
| 25. Today canonical data | U mobile/desktop and API parity |
| 26. No production fixture path | C and retained guarded R3 path; no synthetic production rows introduced |
| 27. Started-game leakage zero | S blocked 14 non-pregame games; R/T guards retained |
| 28. Provider accounting observable | S durable counters and U; mission Odds 2/20 |
| 29. DML accounting observable | S native update planned=actual=cap=1, conflicts zero; U and durable SQL readback |
| 30. Recovery runbook | `docs/MLB_OPERATIONAL_RECOVERY_RUNBOOK.md`, current durable-state contract |

R6 distinguishes simulated tests from required production tests: Gates 4, 9 and 16 explicitly permit simulation; Gates 7/15 use the disposable real R2 forced-interruption and independent-instance recovery test, complemented by the actual-host lease-release/resume probe. Gate 18 has actual production host evidence. Gate 20 requires at least one genuine Cron invocation and explicitly permits NO_VALID_PREGAME_SLATE; S supplies that evidence. Postgame and overnight modes are implemented/dry-certified but were not observed in this particular slot.

Accounting evidence is scoped: S directly records two Official calls, one Statcast call, zero Odds calls, zero business inserts and one bounded native update. No DDL command was executed in this follow-up. Runtime row count increased by three and total revisions by 22 relative to the initial production read. The certified authority increments revision exactly once for each runtime UPDATE; no counter reset or runtime DELETE occurred. Historical mission totals remain in their original certificates rather than being silently relabeled as this run's activity.

The earlier automatic-review rejection of the combined final-artifact rewrite is retained as review history. This audit provides the explicit evidence and applicability distinctions requested by that review; it does not authorize unsupported claims or erase limitations.
