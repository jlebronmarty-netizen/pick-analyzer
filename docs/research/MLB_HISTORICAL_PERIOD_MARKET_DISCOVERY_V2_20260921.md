# MLB Historical Period-Market Discovery V2 — 2026-09-21

State: `RESEARCH_ONLY_NO_PROMOTION`

## Purpose

Record the bounded event-level market discovery executed after PR #174.

This document does **not** promote a model, change a threshold, authorize APOSTAR, create Official Picks, or claim that a market is available for every MLB event.

## Corrected historical timestamp

Target game:

- Miami Marlins at Washington Nationals
- provider event id: `102177819dfd6cad7f3edffb5fc4c527`
- provider commence time: `2025-09-01T17:06:00Z`

Discovery timestamp:

- `2025-09-01T16:05:00Z`

This is approximately one hour before the provider-reported first pitch.

The earlier superseded PR #166 used `2025-09-01T19:05:00Z`, which was postgame relative to the actual first pitch. PR #166 was closed and must not be used as pregame evidence.

## Hard execution boundaries

The V2 execution enforced:

- maximum provider calls: **2**
- maximum observed credits: **2**
- credit reserve: **2,000**
- historical event-odds request: **forbidden**
- DB rows persisted: **0**
- production mutations: **0**
- Official Picks mutations: **0**
- APOSTAR mutations: **0**

Observed execution:

- provider calls made: **2**
- credits observed: **2**
- requests remaining after: **2,901**
- historical odds requested: **false**
- rows persisted: **0**
- production mutations made: **0**

Call sequence:

1. `/historical/sports/baseball_mlb/events` — cost 1
2. `/historical/sports/baseball_mlb/events/{eventId}/markets` — cost 1

## Event-level market catalog observed

The provider returned the following market keys for this specific event/timestamp.

### Target period / team-total keys present

- `alternate_spreads_1st_1_innings`
- `alternate_spreads_1st_3_innings`
- `alternate_spreads_1st_5_innings`
- `alternate_spreads_1st_7_innings`
- `alternate_team_totals`
- `alternate_totals_1st_1_innings`
- `alternate_totals_1st_3_innings`
- `alternate_totals_1st_5_innings`
- `alternate_totals_1st_7_innings`
- `h2h_1st_1_innings`
- `h2h_1st_3_innings`
- `h2h_1st_5_innings`
- `h2h_1st_7_innings`
- `h2h_3_way_1st_1_innings`
- `h2h_3_way_1st_3_innings`
- `h2h_3_way_1st_5_innings`
- `h2h_3_way_1st_7_innings`
- `spreads_1st_3_innings`
- `spreads_1st_5_innings`
- `spreads_1st_7_innings`
- `team_totals`
- `team_totals_1st_5_innings`
- `totals_1st_1_innings`
- `totals_1st_3_innings`
- `totals_1st_5_innings`
- `totals_1st_7_innings`

Target-key count: **26**.

### Not observed among the target families

Notably, standard `spreads_1st_1_innings` was **not** present for this event/timestamp even though alternate first-inning spreads were present.

This is important evidence that:

> provider-level support does not imply event-level availability.

### Other observed markets

The event catalog also included:

- `h2h`
- `spreads`
- `totals`
- `alternate_spreads`
- `alternate_totals`
- batter prop families such as hits, doubles, triples, singles, RBI, runs scored, HRRBI, total bases, home runs and alternates
- `first_team_to_score`
- `odd_even`
- `overtime`
- first-inning pitch-result markets

This catalog is discovery evidence only. No historical prices/points were downloaded.

## Cost implication

The next historical endpoint for actual odds is materially more expensive than market discovery.

The project currently has a reserve policy of 2,000 credits. The discovery result left 2,901 credits according to the provider response.

Therefore a full-season per-event historical backfill for period markets is **not authorized** from this result alone.

Any next acquisition must be one of:

1. a free/public historical corpus with real sportsbook line/price/timestamp provenance;
2. BALLDONTLIE data, if the runtime subscription/key and endpoint coverage are proven;
3. a deliberately bounded The Odds API pilot with an explicit game sample and market list.

## Research disposition

The previous blocker `UNKNOWN_PROVIDER_MARKET_KEYS` is closed for these families.

The active blocker is now:

`BLOCKED_HISTORICAL_REAL_LINE_SAMPLE_SIZE`

The project has proven that real historical period/team-total markets exist at an event-level timestamp, but it does not yet possess enough real sportsbook historical rows to certify or retune formulas for those markets.

Do not convert this event-level discovery into model accuracy claims.
