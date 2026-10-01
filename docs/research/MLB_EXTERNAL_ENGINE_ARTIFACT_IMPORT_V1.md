# MLB External Engine Artifact Import V1

Status: **RESEARCH-ONLY**

## Goal

Bring Pick Edge and Equilizer into the canonical MLB 2026 forward master ledger without rebuilding either model inside Pick Analyzer.

The importer consumes immutable GitHub artifacts only.

## Pick Edge

Authoritative sources:

- `predictions/shadow/{date}_PE_ML_V1.csv`
- matching manifest
- matching settlement JSON when available

Validation gates:

1. model id = `PE_ML_V1`;
2. manifest contract = `PE_ML_V1_DAILY_FREEZE/1.0.0`;
3. `generated_before_all_game_starts = true`;
4. CSV SHA-256 must exactly equal the manifest;
5. settlement, when present, must reference the same CSV path and SHA.

If settlement is missing, the row remains OPEN. Pick Analyzer does not fabricate a Pick Edge settlement.

The imported row is a continuous-probability observation. The higher-probability side is retained only as directional display/evaluation metadata; it is not a recommendation.

## Equilizer

Only the original E2 regular-season cohort is imported:

- Sep15
- Sep16
- Sep18
- Sep19
- Sep20
- Sep21
- Sep23
- Sep24
- Sep25
- Sep26

Explicitly excluded:

- Sep17
- Sep22
- Sep27 reconstructed/unfrozen date

Every CSV is SHA-verified against its immutable manifest.

The original cohort must have `game_type=R`. Any non-regular-season row is rejected.

Settlement uses the canonical official-final winner already materialized in Pick Analyzer by exact `gamePk`. This settles the frozen directional observation but does not rerun Equilizer.

Postseason games can never increment the original Equilizer 130/150 cohort.

## Import audit

Every artifact import writes provenance to:

`public.mlb_external_engine_import_audit_v1`

The audit stores repo, manifest path/hash, CSV path/hash, settlement hash where applicable, row counts and verification status.

## Automation

The normal master-ledger route attempts external import as a non-blocking phase. If public GitHub artifact access fails, internal Pick Analyzer settlement/freeze/sync still continues.

A later daily cron run is also scheduled so external immutable freezes published near first pitch can be imported after publication without changing their original pregame freeze time.

## Safety

- no Official Picks;
- APOSTAR off;
- no production recommendation;
- no model recalculation;
- no threshold invention;
- no retrofreeze;
- no cross-engine probability substitution.
