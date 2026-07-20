# MLB Freshness Policy V1

Status: implemented.

Freshness is calculated from normalized UTC instants with a shared vocabulary.

## Statuses

- `FRESH`
- `AGING`
- `STALE`
- `MISSING`
- `UNSUPPORTED`
- `INVALID_TIMESTAMP`

## Contract

Every freshness item returns:

- `ageMinutes`
- `thresholdMinutes`
- `sourceTimestamp`
- `normalizedTimestamp`
- `status`
- `reason`
- `nextRefreshDueAt`

## Registry

Implemented in `src/services/mlb-freshness-policy.service.ts`.

| Data class | Fresh | Stale |
| --- | ---: | ---: |
| Schedule | 720 minutes | 1440 minutes |
| Market prices | 90 minutes | 360 minutes |
| Predictions | 360 minutes | 1440 minutes |
| Recommendations | 360 minutes | 1440 minutes |
| Projections | 360 minutes | 1440 minutes |
| Current Board | 90 minutes | 360 minutes |
| Official Picks | 360 minutes | 1440 minutes |
| Adaptive Refresh | 60 minutes | 720 minutes |
| Operations Status | 30 minutes | 360 minutes |
| Confirmed Lineups | Unsupported | Unsupported |

Unsupported data remains explicit. No missing lineup or stale status is fabricated.
