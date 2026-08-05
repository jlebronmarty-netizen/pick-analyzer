# Mission Control Checklist

Use this checklist before starting any queued mission.

## Repository Alignment

- Confirm branch is `main`.
- Confirm local HEAD matches `origin/main`.
- Confirm the latest certified commit is known.
- Confirm protected unrelated dirty files are not staged.
- Confirm no unexpected files are staged.

## Evidence Review

- Read `START_HERE.md`.
- Read `docs/PROJECT_STATUS.md`.
- Read `docs/MASTER_ROADMAP.md`.
- Read the active mission document.
- Read all required certification JSON artifacts.

## Mission Scope

- Identify the mission ID.
- Confirm the category, priority, mode and readiness.
- Confirm dependencies are complete.
- Confirm blockers are understood.
- Confirm the mission has a bounded validation plan.

## Stop Conditions

- Check hard stops.
- Check provider blocks.
- Check sport blocks.
- Check external waits.
- Check human-approval requirements.
- Stop if any condition applies.

## Execution Rules

- Do not restart completed releases.
- Do not change prediction behavior unless explicitly authorized.
- Do not call providers unless explicitly authorized.
- Do not mutate data unless explicitly authorized.
- Do not start the next mission until the current mission is certified.

## Certification

- Run targeted validator first.
- Run broader validators only after targeted checks pass.
- Run build for runtime changes.
- Commit only intended files.
- Push once.
- Observe automatic deployment only.
- Verify production read-only endpoints.

## Latest Mission Certification

- MC-00: `PRODUCTION_CERTIFIED`.
- MC-01: `PRODUCTION_CERTIFIED`.
- MC-02: `PRODUCTION_CERTIFIED`.
- MC-03: `PLANNED` and manual-only; not started.
- MC-08: `ACTIVE` through bounded product-experience work packages.
- MC-08A: `PRODUCTION_CERTIFIED`.
- MC-08B: `PRODUCTION_CERTIFIED`.
- MC-08C: `PRODUCTION_CERTIFIED`.
- MC-08D: `PRODUCTION_CERTIFIED`.
- MC-08E-R: `PRODUCTION_CERTIFIED`; preserved paused work recovered, deployed and production-render certified.
- MC-08F: `PRODUCTION_CERTIFIED`; personalization is display-only. MC-08G requires explicit instruction and MC-03 remains manual-only.
- MC-08G: `PRODUCTION_CERTIFIED`; product polish and coherence review is complete.
- MC-08H: `PRODUCTION_READINESS_BLOCKED`; production pilot is not ready until sustained scheduler cadence is proven. MC-03 remains manual-only.
- OR-01: `PRODUCTION_CERTIFIED`; operational readiness recovery is closed.
- OR-01A: blocked by sustained scheduler cadence.
- OR-01B: workflow/app-ledger reconciliation is certified by scheduled run `31003990142` and durable heartbeat invocation `cf420831-ad95-4943-83a7-326d9fdad5d7`.
- OR-01C: `PRODUCTION_CERTIFIED`; settlement scope repair is deployed and older result-recovery debt is non-blocking.
- OR-01D: automatic scheduled run `31015257795` was observed, but sustained cadence is blocked by missing subsequent ticks.
- OR-01E: `MIXED_SCHEDULER_AND_PLANNER_DEFECT`; `/api/operations/planner-trace` documents the planner/route policy, and Production Pilot Week remains NOT READY.
- OR-01F: `PRODUCTION_CERTIFIED`; bounded planner-continuity repair limits each invocation to one provider action and safe internal closure continuation only.
- P1.3: `PRODUCTION_CERTIFIED`; separates production evaluation from recommendation gates prospectively.
- P1.4: `PRODUCTION_CERTIFIED`; post-P1.3 protected production execution persisted 24 production-evaluable MLB rows with production evaluation policy.
- P2.0: `PRODUCTION_CERTIFIED`; Current V2 Production is active.
- P2.1: `PRODUCTION_CERTIFIED`; comprehensive supported-market prediction coverage is bounded to current supported MLB markets.
- P2.1A: `PRODUCTION_CERTIFIED`; canonical model prediction granularity is event-market, while provider-side selections remain contextual.
- P2.2A: `PRODUCTION_CERTIFIED`; Performance presentation labels total analyzed rows separately from canonical predictions.
- P2.2: `WAITING_FOR_EXTERNAL_EVIDENCE`; current canonical rows must complete and close before P2.2 can pass.
- P2.3: `BLOCKED_BY_P2_2`; do not start.

## P2.4 Cross-Surface Epoch And Performance Consistency

- [x] Local validator created.
- [x] E2E integrity exposes `surfaceConsistency`.
- [x] Current Era and Replay equations are explicit.
- [x] Production deployment certification complete.
- [x] MC-08E was safely resumed as MC-08E-R after paused-work preservation.
- [x] MC-03 was not started.

## MC-08F Personalization Experience

- [x] Typed `personalization_v1` contract created.
- [x] Settings route created at `/settings`.
- [x] Homepage and Performance read display preferences only.
- [x] Production deployment certification complete.
- [x] MC-08G was not started.
- [x] MC-03 was not started.

## MC-08G Product Polish And Coherence Review

- [x] Product surfaces reviewed for wording, hierarchy, navigation and state clarity.
- [x] Low-risk copy and navigation coherence repairs applied.
- [x] Prediction, recommendation, settlement, learning, scheduler, provider, Replay and Current Era behavior unchanged.
- [x] Production deployment certification complete.
- [x] MC-08H was not started.
- [x] MC-03 was not started.

## MC-08H Production Readiness Certification

- [x] Final product audit completed from repository and production evidence.
- [x] Critical operations blockers identified.
- [x] Production Ready decision recorded as NO.
- [x] Production Pilot Week recorded as NOT READY.
- [x] MC-03 was not started.

## OR-01E Adaptive Planner Behavioral Audit

- [x] Planner action inventory documented.
- [x] Route loop policy documented.
- [x] Starvation scenarios classified.
- [x] Protected read-only planner trace route added.
- [x] Scheduler cadence, provider budgets, prediction, settlement and learning behavior unchanged.
- [x] Production Pilot Week remains NOT READY.
- [x] MC-03 was not started.

## OR-01F Bounded Planner Continuity

- [x] `planner_continuity_v1` policy added.
- [x] Max actions remain 3.
- [x] Max provider actions per invocation is 1.
- [x] Repeated action guard added.
- [x] Planner recomputation after material action added.
- [x] Safe internal continuation limited to `settle`.
- [x] Scheduler cadence, provider budgets, prediction, settlement and learning math unchanged.
- [x] Production Pilot Week remains NOT READY.
- [x] MC-03 was not started.
