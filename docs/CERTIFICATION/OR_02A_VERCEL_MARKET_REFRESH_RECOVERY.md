# OR-02A Vercel Market Refresh Recovery

Status: `PRODUCTION_CERTIFIED`

Starting commit: `c74656af083b36349032cee5141da7ebe15c9750`

## Root Cause

Production proved Vercel Cron primary execution was healthy, but active market freshness remained critical because adaptive action selection chose `sync_results` for older missing-result recovery debt before current-slate stale market refresh.

The proven state before repair:

- Scheduler cadence: `HEALTHY`.
- Missed intervals: `0`.
- Market Freshness: `CRITICAL`.
- Product Readiness: `CRITICAL`.
- Provider ledger calls today: `0`.
- Current MLB events: `15`.
- Pregame refresh-eligible events: `11`.
- Post-start events excluded from pregame refresh: `4`.
- Completed missing-result rows: `6`.
- Missing-result date: `2026-07-28`.
- Canonical selected action: `sync_results`.

## Repair

The adaptive planner now preserves settlement priority but prevents older result-recovery debt from starving current active-slate market refresh. When settlement-ready rows are `0`, missing-result debt is older than the active slate, and current pregame market refresh is due, the selected action becomes `midday_refresh` or `morning_sync` according to the existing operating-day rules.

No scheduler infrastructure changed. Vercel Cron remains primary and GitHub Actions remains fallback.

## Safety

- Prediction formulas unchanged.
- Official Pick policy unchanged.
- Recommendation gates unchanged.
- Kelly unchanged.
- Settlement rules unchanged.
- Learning unchanged.
- Provider budgets unchanged.
- Freshness thresholds unchanged.
- Generated/page timestamps do not establish freshness.
- Post-start pregame refresh remains blocked.

## Final Production Proof

Production proved:

1. The deployed planner selects `midday_refresh` when current eligible stale pregame events are due.
2. Real provider calls occur when market refresh is due and are counted by the provider budget ledger.
3. Stored provider/source market timestamps advanced from `2026-08-05T16:16:39.658Z` to `2026-08-05T18:06:59.000Z`.
4. The visible Current Board market snapshot advanced to `2026-08-05T22:07:28.383Z`.
5. Market Freshness is `HEALTHY`.
6. Product Readiness is `HEALTHY`.
7. Operations are `HEALTHY`.
8. Three consecutive post-repair automatic Vercel primary invocations were observed at `21:47:41Z`, `21:57:44Z` and `22:07:41Z`.
9. Provider budget calls advanced from `0` to `3` after the accounting repair.

## Accounting Repair

The second bounded runtime repair records canonical acquisition `actualHttpRequests` as `sports_sync_jobs.metadata.externalCallsUsed`, which is an existing provider-budget accounting source. This fixes the provider-call accounting defect without changing provider limits, cadence, planner logic, prediction behavior, settlement, learning or recommendation policy.

Production Pilot Week was not started. MC-03 was not started.
