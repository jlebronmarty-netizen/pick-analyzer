# MLB Intelligence V2

## Implemented In This Patch

- Cron reliability returns `already_current` instead of forcing a redundant refresh when the slate is fresh.
- Automation status separates configured Vercel cron, external scheduler files and unverified external scheduler secrets.
- Current Board candidates now expose critical data completeness and conservative feature/data sufficiency scores.
- `/api/mlb/data-quality` provides a canonical read-only data-quality summary.

## Current Intelligence State

- selected slate: 2026-07-17
- scheduled games: 15
- games with odds/features/predictions: 15
- active predictions: 45
- Current Board previews: 21
- modeled-value previews: 2
- official picks: 0
- official recommendation readiness: blocked

TEX and MIA positive-value previews remain preview-only because confidence, calibration, production gate and critical-data completeness are insufficient.

## Not Activated

Moneyline V2, Run Line V2, Total V2, Confidence V2 and market expansion were not activated in production in this patch. Their required tests and data dependencies are documented in `docs/mlb-model-distributions-v2.md` and `docs/mlb-market-expansion-v1.md`.
