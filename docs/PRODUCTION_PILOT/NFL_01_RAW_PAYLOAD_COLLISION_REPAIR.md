# NFL-01 Raw Payload Collision Repair

Status: `NFL_01_BALLDONTLIE_RAW_PAYLOAD_COLLISION_REPAIR_CERTIFIED_READY_FOR_PROBE`

Date: 2026-08-16

Starting commit: `566d8c3038d3ac3e7c9196dbcb1b9eb63ace9e0c`

## Collision Root Cause

The local BallDontLie NFL probe wrote a valid teams payload to:

`data/imports/balldontlie/nfl/probe/01_teams.json`

The checkpoint recorded:

- request: `bdl_nfl_probe_teams_all`
- cursor: `0`
- completed: `false`

The provider response had an empty `meta` object. The executor bug was `nextCursor()`: it converted `null` to number `0`, so a non-paginated completed response was treated as an incomplete cursor chain. A retry then targeted the same probe teams raw file.

The collision guard was also too strict for idempotent reuse because it hashed the full storage envelope, including volatile capture metadata such as `retrievedAt` and rate-limit headers. A deterministic same request with the same provider payload could therefore look different at the envelope level.

## Existing Data Classification

The existing target is a legitimate BallDontLie NFL teams provider payload:

- status: `200`
- records: `32`
- sport: `americanfootball_nfl`
- provider: `balldontlie`
- endpoint: `/nfl/v1/teams`
- payload meta: empty object

It is not a fixture, dry-run artifact, certification artifact, NBA artifact, placeholder or malformed file. It was preserved and not deleted.

## Repair

The executor now:

- treats `null`, missing or empty `meta.next_cursor` as terminal;
- reconciles existing checkpoint raw payloads before selecting next work;
- reuses valid existing raw payloads without another provider call;
- hashes stable provider/request/payload identity separately from volatile capture metadata;
- keeps true different-content collisions blocked;
- uses atomic raw writes so interrupted `.tmp` files cannot masquerade as valid payloads;
- gives cursor pages distinct paths even when a raw destination lacks `*`.

After repair, local storage preflight reports:

- existing teams payload identity valid;
- teams checkpoint row completed after reconciliation;
- next work: `bdl_nfl_probe_games_2025`;
- next raw path: `data/imports/balldontlie/nfl/probe/02_games.json`;
- next raw path exists: `false`;
- provider calls during repair: `0`;
- production database mutations: `0`.

## Retry Boundary

The next authorized action is to retry only the bounded probe command. Do not run P0 until the probe completes successfully.
