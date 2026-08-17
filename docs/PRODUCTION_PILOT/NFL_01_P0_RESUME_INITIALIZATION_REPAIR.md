# NFL-01 P0 Resume Initialization Repair

Status: `NFL_01_BALLDONTLIE_P0_RESUME_INITIALIZATION_REPAIR_CERTIFIED`

The BallDontLie NFL GOAT trial is active. The completed probe consumed 10 cumulative provider calls and captured teams, games and team_stats raw payloads. The first P0 launch made 0 provider calls and stopped before acquisition because the executor attempted to resume P0 from a checkpoint that only contained completed probe request IDs.

## Root Cause

`scripts/nfl-01-balldontlie-historical-import-readiness.mjs` selected the first P0 queue entry, `bdl_nfl_teams_all`, but the existing checkpoint only had probe IDs such as `bdl_nfl_probe_teams_all`. `nextWork` returned a missing state and the next raw-reuse step attempted to read `state.cursor`.

## Repair

Checkpoint loading now reconciles existing raw payloads and then merges missing queue entries into the checkpoint. Existing probe entries are preserved. Missing P0 entries are initialized with the canonical checkpoint fields:

- `requestId`
- `season`
- `feed`
- `cursor: null`
- `recordsCaptured: 0`
- `requestsUsed: 0`
- `successfulPayloads: 0`
- `completed: false`
- `status: PLANNED`
- `rawPayloads: []`
- `failures: []`

The live P0 preflight initialized 21 P0 entries alongside the 3 completed probe entries, leaving request accounting unchanged at 10 cumulative calls.

## Reuse Decision

Probe payloads remain preserved, but P0 does not copy probe calls into P0 per-entry state. Reuse remains limited to exact request identity and raw payload identity. The first P0 work item remains `bdl_nfl_teams_all`, because its P0 raw namespace differs from the probe raw namespace.

## Certification

- Provider calls during repair: 0
- Production database mutations: 0
- Probe entries preserved: 3
- P0 entries initialized: 21
- First P0 work: `bdl_nfl_teams_all`
- P0 resume ready: YES

The next authorized action is the same certified P0 resume command. Do not start P1 automatically.
