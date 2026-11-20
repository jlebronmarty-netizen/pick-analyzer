# NBA SHADOW props settlement from archived operational finals — November 20 2026

## Evidence (read-only)
- Frozen NBA: 474 contract hypotheses over 13 games (Nov 19–20). The Nov 19 first tranche holds 240 rows and 119 statistically graded outcomes (69 win, 49 loss, 1 push).
- **All remaining 121 Nov 19 rows are Player Props**; no direct GOAT compact facts exist for the four game IDs.
- The already persisted `nba_game_context_v2.player_stats.data` has 31–35 players per event for all four final games: 21718143–21718146. Each boxscore has unique player IDs, only the two teams, >=5 player rows per team, final state on every row, and the sum of player points reconciles exactly with 126–98, 114–124, 99–102 and 124–112 respectively. Source captured post-tip. Archived research compact GOAT still 5,323 facts/192 games, last captured Nov 16 UTC.
- One frozen player from the four games has zero playing time. Reject that player, even if provider reports zero stats; do **not** count DNP as losing Over or winning Under.

## Implementation in draft PR
- Strict zero-network, read-only final-stat fallback for original immutable freezes. Compact facts remain preferred when available.
- Validates provider game ID, actual final game datetime/date/team identity/final score, per-player team and uniqueness, captured after tip, all rows final, totals by team, finite integer stats, and positive minutes for eligible players. Rejects the whole game on conflict.
- Queries existing archived contexts only for <=16 games per bounded reconciliation; never queries GOAT, mutates frozen decision rows, or changes models.
- Reuses the existing unique conflict-ignore outcome insert. This yields statistical SHADOW grades, **not sportsbook-certified settlement**, payouts, calibrated probability, EV or independent accuracy. No retroactive reconstruction of frozen picks.

## Release gates
- Node regression + TypeScript and private Preview must pass before merge. The existing daily settlement window is at 12:15 UTC (~8:15 AM Puerto Rico); outcomes appear on its next natural schedule after deployment.
- Even if 121 rows become gradeable, outcome count must be compared to unique games and player contracts. Historical W/L of correlated periods/props do not establish 75% reliable market accuracy.
- Separate work: certify FanDuel rules, GOAT incremental archival (#340), and NHL V6 paired holdout.
