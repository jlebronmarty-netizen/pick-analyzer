# NBA-01B The Odds API Historical-First Backfill

Status: `NBA_ODDS_HISTORICAL_BACKFILL_PARTIAL_RESUMABLE`

NBA-01B attempted the authorized 2024-25 NBA historical odds daily-card backfill using The Odds API only. SportsDataIO was not called, NBA production stayed inactive, and no NBA Current Era predictions or replay rows were generated.

## Outcome

The provider acquisition reached the database persistence phase, then Supabase returned a Cloudflare 520 during `sports_odds_snapshots` upsert. The process aborted before the odds rows and final `sports_sync_jobs` ledger row were written.

## Persisted Foundation

| Dataset | Rows |
| --- | ---: |
| The Odds API historical event foundation rows | 1,221 |
| The Odds API event provider mappings | 1,221 |
| Historical odds rows | 0 |
| NBA Current Era prediction writes | 0 |
| SportsDataIO calls | 0 |

## Budget

| Metric | Value |
| --- | ---: |
| Authorized The Odds API historical credits | 10,000 |
| Historical requests planned | 174 |
| Historical requests executed | 174 |
| Inferred credits used | 5,220 |
| Remaining under authorization | 4,780 |

Per-request response headers were held in process memory and were lost when the process aborted on database persistence. Credit use is therefore recorded as inferred from the certified request count and 30-credit request contract, not as a final provider-header ledger.

## Coverage

| Metric | Count |
| --- | ---: |
| Historical events discovered | 1,221 |
| Unique historical events | 1,221 |
| Moneyline price-aware events | 0 |
| Spread price-aware events | 0 |
| Total price-aware events | 0 |
| Full-core price-aware events | 0 |

## Remaining Gap

The event crosswalk foundation is useful for later stats-provider matching, but price-aware replay is not ready until odds rows are persisted. The complementary stat source is still required for final results, quarter scores, boxscores, team-game stats, player-game stats and players.

## Safety

- No SportsDataIO calls.
- No NBA production activation.
- No NBA scheduler activation.
- No Current Era NBA predictions.
- No bulk replay.
- No player props.
- No period markets.
- No MLB architecture change.

Final classification: `NBA_ODDS_HISTORICAL_BACKFILL_PARTIAL_RESUMABLE`.
