# ODDS-01 Market Freshness Provider Audit

Status: PASS WITH PROVIDER ARCHITECTURE RECOMMENDATION  
Production Pilot Week: ACTIVE  
Date: 2026-08-08  
Starting commit: `a9879543a94fc5817cfe1d1da82a16e7c2c2ca3a`  
Production commit: `a9879543a94fc5817cfe1d1da82a16e7c2c2ca3a`

## Verdict

ODDS-01 found no evidence that Pick Analyzer is discarding fresher book-specific odds during normalization. The current stale-odds issue is explained by the active SportsDataIO production path returning `Consensus` evidence whose provider/source market timestamp can be several hours older than the successful provider call and snapshot capture time.

The product safety gate is working: all visible stale current candidates were marked `STALE` with `WAIT_FOR_REFRESH`.

Production Pilot Week may continue because stale source evidence is not actionable. The recommended next odds phase is a specialized bookmaker-specific odds provider adapter, not a scheduler cadence change.

## Current Provider and Endpoint

| Field | Value |
| --- | --- |
| Current odds provider | SportsDataIO |
| Active endpoint | `/api/mlb/odds/json/GameOddsByDate/{date}` |
| HTTP method | GET |
| Request granularity | DATE |
| Active product path | Discovery Lab URL resolver with `SPORTSDATAIO_MLB_API_KEY` |
| Active markets | Moneyline, run line, total |
| Current subscription tier | UNKNOWN from repository/runtime evidence |
| Current returned sportsbook identity in visible candidates | `Consensus` |
| Provider calls from certification reads | 0 |
| Database mutations from certification reads | 0 |

## Production Evidence

Read-only endpoints used:

- `/api/system/version`
- `/api/dashboard/today`
- `/api/current-board?mode=current&limit=200`
- `/api/market-opportunities/most-likely`
- `/api/market-opportunities/best-value`
- `/api/operations/health`
- `/api/operations/data-freshness`
- `/api/operations/event-refresh-plan?sportKey=baseball_mlb&operatingDate=2026-08-08&limit=200`
- `/api/operations/event-lifecycle?sportKey=baseball_mlb&operatingDate=2026-08-08&limit=200`
- `/api/providers/budget/status?provider=sportsdataio&sportKey=baseball_mlb`
- `/api/performance`
- `/api/operations/settlement-guarantee?includeValidation=true`
- `/api/mission-control`

All listed public endpoints returned HTTP 200.

Acquisition history limitation:

Public read-only endpoints exposed the latest active canonical acquisition, not a full multi-call history. During ODDS-01, two natural Vercel primary acquisitions were observed (`23:17Z` and `23:27Z`), both with approximately 240 minutes of source lag. ODDS-01 does not fabricate a three-call reconstruction where production did not expose one.

Latest exposed active acquisition:

| Field | Value |
| --- | --- |
| Source | Vercel primary operating-day cron |
| Started | `2026-08-08T23:27:28.555Z` |
| Completed | `2026-08-08T23:27:29.022Z` |
| Endpoint | `/api/mlb/odds/json/GameOddsByDate/2026-08-08` |
| Actual HTTP requests | 1 |
| Actual quota units | 1 |
| Provider records fetched | 15 |
| Pregame odds flattened | 2 |
| Normalized rows produced | 12 |
| Rows inserted | 12 |
| Rows updated | 0 |
| Freshness before | `2026-08-08T13:47:28Z` |
| Freshness after | `2026-08-08T19:27:11Z` |
| Provider response observed at | `2026-08-08T23:27:28.881Z` |
| Source lag after acquisition | approximately 240 minutes |

Visible Current Board evidence:

| Metric | Value |
| --- | --- |
| Candidate count | 6 |
| Sportsbooks returned/exposed | `Consensus` |
| Newest provider/source timestamp | `2026-08-08T19:17:15Z` |
| Oldest provider/source timestamp | `2026-08-08T18:46:57Z` |
| Latest snapshot capture timestamp | `2026-08-08T23:17:34.766Z` |
| Median source lag | 240 minutes |
| Maximum source lag | 240 minutes |
| Stale candidates actionable | No |

Example candidate:

| Field | Value |
| --- | --- |
| Event | LAD @ ARI |
| Market | Run line |
| Selection | LAD -1.5 |
| Price | -103 |
| Binding mode | COMPLEMENT |
| Sportsbook | Consensus |
| Source timestamp | `2026-08-08T19:17:15Z` |
| Capture timestamp | `2026-08-08T23:17:34.766Z` |
| Freshness | STALE |
| Actionability | WAIT_FOR_REFRESH |

## Freshness Explanation

The 23:27 provider call proves app acquisition, not market freshness. The actionable market evidence remained timestamped around 19:27. This means the provider response either contained unchanged underlying sportsbook/consensus evidence or did not expose newer book-specific evidence through the active endpoint/entitlement.

Therefore:

