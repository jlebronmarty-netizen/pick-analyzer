# NBA-03A Shadow Scheduler Runnable Harness

Status: `NBA_03A_SHADOW_SCHEDULER_RUNNABLE_HARNESS_CERTIFIED_READY_FOR_ACTIVATION_CANARY`

This phase converts the prior NBA shadow scheduler preparation contract into a protected runtime harness. It does not activate the scheduler, add a Vercel cron declaration, set the enable flag, run the natural canary, or write new production `CURRENT_ERA_SHADOW` rows.

## Root Cause

The previous scheduler preparation phase documented the activation rules and simulated the guardrails, but production did not yet have a runnable protected NBA scheduler route. `vercel.json` still contained only `/api/cron/operating-day`, and the NBA Current Era Shadow path only exposed manual dry-run/write-one scripts. Natural Vercel Cron activation would therefore have had no route-level orchestration, run counter, audit ledger, provider-budget gate, or automatic two-run review boundary.

## Runtime Route

Route: `/api/cron/nba-current-era-shadow`

Methods: `GET`, `POST`

Authentication: canonical `CRON_SECRET` behavior. If `CRON_SECRET` is configured, the route requires `Authorization: Bearer <secret>` or `?secret=<secret>`. Unauthenticated requests fail closed with HTTP 401.

Default-off flag: `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED`

Disabled behavior: unset or `false` returns `SCHEDULER_DISABLED_NO_OP` before lock acquisition, provider calls, audit writes or prediction writes.

## Authority

Future scheduler authority: Vercel Cron.

Cron declaration: deferred. `vercel.json` is intentionally unchanged in this phase, so no natural scheduler invocation begins after deployment. The route can be published and production-aligned first, then a separate activation canary can add the cron or invoke the existing deployment mechanism according to the next authorization.

## Bounds

Per-run cap: 3 new logical rows.

Review boundary: after 2 completed scheduler canary runs.

Hard maximum: 4 completed scheduler canary runs.

Total canary row cap: 12 new rows.

Pending guard: 75 pending `CURRENT_ERA_SHADOW` rows.

When the review boundary, hard limit, row cap or pending guard is reached, the route stops before provider calls or prediction writes.

## Pipeline

1. Request/auth.
2. Verify `NBA_CURRENT_ERA_SHADOW_SCHEDULER_ENABLED`.
3. Acquire `nba_current_era_shadow_scheduler` lock through the existing provider-action lock primitive.
4. Read canary state from `sports_sync_jobs`.
5. Enforce review/hard limits.
6. Count pending Current Era Shadow rows.
7. Check The Odds API provider budget.
8. Run bounded NBA odds sync.
9. Run `NBA_CURRENT_ERA_SHADOW_CANARY_V1` dry-run.
10. Exclude existing logical rows through existing canary gates.
11. Select with `NBA_03A_CROSS_EVENT_SHADOW_ACCUMULATION_POLICY_V1`.
12. Apply per-run cap.
13. Persist selected rows through certified `write-one` deterministic persistence.
14. Read back counts.
15. Write audit summary to `sports_sync_jobs`.
16. Release lock.

## Provider Budget

The Odds API: max 2 calls/run, 4 calls/hour, 48 calls/day.

SportsDataIO: 0.

Historical odds: 0.

Provider budget exhaustion returns `PROVIDER_BUDGET_NO_OP`.

## Fail-Closed Outcomes

- `SCHEDULER_DISABLED_NO_OP`
- `LOCK_CONFLICT_NO_OP`
- `CANARY_REVIEW_REQUIRED_NO_OP`
- `CANARY_HARD_LIMIT_REACHED_NO_OP`
- `PENDING_GUARD_NO_OP`
- `PROVIDER_BUDGET_NO_OP`
- `NO_CURRENT_EVENT_NO_OP`
- `NO_ELIGIBLE_CANDIDATE_NO_OP`
- `PROVIDER_FAILURE_BLOCKED`
- `PERSISTENCE_FAILURE_BLOCKED`

## Isolation

The harness is generation-only. It does not settle predictions, activate NBA Official Picks, expose recommendations, change production eligibility, trigger learning/calibration, touch bankroll, send notifications, mutate Historical Replay, or modify MLB.

Every generated row must remain:

- `prediction_origin = CURRENT_ERA_SHADOW`
- `model_role = shadow`
- `is_current = false`
- `recommended_pick = false`
- `production_eligible = false`
- product-visible = false

## Future Activation

Activation remains separately authorized. The next phase should publish/deploy this harness, verify `/api/system/version`, then separately authorize a two-natural-run activation canary. The scheduler must be disabled again after the two-run review point before any continuous operation decision.
