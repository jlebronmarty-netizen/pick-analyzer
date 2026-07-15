# Pick Explanation Experience V1

Status: implemented for official-pick surfaces and MLB historical replay.

## Default View

The default user view now separates:

- model selection
- recommendation status
- model probability
- sportsbook implied probability
- edge
- EV
- confidence label
- reliability label
- value label
- strongest available positive and negative factors
- missing-data warnings

Rows with non-positive edge or EV display `No modeled value` and are not shown
as recommended wagers.

## Advanced Details

Technical lineage stays behind collapsed details where the UI supports it:

- feature quality score
- data sufficiency score
- snapshot lineage
- model version
- feature-set version
- cutoff timestamp
- odds timestamp
- quarantine state
- qualification blockers

Snapshot UUIDs are no longer prominent in the normal MLB replay card.

## Factor Contract

Explanations use persisted pregame prediction fields and linked Feature Store
lineage only. They may mention odds position, line movement, data quality,
data sufficiency and event context when present. They must not imply probable
pitchers, bullpen, weather, lineups, injuries or postgame data influenced a row
unless those inputs exist in the pregame snapshot.

