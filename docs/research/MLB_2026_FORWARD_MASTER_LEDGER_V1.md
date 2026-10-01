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

Pick Edge and Equilizer are imported only from their immutable GitHub artifacts.

### Pick Edge

Importer source:
- `predictions/shadow/{date}_PE_ML_V1.csv`;
- matching manifest;
- matching settlement artifact when available.

Requirements:
- exact PE_ML_V1 model id;
- generated before all target starts;
- CSV SHA-256 must equal the manifest;
- settlement source-freeze hash/path must match the imported freeze;
- no recommendation threshold is invented.

Every row remains a continuous-probability observation. The higher-probability side is stored only for
directional evaluation/display.

### Equilizer

Only the original regular-season E2 cohort dates are imported:
Sep15, Sep16, Sep18, Sep19, Sep20, Sep21, Sep23, Sep24, Sep25 and Sep26.

Requirements:
- exact EQUILIZER_ML_V2_E2_STABLE6 id;
- immutable pregame freeze;
- CSV SHA-256 verification;
- exact gamePk identity;
- game_type must be R.

Sep17/Sep22/Sep27 are not reconstructed. Postseason cannot increment the original 130/150 cohort.
Directional outcome is settled against the canonical official-final winner by exact gamePk only.

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
1. settle approved-prop rows when exact authoritative outcomes exist;
2. settle previously frozen exact-line K/Outs rows;
3. freeze current exact-line K/Outs candidates, strictly pregame;
4. import SHA-verified Pick Edge / Equilizer artifacts (non-blocking to internal Pick Analyzer work);
5. synchronize persisted Pick Analyzer evidence into the master ledger.

A second daily cron run later in the day exists so immutable external freezes published closer to first
pitch can still be imported after publication. Import time does not redefine freeze time; the artifact's
own immutable pregame timestamp remains authoritative.

The master sync is idempotent and refreshes settlement fields when authoritative sources later settle.

## Boundaries

- no Official Picks writes;
- APOSTAR off;
- no production model promotion;
- no formula/threshold changes;
- no historical Odds API spend;
- no postseason/regular-season evidence pooling.
