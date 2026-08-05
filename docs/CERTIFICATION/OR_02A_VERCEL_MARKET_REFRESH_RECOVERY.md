# OR-02A Vercel Market Refresh Recovery

Status: `DEPLOYMENT_PENDING_MARKET_REFRESH_PROOF`

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

## Certification Gate

OR-02A cannot reach final PASS until production proves:

1. The deployed planner selects market refresh when current eligible stale pregame events are due.
2. A real provider call occurs only when market refresh is due.
3. Stored provider/source market timestamps advance.
4. Market Freshness becomes `HEALTHY`.
5. Product Readiness becomes `HEALTHY`.
6. Operations become non-critical.
7. Three consecutive post-repair automatic Vercel primary invocations are observed.

Production Pilot Week was not started. MC-03 was not started.
