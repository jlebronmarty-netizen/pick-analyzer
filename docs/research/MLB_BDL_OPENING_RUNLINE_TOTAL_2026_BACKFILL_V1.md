# MLB 2026 BALLDONTLIE Opening Backfill — Run Line + Total V1

Status: **RESEARCH-ONLY / DIAGNOSTIC-ONLY**

Purpose: create the missing 2026 opening-market surface needed to replay the frozen 2025 Run Line and Full Game Total audits apples-to-apples.

## Provider and market contract

- Provider: BALLDONTLIE GOAT.
- Vendors persisted: BetMGM and BetRivers only.
- Markets persisted from the same opening response: standard Run Line and Full Game Total.
- Historical Odds API calls: 0.
- No line coercion or extrapolation.

Run Line scoring later requires both books to carry exact standard +/-1.5 and agree on the DOG +1.5 side.

Total scoring later requires BetMGM and BetRivers to carry the identical exact opening total.

## Identity

- Exact date + canonical team aliases.
- Exact gamePk inherited from the canonical xyear game row.
- Doubleheaders use pair count plus chronological/game-number order.
- Pair-count mismatches fail closed.
- Fuzzy matching is forbidden.

## Persistence

Table: `public.mlb_bdl_opening_runline_total_2026_v1`.

The table is RLS-enabled and has no anon/authenticated/public grants. Each row is uniquely keyed by:

`canonical game + vendor + market + outcome + exact line`.

Provider conflicts for the same game/vendor/market fail closed rather than selecting a convenient line.

## Execution

The authenticated research route processes at most eight settled game dates per call and records resumable checkpoints in `sports_sync_jobs`.

No Official Picks changes, no APOSTAR activation, no production model promotion, and no threshold changes are part of this backfill.

After acquisition completes, PR #244 and PR #245 architectures must be replayed with their already-frozen 2025 cuts. 2026 outcomes cannot alter those cuts.
