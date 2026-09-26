# MLB BALLDONTLIE 2025 Opening Odds Backfill V1

Status: **AUTHORIZED / RESEARCH-ONLY HISTORICAL BACKFILL**

The six-date probe demonstrated 80% exact opening coverage for Moneyline, Run Line and Full Game Total using BALLDONTLIE GOAT, with six sportsbook vendors and zero historical Odds API calls.

This backfill expands that evidence to all 2,430 regular-season 2025 games across 184 game dates.

## Storage

Dedicated research table:

`public.mlb_bdl_opening_odds_2025_v1`

Security:
- RLS enabled;
- `anon` revoked;
- `authenticated` revoked;
- `service_role` only.

The live `sports_odds_snapshots` table is not used for this historical backfill.

## Resumability

Each completed date is checkpointed in `sports_sync_jobs` under:

`mlb_bdl_opening_odds_2025_backfill_v1`

A rerun selects only dates without a `COMPLETE` checkpoint.

Each authenticated endpoint invocation processes at most eight dates.

## Exact identity / duplicate handling

Historical games are grouped by:
- date;
- canonical home team;
- canonical away team.

Single games map directly.

Doubleheaders map only when the number of distinct BALLDONTLIE scheduled timestamps equals the number of canonical historical games. They are paired by chronological order. If counts differ, the pair fails closed.

Multiple BALLDONTLIE game IDs with the exact same scheduled timestamp are treated as provider duplicates and collapsed into one provider-time group.

For each canonical game + vendor + market:
- if duplicate provider IDs expose the same market signature, they collapse;
- if their exact line/price signatures conflict, that vendor-market is blocked and not persisted.

No fuzzy identity matching is used.

## Markets

- Moneyline: HOME / AWAY
- Run Line: HOME / AWAY, exact spread preserved
- Full Game Total: OVER / UNDER, exact total preserved

Every row preserves provider `opened_at`.

## Cost / provider boundaries

- BALLDONTLIE GOAT only;
- no The Odds API historical call;
- no Official Picks;
- APOSTAR disabled;
- no production model or threshold change.

BALLDONTLIE documents the opening endpoint as historical opening odds for the most recently completed season and supports cursor pagination with up to 100 results/page.

The paid GOAT tier supports 600 requests/minute, but this implementation is deliberately sequential and pauses between provider requests.

Runner resume marker after full-season pagination repair.
