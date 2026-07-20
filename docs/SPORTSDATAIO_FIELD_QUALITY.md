# SportsDataIO Field Quality

Status: Implemented
Version: V1

## Classification

Fields are profiled from retained `sports_sync_jobs.metadata.rawPayload` when available.

Each field receives:

- Observed rows
- Present rows
- Null rows
- Type
- Freshness source
- Usability
- Sanitized sample when explicitly requested
- Scrambled-data assessment

## Usability Labels

- `usable`: potentially suitable for narrow features after review.
- `identity_only`: provider IDs or mapping keys.
- `display_only`: names, labels, descriptions or status text.
- `unusable`: unsafe for features.
- `unknown`: not enough stored evidence.

## Missing Data

Missing provider fields remain missing. The discovery layer does not infer:

- Starter identity
- Confirmed lineup absence
- Injury diagnosis
- Injury severity
- Expected return
- Day-to-day status
- Player importance
