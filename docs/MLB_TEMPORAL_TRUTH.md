# MLB Temporal Truth V1

Status: implemented.

## Root Cause

SportsDataIO MLB `Game.DateTime` and `GameInfo.DateTime` are documented as US Eastern local time. Existing MLB ingestion parsed naive provider values with JavaScript `new Date(...)`, which can treat the value as a server-local or UTC-like instant. That made games appear roughly four hours early during Eastern Daylight Time and could make downstream state look live before first pitch.

## Canonical Contract

- Provider-specific local times are interpreted in the documented provider timezone.
- SportsDataIO MLB naive `DateTime` values are parsed in `America/New_York`.
- Explicit `Z` or numeric-offset timestamps are parsed as instants.
- Persisted event instants are UTC.
- API timestamps use ISO-8601 with explicit `Z` or offset.
- UI may render UTC into `America/Puerto_Rico` or the user display timezone.
- Server/Vercel timezone never changes business meaning.

## Implementation

- `src/services/provider-time-normalization.service.ts`
- `normalizeSportsDataIoMlbGameDateTime`
- `normalizeStoredSportsDataIoMlbStart`
- `zonedUtcRange`
- `localDateInTimeZone`

Legacy SportsDataIO rows without `temporalNormalization.contract = mlb_temporal_truth_v1` are repaired at read time when metadata proves SportsDataIO MLB provenance and `DateTimeUTC` was not present. The repair reinterprets the stored UTC-looking components as Eastern local time and converts them to canonical UTC without rewriting historical rows.

## Timestamp Audit

| Field | Classification | Rule |
| --- | --- | --- |
| SportsDataIO `DateTime` | `EASTERN_LOCAL_TIME` | Parse in `America/New_York` |
| SportsDataIO `GameInfo.DateTime` | `EASTERN_LOCAL_TIME` | Parse in `America/New_York` |
| SportsDataIO `DateTimeUTC` | `UTC_INSTANT` | Parse explicit instant |
| The Odds API `commence_time` | `UTC_INSTANT` | Preserve explicit UTC |
| `sport_events.start_time` | `UTC_INSTANT` | Persist/display canonical UTC |
| `sports_odds_snapshots.snapshot_time` | `UTC_INSTANT` | Explicit provider/update instant |
| `prediction_history.generated_at` | `UTC_INSTANT` | Model output generation instant |
| `recommendation_locked_at` | `UTC_INSTANT` | Policy lock instant |
| `universal_projection_history.generated_at` | `UTC_INSTANT` | Projection generation instant |
| UI formatted time | `USER_LOCAL_DISPLAY` | Render from canonical UTC |

## Validation

Deterministic fixtures cover Eastern Standard Time, Eastern Daylight Time, explicit UTC, explicit offset, invalid timestamps, legacy read-time repair and Puerto Rico display date stability.
