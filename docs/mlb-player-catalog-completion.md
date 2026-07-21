# MLB Player Catalog Completion V1

Certification: `MLB_PLAYER_CATALOG_COMPLETION_PASS`

Date: 2026-07-21

## Scope

MLB 2026 player-game-stat identity reconciliation was completed with exact, provider-scoped evidence only.

No fuzzy name matching, statistical mutation, recommendation change, Current Board change, settlement change, scheduler change or provider call was used.

## Results

- Starting player-game-stat rows: 44,459
- Starting exact identity coverage: 71.20%
- Starting unresolved rows: 12,806
- Starting unresolved provider player IDs: 656
- Exact local mapping defect rows reconciled: 12,556
- Final exact identity coverage: 99.44%
- Final unresolved rows: 250
- Final unresolved provider player IDs: 25
- Final exact mappings still available locally: 0
- Final provider calls consumed: 0

## Root Cause

The audit found 631 unresolved provider player IDs, covering 12,556 rows, already had exact trusted local SportsDataIO mappings. These were classified as `EXACT_MAPPING_EXISTS_LOOKUP_DEFECT` and reconciled through the existing protected unresolved-identity route after the mutator was repaired to batch updates safely.

The remaining 25 provider IDs, covering 250 rows, are classified as `PROVIDER_METADATA_NOT_IMPORTED`. They remain preserved with provisional unresolved identity records and are excluded from trusted player-level feature calculations until exact metadata or approved manual mapping exists.

## Idempotency

Final read-only verification reports:

- `unresolvedRows=250`
- `exactTrustedMappingsAvailable=0`
- `statRowsResolvableByExactMapping=0`
- `providerCallsMade=0`
- `remoteMutationsMade=0`

## Mutation Boundary

Only these fields were updated for resolved rows:

- `player_id`
- identity resolution metadata
- `updated_at`

Statistical values, event IDs, team IDs, source stat IDs and official timestamps were not changed.
