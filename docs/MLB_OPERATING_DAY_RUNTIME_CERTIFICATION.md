# MLB Operating Day Runtime Certification V1

Date: 2026-07-19

## Summary

MLB runtime certification is **FAIL** for full unattended production operation. The local codebase now supports protected MLB Stats API `status_refresh`, canonical MLB Stats API `sync_results`, SportsDataIO odds freshness evidence, and a production GitHub Actions scheduler workflow. However, full certification remains blocked because the authorized Vercel production deployment was rejected by the execution environment before a deployment ID or production smoke evidence could be created.

No dashboard redesign, prediction formula, projection formula, Official Pick threshold, Best Value policy, champion state, V7 state, settlement formula, learning formula, projection integrity rule or unsupported market gate was changed.

## State Machine

| Stage | State | Certification |
| --- | --- | --- |
| DISCOVERED | Stored slate exists and operating date is America/Puerto_Rico scoped. | PASS |
| SCHEDULE_READY | Stored `sport_events` are visible after canonical date filtering. | PASS |
| STATUS_READY | Protected `status_refresh` calls MLB Stats API schedule and records provider-check evidence. | PASS |
| MARKETS_PENDING | Missing/stale odds are explicit blockers. | PASS |
| MARKETS_READY | SportsDataIO odds refresh path requires provider-check evidence before success-no-change. | PASS |
| CONTEXT_READY | Starters/context remain partial; confirmed lineups and detailed injuries are unavailable. | FAIL |
| PREDICTIONS_READY | Existing SportsDataIO preview path generates/reuses snapshots and predictions after valid inputs. | PASS |
| RECOMMENDATIONS_READY | Existing Current Board/recommendation policy gates remain intact. | PASS |
| PREGAME_COMPLETE | Pregame recommendations lock after start/status uncertainty. | PASS |
| LIVE_MONITORING | Status refresh can mark live from MLB Stats API; no elapsed-time final fabrication. | PASS |
| RESULTS_READY | MLB `sync_results` now uses MLB Stats API schedule/game feed and writes canonical final results. | PASS_LOCAL |
| SETTLEMENT_READY | Settlement waits for authoritative final results and is idempotent. | PASS |
| SETTLED | Existing scoped settlement can grade supported MLB markets. | PASS |
| PERFORMANCE_UPDATED | Performance surfaces read settled evidence. | PASS |
| LEARNING_UPDATED | Learning is sample-gated and may validly no-op. | PASS |
| COMPLETE | Complete requires results, settlement, performance and learning evidence. | FAIL |

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

## Runtime Blockers

1. Production deployment and smoke validation are not complete because the execution environment blocked the authorized Vercel deploy.
2. External intraday scheduler activation/secrets cannot be verified from the local workspace.
3. Confirmed lineups, detailed injuries and live line movement remain unsupported or unverified and must not be treated as available.

## Final Status

- MLB Runtime Certification: **FAIL**
- Closed Beta Ready: **NO** for unattended runtime automation
- Core Freeze Eligible: **NO**
