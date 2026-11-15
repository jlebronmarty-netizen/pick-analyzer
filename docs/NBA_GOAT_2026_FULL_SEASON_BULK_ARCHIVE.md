# NBA GOAT 2026–27 — season-wide historical archive pilot

STATUS: PREPARED, NOT EXECUTED. The branch changes no official models, schedules, picks or other sports.

## Scope
Inventory games from BALLDONTLIE itself (not only the local 2026-11-02+ schedule). Default season 2026, date range 2026-10-20 through 2026-11-14. Fetch only final, non-postponed, non-postseason games. Store compressed raw responses in a PRIVATE Supabase Storage bucket (not in PostgreSQL), with only small SHA-256/timestamp/path metadata in the manifest table. No public access.

Core mode: player box-score stats plus advanced V2. All mode: tracking, defense, shooting, matchups, lineup stats, shot charts, opening odds, opening player props, play-by-play and win probabilities. Data coverage may be empty or inconsistent and must be reported. Historical opening props/odds are not a replacement for missing archived pregame price movements; current player props use the separate existing collector.

Not covered by this pilot: historically correct injury reports or projected lineups (today's snapshots cannot reconstruct prior availability), team-season aggregates, all possible season-average variants, and complete sportsbook intraday odds histories. Those require separate appropriately timestamped jobs. NBA Cup, preseason, regular season, playoffs and play-in must never be mixed in accuracy.

## Before execution
1. Review code and CI; verify the GOAT and Supabase credentials already exist SERVER-SIDE; do not paste keys into chat or logs.
2. Create a PRIVATE Supabase Storage bucket named nba-goat-2026-private in an authorized environment, with max object size at least 20 MB and global size limit compatible. Do not make this bucket public. Storage is billed separately from the allocated PostgreSQL disk (verify usage/cost quota).
3. Apply the RLS-protected SMALL-METADATA-ONLY archive migration in an authorized test environment, then confirm permissions/capacity. Do not deploy the prior draft's payload-in-Postgres schema.
4. Run dry-run (no provider or database calls):
   node scripts/nba-goat-season-2026-bulk-archive.mjs --mode=core --max-requests=30 --max-games=3
5. Bounded pilot AFTER capacity/credentials validation:
   node scripts/nba-goat-season-2026-bulk-archive.mjs --execute --mode=core --max-requests=30 --max-games=3
6. If pilot succeeds, resume in capped sessions:
   node scripts/nba-goat-season-2026-bulk-archive.mjs --execute --mode=all --max-requests=300 --max-games=999
7. Verify games, player IDs, complete cursor traversal, missing datasets, null/empty data, storage, number of provider calls, and idempotency. Preserve original quotes.
8. Existing backfill and crons must remain unchanged. Bulk runner writes ONLY to private compressed Storage objects plus the minimal archive index table. It does NOT fill nba_game_context_v2 or other operational tables; ingestion to operational models requires a distinct reviewed process. Official Picks/models are never written by this runner.

## Current blocker
The connected Supabase SQL tool can inspect the existing archive, but cannot access the private BALLDONTLIE key in Vercel or invoke the authenticated provider server runtime. Creating this branch does not constitute a completed provider download. Production activation and any provider consumption remain unperformed.

## Confirmed production capacity risk (14-Nov screenshots)
Supabase Pro project Pick Analyzer has 27 GB disk provisioned, 15.44 GB used (14.3 GB database, ~1 GB WAL) and 8 GB included in the plan. Spend Cap is ON; don't disable it or upgrade compute as part of this pilot. Largest SQL tables inspected read-only: pick2_raw_mlb_statcast_pitches ~4.7 GB, sports_odds_snapshots ~3.45 GB, sport_player_stats ~1.47 GB. Preserve MLB and sports history. Current Supabase Storage usage was ~0.005 GB of the 100 GB included in Pro; unlike the PostgreSQL allocated disk, Storage objects are billed under Storage-size rules. The bulk runner must NOT insert large raw responses into Postgres. No run until a small private bucket exists, storage limits are validated, and the approved execution path can use credentials without exposing them.

## Small upgrade checkpoint (14-Nov evening)
User upgraded Pick Analyzer to Supabase Small. Project API reported ACTIVE_HEALTHY. SQL read succeeded, shared_buffers=512MB, 23 existing game contexts with player stats, 0 mass-archive manifests, and verified private 20MB bucket. The Supabase project API response itself does not explicitly state the compute class; verify Small under Infrastructure before reporting it as directly confirmed. Full season pilot remains NOT EXECUTED. Check recent backups/restorability and spend-cap before executing.