- Polling at 23:17 succeeded.
- Snapshot capture at 23:17 succeeded.
- Stored rows were inserted.
- The source market timestamp remained about four hours old.
- Product Freshness SLA correctly blocked betting action.

## Normalization Finding

Classification: `NO_NORMALIZATION_LOSS`

Reason:

- Normalization preserves sportsbook, sportsbook ID, provider game odd ID, market, selection, line, price and timestamp.
- Stable odds IDs include sportsbook and line identity.
- The current production evidence shows only `Consensus` sportsbook labels for visible current candidates.
- There is no production evidence that fresher FanDuel, DraftKings, BetMGM or Caesars rows were received and then discarded.

## Consensus Selection Finding

Classification: `CONSENSUS_ROW_STALE`

The current product is using stored rows labelled `Consensus`. This is safe only as long as Product Freshness SLA blocks stale evidence from becoming actionable. It is not sufficient as a final betting-price architecture because a user may need real book-specific availability and best available price.

## Polling Finding

Classification: `PROVIDER_SOURCE_DELAY`, not primary `APPLICATION_POLLING_TOO_SLOW`.

The app performed a recent provider call and still received source market timestamps approximately 240 minutes old. Increasing polling frequency alone cannot fix stale source evidence if the provider path returns unchanged rows.

## Provider Comparison

| Provider | MLB core markets | Book-specific pricing | Props | Historical odds | Freshness evidence | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| SportsDataIO current path | Yes: moneyline, run line, total | Repository supports it; production visible rows are Consensus only | Official docs show props/products, entitlement unknown | Possible through product lines, entitlement unknown | Current path showed source lag around 240 minutes | Keep for stats/results; insufficient as sole betting-price provider without entitlement proof. |
| The Odds API | Yes: h2h, spreads, totals | Yes: bookmaker arrays and bookmaker/market `last_update` | MLB props on Business tier per public docs | Historical archive on paid tiers | FAQ says live/in-play can update as frequently as every 30 seconds; responses carry bookmaker `last_update` | Best fit for specialized odds layer. |
| Sportradar | Broad odds and props capabilities | Yes, commercial feed dependent | Player props documentation lists major books and change-log mechanisms | Commercial product dependent | Player props FAQ documents checks around 60 seconds for that area | Strong but likely higher commercial/integration lift. |

## Price Policy Recommendation

Do not use consensus as the only production betting price.

Recommended policy:

- Keep model probability independent of price.
- Use a certified bookmaker set for Official Pick edge and EV.
- Use best available certified fresh book price for Best Value and product presentation.
- Show consensus as context.
- Allow user-selected sportsbook later for personal wager workflow.
- Block stale/unknown source evidence regardless of sportsbook.

## Root Cause Classification

| Classification | Status | Evidence |
| --- | --- | --- |
| `PROVIDER_SOURCE_DELAY` | PROVEN | 23:27 acquisition returned source timestamp 19:27. |
| `CONSENSUS_ROW_STALE` | PROVEN | Visible candidates use `Consensus` only and are stale. |
| `PROVIDER_DATA_NOT_REAL_TIME` | SUPPORTED FOR CURRENT PATH | Observed production source lag; exact entitlement remains unknown. |
| `PROVIDER_TIER_LIMITATION` | POSSIBLE, NOT PROVEN | Current tier not exposed safely. |
| `FRESHER_BOOK_ROWS_DISCARDED` | NOT PROVEN | Normalization preserves books; no fresher individual-book rows exposed. |
| `NORMALIZATION_DEFECT` | NOT PROVEN | No collapse/drop evidence found. |
| `APPLICATION_POLLING_TOO_SLOW` | NOT PRIMARY | A recent provider call still returned stale source evidence. |

## Production Pilot Safety

Production Pilot Week can continue.

Safety requirements still in force:

- Stale market evidence cannot become actionable.
- Rent Play remains `WAIT_FOR_REFRESH` when stale.
- Smart Parlay excludes stale legs.
- Official Picks must not use stale prices.
- No freshness thresholds, provider budgets or scheduler cadence were changed.

## Human Decision Required

Choose whether to add a specialized odds provider account for bookmaker-specific MLB prices.

Recommended decision:

Option B: keep SportsDataIO for schedule/results/status and add The Odds API as the primary current odds provider for sportsbook-specific MLB moneyline, run line and totals, with Business tier later if player props are required.

## Next Recommended Phase

Create an implementation plan for a specialized odds adapter:

1. Add a provider adapter behind the existing provider architecture.
2. Store bookmaker-specific snapshots with source and capture timestamps.
3. Build best-price and consensus selectors.
4. Preserve current stale-actionability gates.
5. Certify Current Board, Rent Play, Moneyline, Smart Parlay and Watchlist against exact sportsbook identity.
6. Leave SportsDataIO as primary stats/results provider.

Do not start Historical Replay, Player Props or MC-03 from ODDS-01.
