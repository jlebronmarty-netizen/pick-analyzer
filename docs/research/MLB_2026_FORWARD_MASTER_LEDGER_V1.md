# MLB 2026 Forward Master Ledger V1

Status: **RESEARCH-ONLY**

## Purpose

Create one canonical forward-evidence ledger without collapsing distinct engines, contracts,
market lines, directions, or season phases.

Table:
`public.mlb_2026_forward_master_ledger_v1`

## Grain

One row = one frozen model-contract selection.

The row identity includes:
- source relation;
- source row identity;
- model id.

Regular season and postseason are always separated:
- `REGULAR_SEASON`
- `POSTSEASON`

Postseason rows use an evidence class prefixed:
`POSTSEASON_SHADOW_DOMAIN_SHIFT_`

They must not be pooled into regular-season accuracy without an explicit later analysis.

## V1 sources

Pick Analyzer persisted/frozen sources only:
1. Moneyline V2 forward table.
2. Approved props where exact market is verified and model qualifies.
3. Standard Run Line frozen jobs, selected Core/Transfer/Broad only.
4. HOME +1.5 frozen jobs, selected only.
5. HOME +1.5 authoritative settlement jobs.
6. Persisted exact-line Pitcher K / Pitcher Outs forward shadows.

The ledger does not rerun any model.

## Probability semantics

Fields are nullable.

- A model without a calibrated probability remains NULL.
- Historical accuracy may be stored separately when the source already provides it.
- Historical accuracy is never substituted for `model_probability`.
- Standard Run Line market probability remains in metadata and is labeled as market proxy, not model probability.

## External engines

Pick Edge and Equilizer are intentionally not reconstructed from Pick Analyzer data.

They require future importers that consume their immutable frozen CSV + manifest artifacts.
This preserves engine provenance and avoids silently rebuilding independent models.

Pulpy remains a meta/provenance layer and cannot rewrite upstream model rows.

## Settlement

The ledger does not infer results.
It mirrors source-authoritative settlements only.

OPEN/null result is valid until the canonical source settles.

## Security

- RLS enabled.
- anon/authenticated access revoked.
- service_role read/write only.
- no delete authority granted.

## Automation

Endpoint:
`/api/cron/mlb-forward-master-ledger`

Scheduled daily after the normal pregame research freezes.

Execution order:
1. settle previously frozen exact-line K/Outs rows when official pitcher outcomes exist;
2. freeze current exact-line K/Outs candidates, strictly pregame;
3. synchronize all persisted evidence into the master ledger.

The master sync is idempotent and refreshes settlement fields when authoritative sources later settle.

## Boundaries

- no Official Picks writes;
- APOSTAR off;
- no production model promotion;
- no formula/threshold changes;
- no historical Odds API spend;
- no postseason/regular-season evidence pooling.
