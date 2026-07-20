# MLB Runtime Activation Completion

Date: 2026-07-19

## Summary

MLB Runtime Activation, Scheduler & Canonical Results Completion V1 is code-complete locally but not production-certified. The production deployment command was explicitly attempted after user authorization, but the execution environment rejected the Vercel production deploy as an external code export and instructed that no workaround be attempted.

## Completed Repairs

| Area | Result | Evidence |
| --- | --- | --- |
| Local build | PASS | `npm.cmd run build` completed with 307 generated static pages. |
| Status refresh | PASS | Existing `status_refresh` stage remains MLB Stats API-backed and protected. |
| Canonical results provider | PASS | `syncRecentResults(baseball_mlb)` now uses MLB Stats API schedule/game feed, maps to canonical `sport_events`, writes `game_results`, updates final event scores and exposes result evidence. |
| Market due logic | PASS | Adaptive freshness now separates accepted market availability from provider-check evidence and reports `CURRENT`, `CHECK_DUE`, `CHECK_OVERDUE`, `PROVIDER_CHECK_FAILED`, `PROVIDER_DELAYED`, `NO_MARKETS_RETURNED`, `NO_RELEVANT_GAMES`, `BUDGET_BLOCKED` or `NOT_APPLICABLE`. |
| Scheduler template | PASS | `.github/workflows/production-operating-day.yml` calls the protected production cron every 15 minutes with `CRON_SECRET`, concurrency protection, timeout and manual dispatch support. |
| Protected cron evidence | PASS | `/api/cron/operating-day` response now surfaces provider, endpoint, provider-check flags, status rows, result rows and failure reason evidence. |

## Production Activation

| Area | Result | Evidence |
| --- | --- | --- |
| Production deployment | FAIL | `npx vercel --prod --yes` was rejected by the execution policy before a deployment ID was created. |
| Deployment ID | NOT_APPLICABLE | No deployment was created. |
| Protected production smoke | FAIL | Not run because the new code is not deployed. |
| Real provider production evidence | FAIL | Not collected through production Vercel runtime. |
| External scheduler active | FAIL | Workflow is prepared in source, but repository secret presence, schedule enablement and first successful invocation cannot be verified from this environment. |

## Scheduler Activation Contract

Endpoint:

```text
POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

GitHub Actions secret:

```text
CRON_SECRET
```

Recommended cadence:

```text
*/15 * * * *
```

The adaptive planner decides whether provider work is actually due. The workflow must not be called from forks or pull requests, and overlapping runs are blocked through GitHub `concurrency` plus existing runtime provider locks.

Manual PowerShell test after deployment:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Post -Uri "https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false" -Headers $headers -TimeoutSec 120
```

## Remaining External Step

`EXTERNAL_DEPLOYMENT_AND_SCHEDULER_ACTIVATION_REQUIRED`

1. Deploy the current repository state to the Vercel production project.
2. Confirm GitHub Actions scheduled workflows are enabled on the default branch.
3. Configure repository secret `CRON_SECRET` to match the production Vercel environment secret.
4. Trigger `Production Operating Day Runtime` once with `workflow_dispatch`.
5. Verify one `operating_day_lifecycle_events` record with provider-check evidence.

## Final Status

- MLB Runtime Activation: **FAIL** until deployed and smoke-tested in production.
- Closed Beta Ready: **NO** for unattended automation.
- Core Freeze Eligible: **NO**.
