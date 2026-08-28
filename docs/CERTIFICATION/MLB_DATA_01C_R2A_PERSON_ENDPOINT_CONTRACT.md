# MLB-DATA-01C-R2A MLB Official Person Endpoint Contract

Certification verdict: `MLB_DATA_01C_R2A_MLB_OFFICIAL_PERSON_ENDPOINT_CERTIFIED`

Generated artifact: `docs/CERTIFICATION/mlb-data-01c-r2a-person-endpoint-contract.json`

## Scope

R2A performed exactly four authorized read-only MLB Official / MLB Stats API calls:

- Three single-person probes using `GET /api/v1/people/{personId}`.
- One bulk-person probe using `GET /api/v1/people?personIds=434378,455117,500743`.

No `provider_entity_mappings` rows were persisted, no raw canonical mapping columns were written, no canonical players were created, no features/models/predictions were generated, no 2026 import started, no automation was activated and no cron changed.

## Probe Set

The probe set was selected from the certified 2025 Statcast source inventory:

- `434378`: pitcher-only.
- `455117`: batter-only.
- `500743`: both-role.

Names remain audit-only evidence and are not identity keys.

## Single-Person Contract

`GET /api/v1/people/{personId}` returned HTTP 200 for all three selected source MLBAM IDs. Each response exposed a top-level `people` array with exactly one row, and `people[0].id` equaled the requested `personId`.

Certified result: `MLB_OFFICIAL_SINGLE_PERSON_ENDPOINT_CONTRACT = PASS`

Minimum identity field readiness: `MLB_OFFICIAL_PERSON_MINIMUM_IDENTITY_FIELDS_READY = YES`

Reliably present in the three probes:

- `id`
- `fullName`
- `firstName`
- `lastName`
- `primaryPosition`
- `batSide`
- `pitchHand`
- `active`

`currentTeam` was not present in the unhydrated single-person responses and is optional metadata, not an identity blocker.

## Bulk Contract

The bounded bulk probe using the same three IDs returned HTTP 200 with a top-level `people` array containing exactly the three requested IDs, no unexpected identities and unique response IDs.

Bulk state: `SUPPORTED`

Ordering dependency: `NO`. Future consumers must match by response `id`, not array position.

Maximum verified batch size: `3`

Production acquisition batch size is not maximized. The value 3 is verified by this phase but is not claimed as an API maximum.

## Future Player Call Plan

With the verified 3-ID bulk contract, the conservative planned call count for all 1,469 source MLBAM players is:

`ceil(1469 / 3) = 490`

This count is before cache and existing crosswalk reuse. Future execution must pre-read local acquisition cache and `provider_entity_mappings` to avoid unnecessary repeat calls.

## Failure Contract

Future acquisition must quarantine or fail closed on empty `people`, HTTP 404, 429 after one retry, 5xx after one retry, timeout after one retry, partial bulk response, duplicate response ID or requested/response ID mismatch. There is no fallback to player names.

## Readiness

`PLAYER_IDENTITY_ACQUISITION_PLAN_READY = YES`

`EXTERNAL_IDENTITY_ACQUISITION_EXECUTION_READY = YES`

This only prepares a future bounded read-only R3 acquisition phase. It does not authorize crosswalk persistence or raw canonical mapping writes.

`CROSSWALK_PERSISTENCE_AUTHORIZED_NOW = NO`

`MLB_DATA_01D_2025_FEATURE_BUILD_READY = NO`
