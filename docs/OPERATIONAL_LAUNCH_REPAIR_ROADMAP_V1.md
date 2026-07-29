# Operational Launch Repair Roadmap V1

Date: 2026-07-29

Status: ROADMAP ONLY

No roadmap execution was performed. No provider calls. No production mutation.

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
