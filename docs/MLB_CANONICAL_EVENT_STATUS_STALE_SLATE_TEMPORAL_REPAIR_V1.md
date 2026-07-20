# MLB Canonical Event Status, Stale Slate Recovery & Temporal Truth Repair V1

Date: 2026-07-19

## Result

Status: PASS_LOCAL

This repair fixes the production runtime blocker where MLB Stats API statuses could be written directly into `sport_events.status`, violating the existing database check constraint. It also prevents stale unresolved slates outside the recovery window from monopolizing the operating day and restores per-card temporal diagnostics for SportsDataIO MLB start times.

## Status Constraint

The existing `sport_events.status` constraint allows only:

- `scheduled`
- `live`
- `completed`
- `postponed`
- `cancelled`

No migration is required. The application now maps MLB Stats API provider statuses through `src/services/mlb-event-status-mapper.service.ts` before any MLB Stats status/result write reaches `sport_events`.

Provider raw status remains in metadata. Unsupported provider statuses are skipped per row with typed mapping evidence instead of failing the whole provider check.

## Runtime Behavior

- MLB Stats API `Final` now persists as `completed`, not `final`.
- MLB Stats API live/in-progress states persist as `live`, not `in_progress`.
- MLB Stats API canceled states persist as `cancelled`, not `canceled`.
- Delayed/suspended MLB states persist as `postponed` because the DB has no delayed/suspended status; raw lifecycle evidence remains in metadata.
- `SUCCESS_NO_CHANGE` remains legal only after a completed provider check.
- Mapping or row-update failures return partial evidence and allow valid rows to progress.

## Stale Slate Recovery

The operating-date resolver now uses Puerto Rico local calendar date as the operational primary date. Prior unresolved slates can preempt only inside the explicit recovery window, currently 2 days. Older unresolved rows are surfaced as `STALE_ORPHAN_EXCLUDED` diagnostics and do not capture status refresh, odds refresh, or action advancement.

New resolver evidence includes:

- `operationalPrimaryDate`
- `recoveryCandidateDate`
- `recoveryWindowDays`
- `recoveryClassification`
- `excludedStaleOrphanCount`
- `oldestUnresolvedDate`
- `unresolvedEventsByDate`

## Temporal Truth

SportsDataIO MLB `DateTime` rows are interpreted as `America/New_York` when provider identity is available from metadata or `provider_ids`. MLB Stats API UTC instants remain UTC. The dashboard formats canonical UTC into `America/Puerto_Rico` exactly once.

Regression example:

- Stored legacy value: `2026-07-19T12:15:00.000Z`
- SportsDataIO interpretation: `2026-07-19 12:15 PM America/New_York`
- Canonical UTC: `2026-07-19T16:15:00.000Z`
- Puerto Rico display: `Sun, Jul 19, 12:15 PM AST`

Each game card now exposes provider/time diagnostics including stored start time, normalized UTC, display timezone, interpretation mode, temporal confidence and warnings.

## Validation

- Provider calls made locally: 0
- Remote mutations made locally: 0
- Build: `npm.cmd run build` PASS
- Deployment: not performed in this repair pass

## Remaining Work

Production deployment and one protected smoke test are still required to replace the previously observed production HTTP 207 status-refresh failure with live provider evidence.
