# Retrosheet Historical Data Lake Phase 1A

Phase 1A creates the raw ingestion foundation for Retrosheet seasons. It does not calculate baseball intelligence, historical features, projections, replay data, matchup models or Learning Brain inputs.

## Scope

- Source inventory for local Retrosheet files.
- Additive data-lake schema for source registry, import registry, raw records, checkpoints and identity foundation.
- Streaming parser for Retrosheet event files.
- Raw fidelity preservation: source, filename, line number, parser version, checksum, import job, timestamps and eligibility flags.
- Idempotency based on checksum, filename and source line.
- Diagnostics and fixture validation with zero provider calls.

## Raw Source Safety

Raw files under `data/imports/` are ignored by Git. Commit parser code, fixtures, metadata and documentation only.

## Parser Contract

Supported event record types:

- `id`
- `version`
- `info`
- `start`
- `sub`
- `play`
- `data`
- `com`
- `badj`
- `padj`
- `ladj`
- `radj`
- `presadj`

Unknown record types are preserved as raw records with parsed fields, checksum and source line. They are marked `unknown_type`, not discarded.

Malformed records continue with warnings when safe. Structural failures that would corrupt game lineage, such as `play` before any active game id, are quarantined at the record level.

## Checkpoints

Checkpoint levels:

- `file`
- `game`
- `raw_parse`
- `normalization`
- `validation`

## Eligibility Flags

Retrosheet raw imports are historical-only and postgame-known by default:

- `historical_only=true`
- `postgame_known=true`
- `training_eligible=false`
- `pregame_eligible=false`

Later phases must explicitly derive leakage-safe pregame features from normalized records before any training eligibility changes.

## API

`GET /api/mlb/historical-intelligence/retrosheet`

Returns source inventory, checksums, duplicate hashes, encoding/line-ending inspection, game coverage estimate, parser record-type counts, unknown records, warnings, registry contracts, validation and provider/mutation accounting.

## 2025 Local Inventory Certification

Local diagnostics against `data/imports/retrosheet/2025/raw` reported:

- Total files: 61
- Event files: 30
- Roster files: 30
- Supporting team file: 1
- Total bytes: 12,333,563
- Estimated games from `id` records: 2,430
- Parsed event records: 399,497
- Duplicate SHA-256 hash groups: 0
- Unreadable files: 0
- Unexpected files: 0
- Unknown event record types: 0
- All Retrosheet team-code mappings resolved for discovered team files.
- All-file manifest SHA-256: `182cbc5128ade4304f2708fb1e20721696cfc6f27fbf96991769e4ba58df9bcf`
- Event-file manifest SHA-256: `9c237422afb19b4aa1e9eeb3eac254086e65d63db401c0aed203bae6794cd821`

The user request expected approximately 61 regular-season event files, but the local directory contains 30 event files plus 30 roster files and `TEAM2025`. This is recorded as an inventory warning, not an import failure.

## Migration

`supabase/migrations/202607220002_historical_data_lake_core_v1.sql`

The migration is additive and creates:

- `historical_source_registry`
- `historical_import_registry`
- `historical_raw_records`
- `historical_import_checkpoints`
- `historical_identity_foundation`

Rollback approach before production use: drop the five new tables if no downstream objects reference them. After production import writes begin, rollback must be data-preserving: disable write routes, export the affected tables, and apply a forward migration rather than dropping raw lineage.
