# AI Sports Analyst V2

AI Sports Analyst V2 is a deterministic, grounded explanation layer. It is not a prediction engine, recommendation engine or free-form evidence generator.

## Sources

- Game Intelligence V1.
- Current Board-derived market rows.
- Market Alignment V1.
- Market Classification V1.
- Recommendation Explanation V1.
- Stored prediction and event metadata.

## API

- `GET /api/sports-analyst/game/[eventId]`
- `GET /api/sports-analyst/game/[eventId]?validate=true`

## Contract

Responses include summary, model view, market view, what could change, risks, game story, advantage matrix, bottom line and source contracts. Unsupported lineups, injuries, weather, bullpen, splits and player props remain explicit missing-data signals.

## Safety

The analyst never changes probabilities, recommendation policy, official-pick status or settlement. Stale or quarantined markets do not receive actionable price targets.
