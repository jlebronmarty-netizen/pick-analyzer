# MLB Known Issues

Status: Production Stable
Version: MLB Production Complete v1.0.0

## Known Issues

1. Heavy composite diagnostics can be slow.

   Broad production smoke tests saw 30-second timeouts for `/api/mlb/operations-center`, `/api/mlb/data-quality` and `/api/autonomous-daily-operations/status`. The focused workflow endpoints remained healthy. This should be treated as a maintenance performance issue.

2. Provider-limited data domains remain explicit.

   Confirmed lineups, detailed injuries, some player role inputs and deeper bullpen availability remain unavailable or partial.

3. Current Board may be empty while slate exists.

   This is expected when the next slate is waiting for market prices or predictions. Dashboard copy should continue to distinguish empty eligible recommendations from scheduled games.

4. Learning and calibration samples remain insufficient for automatic model changes.

   Learning is not allowed to mutate thresholds, champion rows or model weights automatically.

## Non-Issues

- Official picks at 0 is valid when frozen policy gates are not met.
- V7 not promoted is intentional.
- Unsupported markets being unavailable is intentional.
- Detailed injury fields being unavailable is intentional under current provider limits.