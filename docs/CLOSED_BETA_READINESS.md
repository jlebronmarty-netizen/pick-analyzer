# Closed Beta Readiness

Status: Limited
Version: V1
Last updated: 2026-07-19

## Objective

This checklist measures whether the existing Pick Analyzer production system is stable enough for monitored external closed beta use.

It does not change prediction formulas, projection formulas, Official Pick thresholds, champion rows, V7 status, settlement, learning, provider acquisition, Current Board policy or Projection Integrity.

## Current Production Blockers

| Blocker | Status | Evidence | Required resolution |
| --- | --- | --- | --- |
| `odds_not_current` | Repair implemented; production validation pending | `/api/operations/health` reports degraded operations until a protected provider-backed check succeeds or reports an exact provider/scheduler blocker. | Run one controlled protected adaptive refresh when market work is legitimately due. |
| Today dashboard temporary unavailable | Repair implemented; production validation pending | User Mode can now render typed partial data when optional insights or degraded operations are unavailable. | Deploy and validate repeated `/dashboard` and `/api/dashboard?mode=today` loads. |
| User-visible projections `0` | Active but correct | Projection Integrity blocks unsafe rows; `/api/mlb/projections/health` reports blocked projections and zero user-visible rows. | Activate automatically only when identity, starter/participation, feature quality, data sufficiency, unit and plausibility gates pass. |
| Intraday scheduler cadence | Limited | `vercel.json` contains the consolidated daily operating-day cron; protected adaptive execution is available for manual/external scheduler use. | Add a monitored external cadence or Vercel plan/cadence that supports intraday refreshes. |
| MLB runtime results provider | Code-ready / production validation pending | Status refresh and MLB `sync_results` now use MLB Stats API in local code. | Deploy and smoke-test canonical final-result ingestion in production before unattended runtime certification. |
| Confirmed lineups | External limitation | No verified lineup provider is enabled. | Keep unavailable; do not infer lineup absence. |
| Detailed injuries | Provider-plan limitation | Roster status is available, detailed injury diagnosis/return is not. | Keep subscription-blocked until provider plan changes. |

## Readiness Scores

| Area | Score | Status | Notes |
| --- | ---: | --- | --- |
| Architecture | 90 | Strong | Core services are shared and registry-driven. |
| Operations | 70 | Limited | Protected execution exists; odds freshness remains degraded. |
| Scheduler | 55 | Limited | Daily cron exists; intraday cadence requires an external scheduler or plan change. |
| Provider Health | 75 | Limited | Providers verified; current odds freshness is not current. |
| Current Board | 70 | Limited | Board reflects stored candidates and freshness; stale odds block trustworthy beta action. |
| Projection Engine | 45 | Blocked | Integrity correctly blocks all user-visible projections today. |
| Prediction Engine | 70 | Limited | Existing candidates are stored; official policy remains unchanged. |
| User Experience | 78 | Limited | User Mode now avoids misleading Ready states and has partial-failure handling for Today sections. |
| Performance | 70 | Limited | Heavy diagnostics remain Advanced Details only. |
| Reliability | 70 | Limited | Health and protected execution are observable; intraday proof is incomplete. |
| Security | 85 | Strong | Protected mutations require `CRON_SECRET`; read routes expose no secrets. |
| Observability | 80 | Strong | Operations Health separates platform, provider, projection and prediction health. |
| Deployment | 90 | Strong | Build and Vercel production deploy pass. |
| Documentation | 85 | Strong | Operations, refresh, budget, cache and runbook docs exist. |

Overall Closed Beta Readiness Score: 70 / 100.

Production Readiness Score: 65 / 100.

## Decision

Closed Beta is not fully ready for unattended operation while production still lacks a deployed runtime activation build, verified intraday scheduler activation and production smoke evidence. Status refresh and MLB final-result sync are now MLB Stats API-backed in local code, but external users should not be told the operating-day runtime is fully automatic until scheduler, odds, results, settlement and performance evidence all pass in production.

## Regression Guardrails

- Prediction formulas unchanged.
- Projection formulas unchanged.
- Projection Integrity unchanged except for added blocker explanations.
- Official Pick thresholds unchanged.
- Champion rows unchanged.
- V7 not promoted.
- Settlement unchanged.
- Learning unchanged.
- Provider integrations reused.
- Current Board policy unchanged.
- Temporal Truth unchanged.
- Today page load remains read-only with zero provider calls and zero mutations.
