# PA-14 V2 — Historical Stored Corpus Pilot

Date: 2026-09-17

Status:

`STORED_CORPUS_EXPANDED_BUT_TEMPORALLY_INADEQUATE`

## Scope

Materialize and independently replay the **18 contract-valid historical rows**
identified by the corrected 72-row PA-14 audit, using the already existing
`public.pa14_v2_evidence_bundles` infrastructure.

No parallel evidence table was created.

## Batch execution

- branch: `research/pa14-v2-historical-storage-pilot-20260917`
- commit: `93a1bef47d842e91700bd411398d7bd37fda03c6`
- Vercel deployment: `dpl_BaJ3VpLRCJpqsnwhNdb6uvLzRoMd`
- target rows: **18**
- stored + replay PASS: **18 / 18**
- failures: **0**
- stored replay network calls: **0 for every row**
- production-eligible rows: **0**
- shadow-only rows: **18**

Each row was first rebuilt from the archived pregame/canonical historical
evidence. Only an ELIGIBLE deterministic result could be stored. The stored
`build_input` was then replayed twice with `globalThis.fetch` blocked.
`certification_candidate=true` was written only after exact expected-result,
lineage and temporal checks passed.

## Canonical readback after the batch

For the exact frozen contract + builder:

- total rows: **19**
- unique `canonicalGamePk + pitcherMlbamId`: **19**
- replay PASS: **19**
- certification candidates: **19**
- production eligible: **0**
- shadow only: **19**
- 2025 historical rows: **18**
- 2026 forward/source-certification rows: **1**

Historical 2025 distribution:

| Month | Stored certified rows |
|---|---:|
| Apr | 8 |
| May | 5 |
| Jun | 1 |
| Jul | 1 |
| Aug | 3 |
| Sep | 0 |

The stored corpus therefore remains temporally inadequate for training.

## Production Consumer readback

The existing read-only production Consumer was queried for historical identity:

- gamePk: `778177`
- pitcher: `668678`
- HTTP: **200**
- status: `AVAILABLE`
- replay: `PASS`
- certification candidate: **true**
- `researchOnly=true`
- `productionEligible=false`
- `shadowOnly=true`

This demonstrates the existing Consumer can expose a certified historical V2
row without changing its safety boundary.

## Reusable storage path

`scripts/research/pa14-v2-historical-store-replay.mjs`

is a manual research-only utility. It:

1. requires `PA14_V2_HISTORICAL_STORE_CONFIRM=RESEARCH_ONLY`;
2. accepts an explicit target array from `--targets=<json file>` or
   `PA14_V2_HISTORICAL_TARGETS_JSON`;
3. re-runs the historical V2 audit before any write;
4. reuses `pa14_v2_evidence_bundles`;
5. writes `production_eligible=false`, `shadow_only=true`;
6. promotes `certification_candidate` only after zero-network stored replay.

It is not wired into `npm build`, a cron, or production automation.

## Gate

`PE_PITCHER_K_V2_TRAINING_AUTHORIZED = NO`

`PE_PITCHER_K_V2_MODEL_STATUS = NOT_STARTED`

The corpus grew from one row to nineteen, but 18 historical rows with zero
September representation are not an adequate training/validation corpus. N3.4d
must remain closed.

## Safety

- Official Picks unchanged
- APOSTAR inactive
- no production promotion
- no sportsbook calls
- no historical Odds API credits
- no V1-as-V2 relabeling
- no contract relaxation
