# NFL-01 Windows Executor Shutdown Repair

Status: `NFL_01_BALLDONTLIE_WINDOWS_EXECUTOR_SHUTDOWN_REPAIR_CERTIFIED`

Date: 2026-08-16

Starting commit: `02a20dc8d7c94848cfb1f3323e4566d9901dc132`

## Diagnostic Summary

The bounded team-stats probe resume printed a successful executor result and then the Windows Node process terminated with:

`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`

The durable output was preserved before shutdown:

- `data/imports/balldontlie/nfl/probe/03_team_stats.json`
- status `200`
- records `100`
- `meta.next_cursor = 112`
- checkpoint updated
- accounting updated

The remaining probe entry is therefore expected: `team_stats` requires at least one additional cursor page. P0 is not ready until that cursor chain completes.

## Root Cause

The executor used direct `process.exit(...)` calls from inside the async `main()` path after fetch/timeout/AbortController work. On Windows this can terminate Node while libuv/undici async handles are still closing, producing the observed `UV_HANDLE_CLOSING` assertion after JSON output has already printed.

The repair removes forced process termination and lets Node drain naturally:

- command branches return an exit code;
- the top-level promise sets `process.exitCode`;
- unhandled top-level errors set `process.exitCode = 1`;
- provider semantics, rate limits, queue order, raw identity and checkpoint behavior are unchanged.

## Current Team Stats State

Current raw payload:

`data/imports/balldontlie/nfl/probe/03_team_stats.json`

State:

- endpoint: `/nfl/v1/team_stats`
- season: `2025`
- status: `200`
- records: `100`
- next cursor: `112`
- schema: usable and safely preserved
- raw identity: valid

Next request, not yet authorized here:

- request: `bdl_nfl_probe_team_stats_2025`
- cursor: `112`
- target: `data/imports/balldontlie/nfl/probe/03_team_stats.cursor-112.json`

## Safety

This repair made:

- BallDontLie provider calls: `0`
- The Odds API calls: `0`
- production database mutations: `0`
- MLB runtime changes: `0`
- NBA runtime changes: `0`

Do not start P0 until team_stats pagination completes and the shutdown repair is published/aligned.
