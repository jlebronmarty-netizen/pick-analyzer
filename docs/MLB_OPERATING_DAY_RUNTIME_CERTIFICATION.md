# MLB Operating Day Runtime Certification V1

Date: 2026-07-20

## Summary

MLB runtime certification is **PASS_LOCAL** for the protected operating-day chain through status refresh, odds refresh, prediction/current-board read model and user-mode visibility. Full unattended production certification remains pending deployment of this local commit and verification that an external intraday scheduler is active.

No dashboard redesign, prediction formula, projection formula, Official Pick threshold, Best Value policy, champion state, V7 state, settlement formula, learning formula, projection integrity rule or unsupported market gate was changed.

## State Machine

| Stage | State | Certification |
| --- | --- | --- |
| DISCOVERED | Stored slate exists and operating date is America/Puerto_Rico scoped. | PASS |
| SCHEDULE_READY | Stored `sport_events` are visible after canonical date filtering. | PASS |
| STATUS_READY | Protected `status_refresh` calls MLB Stats API schedule and records provider-check evidence. | PASS |
| MARKETS_PENDING | Missing/stale odds are explicit blockers. | PASS |
| MARKETS_READY | SportsDataIO odds refresh path requires provider-check evidence before success-no-change. | PASS |
| CONTEXT_READY | Starters/context remain partial; confirmed lineups and detailed injuries are unavailable. | NOT_APPLICABLE |
| PREDICTIONS_READY | Existing SportsDataIO preview path generates/reuses snapshots and predictions after valid inputs. | PASS |
| RECOMMENDATIONS_READY | Existing Current Board/recommendation policy gates remain intact. | PASS |
| PREGAME_COMPLETE | Pregame recommendations lock after start/status uncertainty. | PASS |
| LIVE_MONITORING | Status refresh can mark live from MLB Stats API; no elapsed-time final fabrication. | PASS |
| RESULTS_READY | MLB `sync_results` now uses MLB Stats API schedule/game feed and writes canonical final results. | PASS_LOCAL |
| SETTLEMENT_READY | Settlement waits for authoritative final results and is idempotent. | PASS |
| SETTLED | Existing scoped settlement can grade supported MLB markets. | PASS |
| PERFORMANCE_UPDATED | Performance surfaces read settled evidence. | PASS |
| LEARNING_UPDATED | Learning is sample-gated and may validly no-op. | PASS |
| COMPLETE | Complete requires results, settlement, performance and learning evidence after games finish. | NOT_APPLICABLE |

## Provider Ownership

| Domain | Provider | State | Notes |
| --- | --- | --- | --- |
| Schedule | MLB Stats API | PASS | Verified endpoint family; runtime status refresh uses schedule endpoint. |
| Game status | MLB Stats API | PASS | `status_refresh` calls `/api/v1/schedule?sportId=1&date=...&hydrate=probablePitcher,team,venue`. |
| Results | MLB Stats API | PASS_LOCAL | `sync_results` now delegates MLB final results to MLB Stats API; production evidence pending deployment. |
| Starting pitchers | MLB Stats API | PARTIAL | Status endpoint hydrates probable pitcher evidence, but feature path remains partial. |
| Team/player stats | SportsDataIO | PASS | Existing importer/preview path preserved. |
| Standings | SportsDataIO | PASS | Existing imported table path preserved. |
| Primary odds | SportsDataIO | PASS | Existing odds-refresh repair preserved. |
| Supplemental odds | The Odds API | NOT_APPLICABLE | Not used for primary MLB odds certification. |
| Confirmed lineups | None verified | NOT_APPLICABLE |
| Detailed injuries | Subscription blocked | NOT_APPLICABLE |
| Line movement | Not verified for live runtime | NOT_APPLICABLE |

## Runtime Evidence Requirements

Status refresh now reports:

- `providerCheckRequired`
- `providerCheckAttempted`
- `providerCheckCompleted`
- `providerCallsMade`
- `rowsReceived`
- `statusesChanged`
- `latestSourceTimestamp`
- `lastProviderCheckAt`
- `lastStatusChangeAt`
- `failureReason`

Odds refresh remains certified to report:

- provider-check evidence
- SportsDataIO endpoint evidence
- rows received
- snapshots compared
- changes detected
- rows inserted/updated/skipped
- source/check/change timestamps

## Scheduler Certification

