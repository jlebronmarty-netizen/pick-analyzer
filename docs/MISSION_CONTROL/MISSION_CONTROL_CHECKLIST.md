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
- MC-08E: `READY`; not started.
- P1.3: `LOCAL_IMPLEMENTATION_PENDING_PRODUCTION_DEPLOYMENT`; separates production evaluation from recommendation gates prospectively.
- P2.0: blocked until P1.3 production certification passes.
