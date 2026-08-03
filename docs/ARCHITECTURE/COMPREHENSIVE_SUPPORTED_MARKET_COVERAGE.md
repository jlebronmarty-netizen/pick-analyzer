# Comprehensive Supported-Market Coverage

P2.1 defines the Current V2 production coverage contract for supported MLB markets.

## Coverage Rule

For each current operating-day MLB event, the system expects one persisted prospective prediction for every selection that is:

- available from canonical stored SportsDataIO odds evidence;
- normalized into a supported market;
- handler-certified by the current prediction path;
- feature-sufficient;
- before the pregame cutoff;
- inside the active `CURRENT_V2_PRODUCTION` epoch.

The expected count is computed from stored market evidence. It is not a fixed number.

## Supported Semantics

| Market | Expected selections | Identity |
| --- | --- | --- |
| Moneyline | home and away when both canonical rows exist | `epoch:event:moneyline:team:none` |
| Spread / run line | latest home and latest away canonical line when both canonical rows exist | `epoch:event:spread:team:line` |
| Total | latest over and latest under canonical total when both canonical rows exist | `epoch:event:total:Over/Under:line` |

Complements are not fabricated. If the provider does not store a selection row, P2.1 records the missing state instead of synthesizing it from the opposite side.

Three-way markets are not treated as binary markets.

## Generator Change

The MLB prospective generator previously selected one odds row per event and normalized market. That collapsed the side universe into a 24-row contract for 8 events and 3 markets.

P2.1 changes selection to keep market, outcome and line identity. Persistence reuse keys now include line identity so same-team market rows with different lines cannot silently overwrite each other.

The production writer keeps the latest canonical line for each side. Historical stale line changes from earlier snapshots are not treated as additional current production selections because the existing current-version constraint is one current row per event, market and selection.

## Coverage Endpoint

`GET /api/operations/prediction-coverage`

- Protected by `CRON_SECRET` Authorization header.
- Read-only.
- No provider calls.
- No remote mutations.
- Computes the current Puerto Rico operating date.
- Reads `sport_events`, `sports_odds_snapshots`, active epoch state and `prediction_history`.
- Reports every expected selection as one explicit state.

States:

- `PREDICTION_CREATED`
- `MISSED_OPPORTUNITY`
- `CUTOFF_MISSED`
- `DUPLICATE_COLLAPSED`

## Guardrails

P2.1 does not change prediction formulas, probability, confidence, edge, EV, Kelly logic, Official Pick policy, recommendation gates, scheduler cadence, provider contracts, settlement or learning.
