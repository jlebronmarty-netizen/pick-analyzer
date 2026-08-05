# OR-01F Bounded Planner Continuity

Status: implemented pending production proof.

OR-01F applies the approved architecture decision from OR-01E: reduce dependence on repeated external scheduler ticks by allowing the protected operating-day invocation to continue only through safe internal closure actions after the first selected action.

## What Changed

- Added `planner_continuity_v1` to `/api/cron/operating-day`.
- The route now records an action chain with action sequence, state change, provider calls, mutations, planner recomputation, stop reason and cap usage.
- After a successful material action, the route recomputes planner state with a read-only dry-run preview.
- The route continues only when the next action is internal and safe: currently `settle`.
- The route stops before a second provider-backed action.
- The route stops when the same action identity repeats.

## What Did Not Change

- Scheduler cadence.
- GitHub workflow cron.
- Provider limits and protected reserves.
- Prediction formulas.
- Recommendation gates and Official Pick policy.
- Settlement math.
- Learning math.
- Current Era and Replay boundaries.
- Health thresholds.

## Expected Impact

Market preparation no longer blindly requires another external tick when a safe internal closure action is immediately due after recomputation. Result closure can still complete `sync_results -> settle -> learning/performance` in one protected invocation. Repeated market refreshes still require future scheduler delivery.

This repair reduces scheduler dependency but does not prove GitHub Actions as a reliable primary scheduler.
