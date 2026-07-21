# Autonomous Execution

This document defines the module loop for future Codex sessions in Pick Analyzer.

## Module Loop

1. Read `AGENTS.md`.
2. Read `docs/PROJECT_STATUS.md`.
3. Read `docs/MASTER_ROADMAP.md`.
4. Select the first unfinished module whose prerequisites are complete.
5. Inspect related code, routes, components, services, migrations and docs.
6. Produce an internal implementation plan.
7. Implement the complete module using existing architecture.
8. Run focused validation for the touched services and endpoints.
9. Run `npm.cmd run build`.
10. Fix all errors.
11. Repeat until `npm.cmd run build` exits 0.
12. Update `docs/PROJECT_STATUS.md`, `docs/MASTER_ROADMAP.md` and relevant module docs.
13. Continue to the next eligible module only when explicitly operating in autonomous module mode.

## Safe Stop Conditions

Stop only for:

- Missing credentials or provider access that cannot be worked around safely.
- Destructive migrations or data changes that need explicit approval.
- Ambiguous business decisions where a conservative implementation would be misleading.
- External provider outage or quota exhaustion.
- Unrecoverable build failure after focused debugging and a clear explanation.

## Forbidden Actions

- Do not run `git reset --hard`, `git clean` or destructive recursive deletes without explicit approval.
- Do not revert user changes.
- Do not invent provider data, odds, injuries, lineups, scores or settled results.
- Do not duplicate existing services or core algorithms.
- Do not store secrets in docs, code comments, migrations or committed files.
- Do not start a new product module while performing verification or governance work.

## Migration Handling

- Prefer additive migrations: new tables, nullable columns, indexes, grants and non-destructive constraints.
- Include idempotent SQL where practical: `if not exists`, guarded `do $$` blocks and deterministic index names.
- Do not drop columns, rewrite historical rows or tighten constraints destructively without explicit approval.
- Verify that services and API routes match the remote schema after migration.
- If Supabase CLI is unavailable, provide exact SQL Editor instructions and record the blocker.

## Provider Quota Precautions

- Use incremental sync by default.
- Use small date ranges for smoke tests.
- Do not run full historical sync unless the module explicitly requires it and the user approves.
- Treat zero provider records as a valid external condition, not a reason to fabricate fixtures in production tables.
- Prefer read-only health/status endpoints before mutating sync or prediction state.
- For MLB operating-day work, run `/api/operating-day/execute` with `dryRun=true` first. Dry-runs must make zero provider calls.
- For MLB next-slate rollover, use `GET /api/slate/next/status` or `action=next_slate_preview` first. `prepare_next_slate` may call SportsDataIO only when authenticated, `confirmed=true`, `dryRun=false`, budget permits the call count and the action is explicitly approved.
- For MLB odds coverage reconciliation, run `GET /api/mlb/odds/coverage?date=YYYY-MM-DD&includeValidation=true` first. This diagnostic must remain read-only and report providerCallsMade 0.
- For MLB unresolved player identities, run `GET /api/mlb/players/unresolved-identities?season=YYYY` first. The route is read-only by default, must report providerCallsMade 0, and write mode may only create provisional `unresolved_player` mappings or apply exact trusted player mappings.
- For MLB current-season data-quality work, run `GET /api/mlb/current-season/data-quality?season=YYYY&includeValidation=true`. This audit must remain stored-data-only, report providerCallsMade 0 and remoteMutationsMade 0, preserve low scores honestly and avoid fuzzy identity resolution.
- Do not run broad `/api/predictions/settle` for a daily operating-day workflow. Use `/api/operating-day/[operatingDayId]/settle` so settlement remains scoped and idempotent.
- If result sync returns `quota_blocked`, leave the day pending and do not settle unresolved events.

## Progress Reporting

- Report what is being inspected, what was learned and what will be changed.
- Keep updates concise while working.
- Final reports must include files changed, validation results, build result and blockers.

## Completion Rule

No module may be left partially implemented. If a blocker prevents completion, document the exact blocker, the safe state of the repository and the next concrete action.
