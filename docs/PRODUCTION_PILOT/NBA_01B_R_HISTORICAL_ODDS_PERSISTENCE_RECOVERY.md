# NBA-01B-R Historical Odds Persistence Recovery

Status: NBA_ODDS_PERSISTENCE_RECOVERY_PASS_STATS_PENDING

## Root Cause

Original NBA-01B fetched and normalized all 174 historical responses in memory, then upserted the full sports_odds_snapshots set in one Supabase REST request after event and mapping writes. Supabase/Cloudflare returned HTTP 520 on that giant odds upsert; no checkpoint had been written before the DB failure.

## Recovery

| Metric | Value |
| --- | ---: |
| Historical events | 1221 |
| Responses recovered | 0 |
| Responses re-fetched | 159 |
| Additional credits used | 4770 |
| Remaining authorized credits | 10 |
| Odds rows inserted | 29214 |
| Odds rows reused | 0 |
| DB chunks | 663 |
| DB failures | 0 |
| 520 errors after repair | 0 |

## Coverage

| Market | Events |
| --- | ---: |
| Moneyline | 1196 |
| Spread | 1196 |
| Total | 1196 |
| Full core | 1196 |

## Timing

Snapshot timing quality: STRONG_PREGAME

NBA stat source remains blocked independently; no NBA production activation, current-era prediction writes, bulk replay, SportsDataIO calls, or MLB runtime changes were made.
