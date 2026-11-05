# TT coverage repair / MLB pause visibility — 2026-11-04

This patch does not change formulas, min-history requirements, cohort identifiers, original emissions, NHL, MLB suspension settings, database schemas, subscriptions, or cron schedules.

## Root cause
Tipsport results paginate with top-level page/limit/total/totalPages/hasNextPage. The collector previously inspected body.pagination.hasNextPage only, stopped after one page, and reported RESULT_PAGINATION_UNVERIFIED. NetBet league events use a total/events board that may be unpaginated. Sources verified: https://pulsescore.net/docs and https://pulsescore.net/tipsport-api. Requested page size is not guaranteed returned size.

## Fix
Validate top-level and legacy nested envelopes, reject contradictions and wrong pages, and record actual sizes. Read at most the same two result pages; limited windows remain PARTIAL, never relabeled complete. Validate complete unpaged prematch boards by matching returned count to total. Space provider calls by 1.2 seconds after the preceding response, including the transition to prematch. Existing SQL budget remains 9/day and 240/month, not an estimate of account-wide remaining quota.

Read-only summary mode omits individual records. Report the latest run independently per sport and expose WARMUP separately from the run's partial coverage. MLB OFFSEASON_PAUSED is read from the existing runtime flag and overrides the current display without fabricating a run. The writer's pause guard remains intact.

## Remaining limits
Cold start is not bypassed. Old abstentions remain abstentions, not retrospective predictions. Two pages cannot recover all provider history or guarantee all later settlements. This patch does not enable NCAAF, activate NBA models, recover the old Hub database, remove the source gateway, or free the old project's slot. Real postgame reconciliation and a full authenticated mobile/browser path require their own evidence. Tests below are synthetic, not new predictive validation.
