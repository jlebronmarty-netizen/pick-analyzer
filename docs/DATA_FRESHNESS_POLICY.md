# Data Freshness Policy V1

Freshness states:

- `FRESH`: within the domain fresh window.
- `AGING`: outside the fresh window but inside the stale window.
- `STALE`: older than the stale window.
- `PENDING`: needed for an active slate but not available.
- `NOT_AVAILABLE`: not needed or no stored data exists.
- `NOT_SUPPORTED`: the provider or platform does not support this domain for actionable use.
- `FAILED`: reserved for failed refresh evidence.

## Domain Policies

- Schedule: fresh 12 hours, stale 24 hours.
- Odds: fresh 90 minutes, stale 6 hours.
- Results: fresh 60 minutes, stale 12 hours.
- Starters: fresh 6 hours, stale 18 hours.
- Confirmed lineups: not supported for MLB actionable absence claims.
- Roster availability: fresh 24 hours, stale 48 hours when stored player-status data exists.
- Weather: fresh 6 hours, stale 18 hours.
- Bullpen: fresh 24 hours, stale 48 hours.
- Feature snapshot: fresh 6 hours, stale 24 hours.
- Prediction: fresh 6 hours, stale 24 hours.
- Recommendation: fresh 6 hours, stale 24 hours.
- Settlement: fresh 24 hours, stale 48 hours.

Stale odds block actionable presentation. Missing lineups must not be described as confirmed absence.