| Item | State | Evidence |
| --- | --- | --- |
| Vercel cron | FAIL | `vercel.json` has one daily `0 12 * * *` run only. |
| Protected cron endpoint | PASS | `/api/cron/operating-day?dryRun=false`, `Authorization: Bearer <CRON_SECRET>`. |
| Adaptive protected endpoint | PASS | `/api/operations/adaptive-refresh?dryRun=false` delegates to operating-day executor. |
| External scheduler template | PASS | `.github/workflows/production-operating-day.yml` exists with 15-minute cadence and `CRON_SECRET`. |
| External scheduler active/secrets verified | FAIL | Scheduled execution and repository secret presence are not verifiable from this environment. |
| Overlap protection | PASS | Existing provider action locks reused. |
| Status cadence | FAIL | Once-daily Vercel cadence is insufficient without external scheduler activation. |
| Odds cadence | FAIL | Once-daily Vercel cadence is insufficient without external scheduler activation. |

Recommended protected call:

```text
POST https://pick-analyzer.vercel.app/api/cron/operating-day?dryRun=false
Authorization: Bearer <CRON_SECRET>
```

Recommended external cadence:

- Every 15 minutes with adaptive planner deciding whether any provider-backed work is due.

## Certification Matrix

| Section | Result | Notes |
| --- | --- | --- |
| Slate | PASS | Prior slate repair preserved. |
| Lifecycle | PASS | Stale status stays visible and locked. |
| Scheduler | FAIL | External multi-run automation prepared but not verified active. |
| Status refresh | PASS | New protected MLB Stats API status action added. |
| Odds refresh | PASS | Existing SportsDataIO provider-check repair preserved. |
| Prediction refresh | PASS | Existing preview path reuses/creates only when valid inputs exist. |
| Recommendation refresh | PASS | Existing policy gates preserved. |
| Current Board | PASS | Existing current-board candidate selection preserved. |
| AI Briefing | PASS | Existing intelligence surface summary refresh remains read-only. |
| Results | PASS_LOCAL | MLB results sync provider repaired to MLB Stats API; production evidence pending deployment. |
| Settlement | PASS | Existing scoped settlement remains idempotent. |
| Performance | PASS | Existing performance routes read settled evidence. |
| ROI | PASS | Available only from legitimate settled prediction economics. |
| CLV | PASS | No CLV fabricated without closing evidence. |
| Calibration | PASS | Sample-gated. |
| Learning | PASS | Sample-gated no-update is valid. |
| Freshness | PASS | Operations health separates freshness domains. |
| Health | PASS | Operations health separates platform/provider/projection/prediction and status-refresh evidence. |
| Caching | PASS | Operational routes remain no-store/dynamic. |
| Observability | PASS | Existing lifecycle ledger reused. |
| Production smoke | FAIL | Deployment was authorized but rejected by the execution environment before production smoke could run. |
| Local protected runtime smoke | PASS | `status_refresh` and `midday_refresh` executed against real providers for `2026-07-20`; page reads then made 0 provider calls and 0 mutations. |

## 2026-07-20 Protected Runtime Evidence

| Stage | Result | Evidence |
| --- | --- | --- |
| Status refresh | PASS | `SUCCESS_NO_CHANGE`, provider calls 1, remote mutations 28, rows received 15, rows updated 13, rows skipped 2, provider check attempted/completed true. |
| Odds refresh | PASS | `SUCCESS_CHANGED`, provider calls 3, remote mutations 195, SportsDataIO `GameOddsByDate/2026-07-20`, rows received 15, changes detected 90, rows inserted 90. |
| Slate readiness | PASS | `/api/slate/next/status`: selected slate `2026-07-20`, events found 15, ready for analysis 15, waiting for odds 0, active candidates 45. |
| Current Board | PASS | `/api/current-board`: candidate count 24, games 8, official picks 0, latest odds `2026-07-20T12:35:09+00:00`. |
| Today read | PASS | `/api/dashboard/today?includeValidation=true`: `AVAILABLE`, 15 cards, 0 provider calls, 0 remote mutations, total 1996ms, validation 27/27, errors none. |
| Temporal health | PASS | 15 games, legacy repair count 0, lifecycle distribution PREGAME 15, provider calls 0, remote mutations 0. |

## Runtime Blockers

1. Production deployment and smoke validation are not complete for this local commit because this continuation was explicitly no-deploy.
2. External intraday scheduler activation/secrets cannot be verified from the local workspace.
3. Confirmed lineups, detailed injuries and live line movement remain unsupported or unverified and must not be treated as available.

## Final Status

- MLB Runtime Certification: **PASS_LOCAL**
- Closed Beta Ready: **PENDING_DEPLOYMENT**
- Core Freeze Eligible: **PENDING_DEPLOYMENT_AND_SCHEDULER_VERIFICATION**
