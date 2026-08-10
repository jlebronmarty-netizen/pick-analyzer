# Odds Primary Authority V1

Status: `DUAL_READ_IMPLEMENTED_NOT_PRODUCT_PROMOTED`

ODDS-03 adds a reversible odds authority layer for MLB odds. The Odds API can now be represented as the primary odds candidate while SportsDataIO remains retained for rollback and remains the product odds authority until a later explicit promotion gate passes.

## Authority Stages

| Stage | Product authority | The Odds API role | SportsDataIO role |
| --- | --- | --- | --- |
| `STAGE_0_SPORTSDATAIO_AUTHORITY` | SportsDataIO | Off/shadow | Primary |
| `STAGE_1_DUAL_READ` | SportsDataIO | Candidate/internal comparison | Primary + rollback |
| `STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL` | SportsDataIO | Internal primary candidate | Rollback |
| `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` | The Odds API | Product authority | Rollback |
| `STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE` | The Odds API | Product authority | Disabled for odds only, retained for rollback |

Default local implementation stage: `STAGE_1_DUAL_READ`.

## Certified Book Set V1

Only repeatedly observed books are eligible for production price selection:

| Book |
| --- |
| FanDuel |
| DraftKings |
| BetMGM |
| Caesars |

Other books may remain context-only until separately certified.

## Exact-Line Identity

Actionable odds identity is:

`eventId + market + selection + line`

Moneyline uses `line = null`. Run Line and Total require an exact line. A prediction for `Over 8.0` must never use an `Over 8.5` price. A prediction for `-1.5` must never use a `+1.5` price.

## Freshness Authority

Actionability freshness uses the provider source timestamp. Snapshot capture time is useful operational context but cannot make old underlying sportsbook evidence fresh.

Fail-closed statuses:

- `NO_FRESH_PRICE`
- `NO_FRESH_EXACT_LINE_PRICE`
- `WAITING_FOR_CURRENT_LINE_PREDICTION`
- `WAIT_FOR_REFRESH`

## Price Selection

Policy: `BEST_FRESH_WITH_USER_BOOK_PREFERENCE`.

If the preferred certified book has a fresh exact-line price, use it. Otherwise choose the best fresh exact-line price among `CERTIFIED_BOOK_SET_V1`. No stale price wins and no cross-line selection is allowed.

## Re-Prediction

Line-versioned re-prediction is represented by an executable gated command contract:

- event must be pregame;
- now must be before cutoff;
- required features must be available;
- market must be supported;
- exact new-line prediction must not already exist;
- fresh current price must exist;
- original prediction remains preserved;
- lineage records `supersedeReason = MARKET_LINE_CHANGED`.

ODDS-03C-R2 adds the bounded writer service:

`src/services/line-versioned-reprediction-writer.service.ts`

The writer reuses the existing shared sport prediction SDK and recommendation
policy gates. It does not interpolate an old-line probability. For a line move
it derives the underlying pregame projection context from the prior prediction,
passes the new exact line into `buildSportPrediction`, and produces a new
versioned prediction identity.

Stage behavior is explicit:

| Stage | Writer behavior |
| --- | --- |
| `STAGE_1_DUAL_READ` | Non-persistent shadow execution / would-write certification only |
| `STAGE_2_THE_ODDS_API_PRIMARY_INTERNAL` | Non-product internal candidate behavior until separately promoted |
| `STAGE_3_THE_ODDS_API_PRIMARY_PRODUCT` | Persistent writer may create cutoff-safe exact-line prediction rows |
| `STAGE_4_SPORTSDATAIO_ODDS_DISABLED_ROLLBACK_AVAILABLE` | Persistent writer may create cutoff-safe exact-line prediction rows while SportsDataIO remains rollback |

The writer never changes Official Pick thresholds, HR-03 calibration state,
settlement logic, learning weights, or provider authority.

## Scheduler Integration

The event refresh planner reports `oddsPrimaryAuthority` metadata and The Odds API certified book configuration. ODDS-03A wires `STAGE_1_DUAL_READ` into the existing protected Vercel operating-day scheduler path:

`Vercel Cron -> /api/cron/operating-day -> adaptive refresh -> SportsDataIO canonical acquisition -> The Odds API shadow dual-read -> line-versioned re-prediction writer`

The dual-read branch is bounded to one league-wide MLB odds request after a SportsDataIO canonical refresh selects eligible market-refresh events. The Odds API rows are stored with `authorityStatus = SHADOW_NON_AUTHORITATIVE`, `productPriceAuthority = false`, and `production_eligible = false`. Current product surfaces remain filtered to the configured product authority provider, so Stage 1 cannot replace SportsDataIO prices.

Under Stage 1, the line-versioned writer records no prediction writes. It
reports moved-line eligibility, dedupe, blocked cases, and would-create counts
from already-acquired market evidence.

The Vercel primary scheduler continues using the existing protected endpoint and does not create a competing scheduler.

## Rollback

Rollback authority remains SportsDataIO. The authority stage is configuration-driven through `ODDS_PRIMARY_AUTHORITY_STAGE`; switching back to `STAGE_0_SPORTSDATAIO_AUTHORITY` does not require code rollback.

## Safety

- SportsDataIO subscription is not cancelled.
- SportsDataIO code is not removed.
- The Odds API uses `THE_ODDS_API_KEY`.
- Legacy `ODDS_API_KEY` consumers are not silently switched.
- HR-03 calibration remains shadow-only.
- Official Pick thresholds are unchanged.
- Production probabilities, confidence, Kelly, settlement, learning and ranking policies are unchanged.
