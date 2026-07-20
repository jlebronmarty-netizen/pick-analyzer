# Universal Projection Engine V1

Status: sportsbook-independent projection foundation.

The Universal Projection Engine predicts expected statistical outcomes. It is not a betting engine.

It does not:
- Generate betting recommendations
- Generate Official Picks
- Calculate EV
- Calculate Kelly
- Compare sportsbook lines
- Use sportsbook odds

Architecture:

Projection Engine

Then, in a future inactive connector:

Projection + Sportsbook Line -> Edge -> EV -> Kelly -> Official Pick

Only the Projection Engine layer is active in V1.

## Projection Types

- Team
- Player
- Pitcher
- Game

Every projection includes:
- Projected value
- Unit
- Confidence
- Historical accuracy when available
- Feature quality
- Data sufficiency
- Feature contributions
- Explanation
- Readiness
- Shadow status
- Prediction interval
- Validity status
- Projection origin
- Rank score and tier
- Identity and participation confidence when applicable

## API

- `GET /api/projections`
- `GET /api/mlb/projections`
- `POST /api/projections`
- `POST /api/mlb/projections`
- `GET /api/mlb/projections/health`
- `/projections`

GET is dry-run/read-only. POST is dry-run by default unless `dryRun=false` is explicitly passed and migration `202607190002_universal_projection_history_v1.sql` exists in the database.

## Storage

Projection history is separate from betting prediction history:

- Table: `universal_projection_history`
- Migration: `supabase/migrations/202607190002_universal_projection_history_v1.sql`

Projection history tracks projected value, actual value, error, absolute error, percentage error, calibration metadata and drift metadata.

## Integrity V1

Projection Integrity V1 blocks league-baseline-only rows from user ranking, rejects physically impossible values, preserves missing values as missing, resolves pitcher projections through event starter context and ranks projections by evidence strength rather than largest projected quantity.

## Universal Reuse

The core contract is sport-neutral. Sport-specific adapters provide features and stat mappings. MLB is the first active adapter.

## SportsDataIO Discovery Guard

`/api/providers/sportsdataio/discovery` now reports whether SportsDataIO MLB endpoint and field evidence is sufficient for future projection inputs. Discovery does not activate projection rows. Batter and pitcher projections remain blocked from user-visible ranking when starter identity, lineup role, player mapping, feature quality or plausibility evidence is insufficient.

## Operations Integration

Projection operations are surfaced in `/api/operations/health`. The Universal Projection Engine remains separate from betting predictions and is rechecked in dry-run mode by health surfaces. Persistence remains protected and migration-gated.
