# Projection Framework V1

Projection contract:

- `sportKey`
- `leagueKey`
- `eventId`
- `entityType`
- `entityId`
- `projectionKey`
- `projectionFamily`
- `projectedValue`
- `confidence`
- `historicalAccuracy`
- `featureQuality`
- `dataSufficiency`
- `predictionInterval`
- `featureContributions`
- `explanation`
- `readiness`
- `shadowStatus`

Readiness values:
- `READY`
- `LIMITED`
- `BLOCKED`
- `INSUFFICIENT_DATA`

Shadow values:
- `SHADOW_ONLY`
- `VALIDATING`
- `INSUFFICIENT_HISTORY`

The framework is reusable across MLB, NBA, NFL, Soccer, BSN and future sports. Only adapters should change.

Future sportsbook connector is contract-only and inactive in V1.
