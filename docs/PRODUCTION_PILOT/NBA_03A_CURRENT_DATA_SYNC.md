# NBA-03A Current Data Sync

Status: `NBA_03A_CURRENT_DATA_SYNC_PASS_READY_FOR_FIRST_SHADOW_AUTHORIZATION`

The bounded current-data sync reused the existing NBA multi-sport adapter and NBA sync persistence. The only runtime repair was credential lookup alignment so the adapter can use `THE_ODDS_API_KEY` while preserving `ODDS_API_KEY` as a legacy fallback.

Current evidence was acquired from The Odds API `basketball_nba` current odds endpoint. SportsDataIO was not called.

## Certification Summary

- Future NBA events stored: 41
- Current/future odds snapshots stored: 608
- Events with odds: 41
- Markets: moneyline, spread, total
- Sportsbooks observed: BetMGM, BetOnline.ag, BetRivers, Bovada, Caesars, DraftKings, FanDuel, Fanatics, LowVig.ag
- Safe Canary dry-run eligible candidates: 362
- `CURRENT_ERA_SHADOW` writes: 0
- `HISTORICAL_REPLAY_SHADOW` delta: 0
- MLB mutation delta: 0

## First Eligible Evidence

- Event: Boston Celtics @ Detroit Pistons
- Event ID: `26b036ff107f3c658258eaf4a6f26228`
- Start: `2026-10-20T19:00:00+00:00`
- Market: spread
- Selection: Detroit Pistons
- Line: -1.5
- Sportsbook: FanDuel
- Odds timestamp: `2026-08-15T02:10:56+00:00`

No shadow prediction was written. The first live shadow row remains a separate authorization boundary.
