# MLB Architecture

Status: Production Stable
Version: MLB Production Complete v1.0.0
Freeze Date: 2026-07-18

## Architecture Summary

The MLB platform is complete as a production-stable, provider-limited sports intelligence and recommendation platform. The system is built on the existing Pick Analyzer architecture and is now frozen for major MLB architecture changes.

Core layers:

- Dashboard and product surfaces: `/dashboard`, Current Board, Most Likely, Best Value, AI Bet Finder, Betting Workbench, Arbitrage and Advanced Details.
- Current Board: `current-board.service.ts` owns current champion-row surfaces and official/informational category separation.
- Prediction platform: MLB V5 champion/current rows remain production-facing. V6/V7 are challenger/shadow/guardrail surfaces only and are not promoted.
- Provider layer: SportsDataIO MLB routes, budget tracking, checkpoint/ledger storage, capability audit and explicit provider limitations.
- Operating day layer: operating-day lifecycle, next-slate rollover, automation status, cron and protected execution routes.
- Feature layer: Feature Store Core, MLB Feature Store integration, starter/weather/stadium context, missing-intelligence health and player metadata cache.
- Settlement/learning layer: settlement core, scoped operating-day settlement, replay, calibration and learning readiness remain policy-owned and sample-size gated.
- Observability layer: runtime observability, sync reliability, provider budget, operations center and daily operations status.

## Frozen Boundaries

The following MLB boundaries are frozen for v1.0.0:

- Official-pick thresholds.
- Champion model ownership and `is_current` behavior.
- Current Board official/informational separation.
- Provider budget/checkpoint strategy.
- Settlement policy.
- Learning and calibration policy.
- Automation lifecycle stages.
- Dashboard architecture.

Future MLB work is limited to bug fixes, provider upgrades, UI polish, performance improvements and security updates.

## No New Architecture Needed

No major MLB architecture blockers remain. Current limitations are data/provider limitations, not platform architecture gaps.