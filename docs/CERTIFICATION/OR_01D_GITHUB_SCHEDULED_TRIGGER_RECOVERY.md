# OR-01D GitHub Scheduled Trigger Recovery

Date: 2026-08-05

Status: PRODUCTION CERTIFIED

## Verdict

OR-01D proved that the production scheduler workflow is active on the default branch and that an automatic `schedule` run reached production after the OR-01C repairs.

## Schedule Contract

- Workflow: `Production Operating Day Scheduler`
- File: `.github/workflows/production-operating-day.yml`
- Default branch: `main`
- Cron: `7-57/10 * * * *`
- Expected UTC minutes: `:07`, `:17`, `:27`, `:37`, `:47`, `:57`
- Puerto Rico semantics: GitHub triggers in UTC; the application resolves the America/Puerto_Rico operating date.
- Concurrency: `production-operating-day-writer`, `cancel-in-progress: false`
- Target: `https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false`

## Automatic Proof

- Run ID: `31015257795`
- Event: `schedule`
- Commit: `42439dee8e4b42f2302ef466df16a39fb40d235b`
- Created: `2026-08-05T14:27:10Z`
- Started: `2026-08-05T14:27:12Z`
- Completed: `2026-08-05T14:27:35Z`
- Conclusion: `success`
- App request/invocation: `2b3900d1-4789-414d-9116-3bd151e07ae5`
- Selected action: `midday_refresh`
- Heartbeat recorded: yes, `2026-08-05T14:27:33.731+00:00`

## Production Recovery

- Scheduler Execution: HEALTHY
- Missed intervals: 0
- Market Freshness: HEALTHY
- Current Board: 45 fresh / 0 stale visible markets
- Provider Budget: HEALTHY
- Settlement Closure: HEALTHY
- Product Readiness: HEALTHY
- Overall Operational Health: HEALTHY
- Historical result recovery debt remains visible and non-blocking.

## Classification

The earlier missing run window is classified as `GITHUB_SCHEDULE_DELAY`; no disabled workflow, invalid cron, branch mismatch, job condition, secret failure, or concurrency suppression was proven.

OR-01A is production-certified from this evidence. MC-08H was rerun from current evidence and is production-certified with Production Pilot Week marked READY.
