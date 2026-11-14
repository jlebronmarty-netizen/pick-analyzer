# NBA GOAT 2026–27 — season-wide historical archive pilot

STATUS: PREPARED, NOT EXECUTED. The branch changes no official models, schedules, picks or other sports.

## Scope
Inventory games from BALLDONTLIE itself (not only the local 2026-11-02+ schedule). Default season 2026, date range 2026-10-20 through 2026-11-14. Fetch only final, non-postponed, non-postseason games. Store raw responses per game/dataset with SHA-256, timestamp, and source.

Core mode: player box-score stats plus advanced V2. All mode: tracking, defense, shooting, matchups, lineup stats, shot charts, opening odds, opening player props, play-by-play and win probabilities. Data coverage may be empty or inconsistent and must be reported. Historical opening props/odds are not a replacement for missing archived pregame price movements; current player props use the separate existing collector.

Not covered by this pilot: historically correct injury reports or projected lineups (today's snapshots cannot reconstruct prior availability), team-season aggregates, all possible season-average variants, and complete sportsbook intraday odds histories. Those require separate appropriately timestamped jobs. NBA Cup, preseason, regular season, playoffs and play-in must never be mixed in accuracy.

## Before execution
1. Review code and CI; verify the GOAT and Supabase credentials already exist SERVER-SIDE; do not paste keys into chat or logs.
2. Apply the separate RLS-protected archive migration in an authorized test environment, then confirm permissions/capacity.
3. Run dry-run (no provider or database calls):
   node scripts/nba-goat-season-2026-bulk-archive.mjs --mode=core --max-requests=30 --max-games=3
4. Bounded pilot AFTER capacity/credentials validation:
   node scripts/nba-goat-season-2026-bulk-archive.mjs --execute --mode=core --max-requests=30 --max-games=3
5. If pilot succeeds, resume in capped sessions:
   node scripts/nba-goat-season-2026-bulk-archive.mjs --execute --mode=all --max-requests=300 --max-games=999
6. Verify games, player IDs, complete cursor traversal, missing datasets, null/empty data, storage, number of provider calls, and idempotency. Preserve original quotes.
7. Existing backfill and crons must remain unchanged. Bulk runner fills only currently null player_stats in nba_game_context_v2; other datasets go to the isolated raw archive. Official Picks/models are never written by this runner.

## Current blocker
The connected Supabase SQL tool can inspect the existing archive, but cannot access the private BALLDONTLIE key in Vercel or invoke the authenticated provider server runtime. Creating this branch does not constitute a completed provider download. Production activation and any provider consumption remain unperformed.
