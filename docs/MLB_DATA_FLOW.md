# MLB Data Flow

Status: Production Stable
Version: MLB Production Complete v1.0.0

## Data Flow

1. Provider or stored schedule data enters normalized sport tables.
2. Operating-day services select and scope the Puerto Rico operating date.
3. Odds snapshots and feature snapshots are stored or read through existing services.
4. Current champion prediction rows are read by Current Board.
5. Market intelligence classifies stored candidates into Official, AI Lean, Watchlist and Avoid.
6. Product surfaces render Current Board and informational opportunity tools.
7. Results sync and settlement use terminal stored game results.
8. Replay/calibration/learning consume settled/history-safe data only.

## No-Leakage Policy

Pregame surfaces must not use post-start or postgame inputs. Feature Store and prediction rows preserve cutoff/generation metadata where available. Historical and replay workflows are separated from current recommendation workflows.

## Unsupported Data Behavior

Unsupported or unavailable MLB data remains explicit:

- Confirmed lineups: unavailable unless provider/source supplies them.
- Detailed injury information: subscription/provider limited.
- Player importance: not inferred without historical role/playing time evidence.
- Multi-book arbitrage: unavailable unless verified simultaneous multi-book prices exist.
- Unsupported markets: hidden or unavailable until end-to-end support exists.

## Production Validation

The Today contract currently reports next slate games waiting for odds instead of implying no games exist. Production validation returned current dashboard success with providerCallsMade 0 and remoteMutationsMade 0.

## SportsDataIO Discovery

The provider discovery flow is read-only:

1. Read SportsDataIO endpoint catalog.
2. Read stored sync-job and normalized-table evidence.
3. Classify endpoints, field quality, identity mapping and projection blockers.
4. Report quota plan and safe next verification.

It does not import data, mutate predictions, promote models or change market availability.

## Operations Health

`/api/operations/health` now reports whether each data class is fresh, stale, pending, unsupported or blocked. Freshness is based on stored successful data timestamps and execution evidence rather than page render time.
