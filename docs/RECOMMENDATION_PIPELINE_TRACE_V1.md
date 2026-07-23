# Recommendation Pipeline Trace V1

Date: 2026-07-23

## Mission

Recommendation Pipeline Trace V1 is a read-only diagnostic contract for proving whether stored recommendations are generated, settled and later consumed by learning evidence.

Endpoint:

- `/api/recommendation-pipeline/trace`

The trace reads persisted data only. It does not run prediction generation, settlement, replay, learning, provider sync or model weight updates.

## Reported Days

The trace reports:

- Today
- Yesterday

Dates use the MLB operating timezone `America/Puerto_Rico`.

## Counts

Each day reports:

- games scheduled
- games eligible before start
- odds snapshots available
- predictions generated
- Current Board candidates
- Model Only rows
- AI Leans
- Watchlist
- Best Value
- Official Picks
- games completed
- production predictions settled
- learning samples queued
- learning samples accepted
- learning samples rejected
- weight updates

## Zero Reason Codes

When a count is zero, the trace supplies grounded reason codes such as:

- `NO_SCHEDULED_GAMES`
- `ODDS_NOT_AVAILABLE`
- `PREDICTION_NOT_DUE`
- `EVENT_ALREADY_STARTED`
- `NO_ELIGIBLE_MARKET`
- `NO_POSITIVE_EV`
- `OFFICIAL_POLICY_NOT_MET`
- `RESULT_NOT_FINAL`
- `NO_LEARNING_LABEL`
- `LEARNING_NOT_RUN`

## Learning Evidence

Learning is reported only from persisted evidence. A settled production prediction can be counted as a queued learning label, but accepted learning and weight updates require stored records such as performance snapshots or model weight history. No claim of learning execution is made without persisted evidence.

## Model-Only Fallback

Most Likely may display stored model-only probabilities without current odds. Best Value continues to require current odds and positive EV. Official Picks continue to require the existing policy gates.

Model-only fallback can search the next stored pregame slate when Today has no future pregame slate. It remains informational and never promotes a row into Best Value or Official Pick.

## Guardrails

Provider calls: 0

Remote mutations: 0

No changes are made to:

- Prediction probabilities
- Official Pick policy
- Current Board rows
- Learning Brain weights
- Settlement outcomes
- Historical Replay
