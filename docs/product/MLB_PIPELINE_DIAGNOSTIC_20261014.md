# MLB pipeline diagnosis — 2026-10-14

Status: READ_ONLY_DIAGNOSIS_COMPLETE; operational repair and recertification pending. Mobile and production promotion remain paused.

## Confirmed blocker

Production deployment `dpl_DbVRQus7WaMxvTkrvHfSzpNe33Tj` serves main commit `f7e5f5694660bc97e1d8946271bc277c995d0947`. An isolated archive of that exact commit reproduces `R2T_LIVE_BLOCKED:R3_SOURCE_DRIFT:scripts/mlb-data-02h-2026-current-foundation.mjs` when calling the canonical readiness checker. This gate executes before schema preflight, durable acquisition and provider calls. The route sanitizes this exception to HTTP 503 `MLB_OPERATIONAL_EXECUTION_BLOCKED` if invoked with valid authentication. No live route was invoked in this review.

The R3 certificate checks 37 files; two differ: `scripts/mlb-data-02h-2026-current-foundation.mjs` and `scripts/mlb-data-02r-r2t-r1-read-repository.mjs`. The subsequent nonempty readiness certificate checks 73 files; four differ (foundation, operational read service, MlbCards and mlb-presentation). Exact expected/actual hashes are in the JSON receipt. These mismatches already exist on main; they are not caused by this UI branch.

## Stored operational evidence

The latest durable run update is September 22 at 15:15:48.012 UTC. The last champion prediction is September 22 at 15:00:10.346 UTC. Today's stored game 849811 has zero champion predictions, zero market observations and zero official picks. The dashboard therefore correctly displays no actionable official recommendation.

The historical mission counter is 20/20. A distinct operational ledger contains 22 reservations, latest September 22 at 15:15:26.634 UTC. Do not conclude that historical cap alone blocks the currently deployed authority; the active authority and remaining daily allowance still need read-only verification before any acquisition.

Vercel runtime queries returned no recent operational events; one broad query timed out. A one-hour grouped query returned only two statcast events. This does not establish whether cron scheduling, authentication, or retention also contributes. Production is READY, which does not certify the operational pipeline.

## Repair sequence

1. Review each changed certified source against its last approved semantics, including postseason eligibility and temporal provenance. Recover the old Git objects before diffing; the local shallow clone does not contain the September runtime SHA.
2. Run the existing provider-free readiness, provenance, scope, recovery, model-parity and budget regressions against the proposed code. Preserve model, policy, feature meanings and immutable ledgers.
3. Issue fresh certification only after those checks pass. Do not bypass gates, remove hashes, or overwrite old receipts to make the check green. Keep presentation certification from silently invalidating unrelated operational readiness.
4. Inspect actual scheduled request delivery/authentication and deployed Edge budget authority without exposing credentials. Prepare a bounded activation/readback plan with explicit provider allowance and idempotency.
5. Present the reviewed repair before production release. A future real run must prove fresh prediction, market lineage and decision readback; an empty valid selection remains acceptable. Do not manufacture picks or backdate forecasts.

## Reproduction

`node scripts/verify-mlb-production-readiness-drift.mjs f7e5f5694660bc97e1d8946271bc277c995d0947`

Expected exit 2 and the documented source-drift blocker. The script only reads local Git objects and uses the pure certificate verifier; no database requests or provider calls. The canonical checker was also run from a separate full archive of production with the same result. No production state, credentials, counters, schedules or models were changed.
