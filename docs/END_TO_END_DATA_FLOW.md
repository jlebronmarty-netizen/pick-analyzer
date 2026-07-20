# End To End Data Flow

Status: Implemented
Version: V1

## Flow

Schedule sync -> lifecycle sync -> stats sync -> starter context -> odds sync -> feature reconstruction -> projection generation -> prediction generation -> Current Board -> AI Briefing -> settlement/performance.

## Change Detection

V1 records execution evidence and freshness state. Full per-entity fingerprints are represented as a required next hardening step; downstream rebuilds currently depend on existing idempotent snapshots, odds timestamps and prediction lineage.

## Non-Inference

Unsupported providers do not produce fake freshness or fake availability.

Confirmed lineups and detailed injuries remain unsupported for MLB.
