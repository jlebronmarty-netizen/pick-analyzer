# Operational Launch Repair Roadmap V1

Date: 2026-07-30

Status: ROADMAP UPDATED AFTER JULY 29 TERMINAL RECOVERY

Operational Readiness and Multi-Sport audit sections remain read-only: No provider calls. No production mutation.

Bounded July 29 MLB terminal recovery was performed through canonical result ingestion and protected settlement only. No local server smoke was run. No manual Vercel deployment was initiated.

## Recovery Boundary

Local smoke is classified as `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS` after two independent bounded PowerShell wrappers exceeded their hard timeouts. Future smoke-harness repair may be planned separately, but it is not part of this operational audit completion.

| Priority | Phase | Provider calls | Credits | Approval | Expected result |
| --- | --- | --- | --- | --- | --- |
| A | Reliable daily MLB operation | bounded MLB schedule/odds/results only when due | depends on slate; dry-run first | required | MLB daily loop stable |
| B | 5-10 minute adaptive odds refresh | The Odds API/SportsDataIO live odds calls | see refresh scenarios | required | near-start market freshness without budget breach |
| C | Previous/current-season data completeness | historical odds/results/stat imports by sport | must be planned per sport/date | required | coverage gaps closed |
| D | NFL/NHL production readiness | future results and settlement evidence | low/moderate for scores plus odds refresh | required | preview to production gate |
| E | NBA/Soccer/BSN readiness | depends on source entitlement and competition scope | unknown until source plan | required | truthful shadow/preview path |
| F | Tennis/UFC evaluation | event identity, odds/results coverage | bounded discovery plan required | required | classify as production candidate or data-only |

## 2026-07-29 Certification Recovery

MLB Autonomous Operations V1 is deployed to production at commit `9c066b00aaf0c348d9948e13af48a5f10982d40f`. Four late MLB events were recovered by exact targeted result ingestion after authoritative SportsDataIO and MLB Stats evidence showed Final scores. Protected settlement then closed 48 prospective rows with 0 unresolved rows and 0 settlement provider calls.

The immediate P1 repair is complete:

- Prefer exact MLB Stats start-minute matching before same-team local-date fallback.
- Expose targeted MLB result sync for bounded event recovery.
- Align operations health with the canonical `*/10 * * * *` scheduler policy.

Remaining roadmap items:

- Repair `LOCAL_SMOKE_HARNESS_UNRELIABLE_ON_WINDOWS` as a separate process-control task.
- Continue complete-window scheduler observation.
- Add stronger official-pick reporting once production official-pick samples exist.
