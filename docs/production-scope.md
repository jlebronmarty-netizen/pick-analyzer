# Production Scope

Production scope is a read policy, not a cleanup delete. Historical rows can stay in storage while production metrics ignore rows that are not eligible, traceable and pregame-valid.

## Included

Production-qualified metrics may include rows only when they satisfy the relevant domain gates:

- `production_eligible=true`
- not `trial`
- not `scrambled`
- not fixture or quarantine data
- canonical event linkage is present
- immutable model/feature lineage is present
- market, odds and settlement identity are complete for the metric being computed

## Excluded

The following rows are excluded from production-qualified pending counts, settlement backlog, ROI, accuracy, calibration, trust and official-pick readiness:

- legacy provenance rows
- trial rows
- scrambled rows
- synthetic or fixture rows
- post-start predictions
- rows without required canonical event identity
- rows with incomplete market identity for the metric being computed

## Legacy Rows

Legacy rows are not deleted. They stay available for:

- audit
- historical forensics
- replay and backtest research
- provenance reporting

They must not become Official Picks, Current Board candidates, calibration samples or performance claims without an explicit future migration and proof package.
