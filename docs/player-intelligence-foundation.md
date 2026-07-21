# Player Intelligence Foundation

Player Intelligence Foundation V1 adds a stored-data-only player evidence route.

## API

- `GET /api/players/[playerId]/intelligence`
- `GET /api/players/[playerId]/intelligence?validate=true`

## Current Support

- Canonical stored player identity.
- Team, position and identity-quality status.
- Recent stored player-stat rows.
- Pitcher recorded-outs history when stored.
- Explicit unavailable states for handedness splits, matchup-vs-player history and player prop markets.

Player prop EV remains `NO_MARKET` until verified prop odds and settlement rules exist.
