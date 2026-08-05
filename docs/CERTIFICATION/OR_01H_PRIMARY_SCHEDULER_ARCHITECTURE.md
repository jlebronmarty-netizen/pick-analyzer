# OR-01H Primary Scheduler Architecture Decision

Status: `HUMAN_SCHEDULER_ARCHITECTURE_DECISION_REQUIRED`

Evidence collected on `2026-08-05` from production commit `931fa81543feb1fad4192b0344e555eee7ddf4c5`.

## Decision

OR-01H does not activate a new primary scheduler.

The repository requires a protected operating-day writer at the certified 10-minute cadence:

- writer cron: `7-57/10 * * * *`
- heartbeat cron: `3,33 * * * *`
- protected endpoint: `POST /api/cron/operating-day?dryRun=false`
- shared authorization: `CRON_SECRET`
- shared duplicate protection: provider action lock, operating-day evidence ledger, canonical result/odds upserts and idempotent settlement guards

GitHub Actions is the current configured unattended writer. Vercel Cron is disabled in `vercel.json`:

```json
{ "crons": [] }
```

Vercel cannot be promoted to primary from repository evidence alone because the current project plan and Cron Jobs settings are not available in the local repository or production read-only endpoints.

## Vercel Capability Evidence

Official Vercel documentation states:

- Cron Jobs are available on all plans.
- Hobby accounts are limited to once-per-day cron jobs with hourly precision.
- Pro and Enterprise plans support once-per-minute cron jobs with per-minute precision.
- Hobby deployments fail when cron expressions run more frequently than once per day.
- Vercel recommends using `CRON_SECRET`; Vercel sends it as an `Authorization` header to the cron endpoint.
- Cron jobs are logged from the project dashboard.
- Cron jobs do not retry automatically on failure.

Sources:

- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/cron-jobs
- https://vercel.com/docs/pricing/manage-and-optimize-usage

Because the current Vercel plan is not visible from repository evidence, OR-01H cannot prove whether a 10-minute Vercel Cron primary is already available at no additional cost or whether it requires a paid plan upgrade.

## Scheduler Inventory

| Scheduler | Current Role | Cadence | Evidence | Decision |
| --- | --- | ---: | --- | --- |
| GitHub Actions `production-operating-day.yml` | Current writer | `7-57/10 * * * *` | Latest successful scheduled runs on commit `931fa815...`: `31032206383`, `31037920501` | Keep as current writer/fallback. Sustained proof still not enough for production-ready gate. |
| GitHub Actions `production-operating-day-heartbeat.yml` | Observer | `3,33 * * * *` | Read-only heartbeat workflow calls the protected operating-day endpoint with `dryRun=true` | Keep as observer only. |
| GitHub Actions `operating-day-refresh.yml` | Manual fallback | Manual only | No schedule trigger | Keep manual fallback only. |
| Vercel Cron | Disabled | none | `vercel.json` has empty `crons` | Do not activate until plan support is proven. |
| Local/server smoke | Not allowed | none | Windows local smoke harness excluded by prior instruction | Not used. |

## Production Evidence

- `/api/system/version`: HTTP 200, commit `931fa81543feb1fad4192b0344e555eee7ddf4c5`, provider calls 0.
- `/api/operations/health`: HTTP 200, scheduler cadence `HEALTHY`, missed intervals 0, latest protected invocation `2026-08-05T19:07:25.608+00:00`, refresh/product readiness `CRITICAL` because market freshness is `CRITICAL`.
- `/api/operations/adaptive-refresh/status`: HTTP 200, operating date `2026-08-05`, 15 current games, 11 pregame games ready for analysis, 33 prediction candidates, latest odds timestamp `2026-08-05T16:16:39.658Z`, status `PARTIAL`.
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`: HTTP 200, 15 events, 11 `REFRESH_MARKET`, 4 `STOP_PREGAME_REFRESH`, estimated next provider request 1.
- `/api/operations/mlb-autonomous-operations`: HTTP 200, current primary listed as GitHub Actions writer.
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`: HTTP 200, budget `HEALTHY`, certification reads used 0 provider calls.
- `/api/performance`: HTTP 200, Current Era 114 canonical predictions, 69 settled, 45 pending.
- `/api/mission-control`: HTTP 200, MC-08H remains blocked for production pilot readiness.

## GitHub Actions Evidence

Newest production writer runs observed:

| Run ID | Event | Commit | Conclusion | Started |
| --- | --- | --- | --- | --- |
| `31037920501` | `schedule` | `931fa81543feb1fad4192b0344e555eee7ddf4c5` | `success` | `2026-08-05T19:06:58Z` |
| `31032206383` | `schedule` | `931fa81543feb1fad4192b0344e555eee7ddf4c5` | `success` | `2026-08-05T17:54:34Z` |

These prove the GitHub writer can execute on the repaired commit. They do not prove three consecutive automatic primary executions at the required cadence.

## Required Human Action

Open the Vercel dashboard for the Pick Analyzer project and verify:

1. Team/project plan: Hobby, Pro or Enterprise.
2. Cron Jobs settings are enabled for the project.
3. Production branch is `main`.
4. `CRON_SECRET` exists in the Production environment and matches the GitHub secret value without exposing it.
5. Deployment protection does not block Vercel Cron.
6. Runtime logs for `/api/cron/operating-day` are visible.

Decision after dashboard check:

- If the project is Pro or Enterprise and Cron Jobs are enabled, approve a bounded config change adding Vercel Cron as primary and keeping GitHub Actions as fallback.
- If the project is Hobby, approve or reject a paid Vercel upgrade before Vercel Cron can meet the required intraday cadence.
- If Vercel Cron is disabled or deployment protection blocks it, repair those dashboard settings before primary scheduler migration.

## Fallback Contract

GitHub Actions may remain fallback only when a primary scheduler is proven. The fallback must not blindly run alongside a healthy primary. It must use the same protected endpoint and rely on:

- shared `CRON_SECRET` authorization
- provider action lock
- deterministic action identity
- operating-day lifecycle ledger
- no replay of missed ticks
- app-side duplicate suppression
- scheduler health evidence before escalation

## Final Classification

`HUMAN_SCHEDULER_ARCHITECTURE_DECISION_REQUIRED`

OR-01H did not begin Production Pilot Week. MC-03 was not started.
