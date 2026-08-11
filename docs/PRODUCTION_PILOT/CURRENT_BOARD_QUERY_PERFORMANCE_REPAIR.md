# Current Board Query Performance Repair

## Verdict

`CURRENT_BOARD_QUERY_PERFORMANCE_REPAIR_LOCAL_PASS_PUSH_REQUIRED`

## Scope

This repair targets the Current Board product odds read that previously failed under Stage 3 production load with:

`current board odds read failed: canceling statement due to statement timeout`

The health wrapper remains defensive, but this repair reduces the real `sports_odds_snapshots` read scope instead of hiding the failure.

## Failing Query Before

`src/services/current-board.service.ts` used `readOddsForEvents()` to query `sports_odds_snapshots` by:

| Dimension | Before |
| --- | --- |
| Sport | `sport_key = baseball_mlb` |
| Events | current candidate `event_id in (...)` |
| Provider | active product authority provider |
| Markets | `moneyline`, `run_line`, `total` |
| Books | unbounded |
| Recency | 24-hour eligibility freshness window |
| Ordering | `snapshot_time desc` |
| Limit | 1000 rows per 50-event chunk |

The timeout root cause is classified as:

`BOOK_FILTER_AFTER_FETCH + TOO_MANY_HISTORICAL_SNAPSHOTS_PER_EVENT + ORDER_BY_WITHOUT_PRODUCT_SCOPE`

## Query After

Current and Upcoming modes now query product odds by:

| Dimension | After |
| --- | --- |
| Sport | unchanged |
| Events | unchanged, but chunked at 10 events |
| Provider | existing authority resolver, no hardcoded permanent provider |
| Markets | `moneyline`, `run_line`, `total` |
| Books | certified book set for The Odds API: FanDuel, DraftKings, BetMGM, Caesars |
| Recency | 90-minute product evidence window |
| Ordering | `snapshot_time desc` |
| Limit | 2500 rows per 10-event chunk |

Historical Explorer and All Stored Advanced modes retain broad historical behavior.

## Read-Only Data Volume Evidence

Captured on `2026-08-11T15:43:28.042Z` using Supabase count-only reads:

| Scope | Rows |
| --- | ---: |
| `sports_odds_snapshots` total | 254,447 |
| MLB odds snapshots | 250,883 |
| MLB The Odds API snapshots | 151,151 |
| MLB The Odds API snapshots in prior 24h | 100,196 |
| MLB The Odds API snapshots in prior 90m | 8,892 |
| Current 15 event IDs, The Odds API, prior 24h | 67,716 |
| Current 15 event IDs, The Odds API, certified books, core markets, prior 90m | 2,412 |

The repaired product-critical query therefore removes the 24-hour, all-book current-event scan from the Current Board path while retaining enough recent evidence to decide product actionability.

## Why 90 Minutes

The product display stale threshold is 30 minutes. Current Board does not need months or days of odds history to determine current actionability. A 90-minute window preserves fresh, aging, and fail-closed context while preventing old repeated snapshots from dominating the product-critical read. If no current exact-line price exists in the bounded window, the board remains fail-closed rather than binding an old price.

## Safety

- Exact event / market / selection / line matching remains in `oddsMatchesPrediction()`.
- Complement-side price matching still requires same provider, same book, same market, and exact complement line.
- Stage 1 rollback remains valid because certified-book filtering applies only when The Odds API is the product provider.
- No provider authority was changed.
- No Vercel configuration was changed.
- No prediction formula, Official Pick threshold, settlement rule, learning rule, HR-03 status, R2 behavior, or MLB data-source mode was changed.
- No production DB migration is required for this code-only repair.

## Index Assessment

Existing indexes:

- `sports_odds_snapshots_event_idx`
- `sports_odds_snapshots_market_idx`
- `sports_odds_snapshots_current_board_event_market_idx`

The proven immediate defect is over-broad product read scope, not an index-only defect. A future additive composite index may still be useful if production evidence after deployment proves an index gap remains, but no production DB mutation is authorized or required by this repair.

## Validation

The validator checks:

- exact timeout query identified;
- event-first scope preserved;
- authority provider filter preserved;
- certified-book scope added only for The Odds API;
- recency scope bounded;
- exact-line matching unchanged;
- latest-price sorting unchanged;
- fail-closed behavior preserved;
- health wrapper remains safe;
- settlement remains decoupled;
- SportsDataIO zero-call behavior preserved;
- The Odds API product-primary behavior preserved;
- MLB Official primary behavior preserved;
- R2 line-versioned writer behavior preserved.
