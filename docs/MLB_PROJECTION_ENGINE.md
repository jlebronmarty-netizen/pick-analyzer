# MLB Projection Engine V1

Status: first adapter for the Universal Projection Engine.

MLB projections are generated independently of sportsbooks.

## Team Projections

Team projections require team-specific stored evidence to be user-visible. League-baseline-only rows are labeled `LEAGUE_BASELINE`, blocked from Top Projections and kept in diagnostics only.

- Projected Runs
- Projected Hits
- Projected Home Runs
- Projected Walks
- Projected Strikeouts
- Projected Total Bases
- Projected On Base Percentage
- Projected Slugging

## Pitcher Projections

Pitcher projections require a provider-backed starter link to the event. Confirmed and probable starters are allowed; unverified pitchers are excluded from the user board. Pitcher IDs use internal `sport_players.id` when available or a deterministic SportsDataIO fallback when a legitimate PlayerID exists.

- Strikeouts
- Outs Recorded
- Hits Allowed
- Earned Runs
- Walks Allowed
- Pitch Count
- WHIP
- ERA
- K/9
- Quality Start Probability
- Win Probability

## Batter Projections

Batter projections are preliminary unless lineup confirmation exists. They require stable identity, event-team membership, active status when known, sufficient sample size and plausibility validation.

- Hits
- Singles
- Doubles
- Triples
- Home Runs
- RBI
- Runs
- Walks
- Strikeouts
- Stolen Bases
- Total Bases
- OPS
- wOBA when available

## Inputs

The MLB adapter reuses:
- Stored MLB events
- Stored `sport_game_stats`
- Stored `sport_player_stats`
- Feature Store
- Shared Prediction SDK contract
- Historical Builder contract
- SportsDataIO adapter/catalog evidence
- Starter/weather/stadium context where available
- AI Brain and AI Performance Center

Unavailable data remains explicit:
- Confirmed lineups are not fabricated.
- Player handedness matchups are not fabricated.
- Sportsbook lines are not used.
- Provider projections are not treated as actual outcomes.

## Readiness

Most V1 projections are `LIMITED` or `INSUFFICIENT_DATA` until projection history accumulates settled actual outcomes.

User-facing rows are additionally filtered by validity, identity, event mapping, unit and plausibility checks.

## SportsDataIO Discovery Integration

SportsDataIO Discovery V1 exposes provider endpoint and field evidence for future MLB projection inputs. It does not change projection formulas, does not activate sportsbook-linked projections and does not reactivate batter or pitcher rows for display. Provider projection payloads remain context-only unless validated, timestamp-safe and grounded against actual outcomes.
