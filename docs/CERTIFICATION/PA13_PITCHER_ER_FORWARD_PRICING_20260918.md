# PA-13 — Pitcher Earned Runs forward pricing certification

Date: 2026-09-18

Status: `FORWARD_CURRENT_PRICING_SOURCE_READY / HISTORICAL_PRICING_NOT_CERTIFIED`

## Contract

`PA13_PITCHER_ER_FORWARD_CAPTURE/1.0.0`

Provider market:

`pitcher_earned_runs`

Provider:

`the-odds-api`

This is a forward-only research pricing source. It does not create historical
pricing and does not certify ROI, CLV or EV.

## First prospective capture

Job:

`9d4c35f4-c0e3-4eac-9b44-3a44a8220fb0`

Target date:

`2026-09-18`

Persisted evidence:

- **180** quote rows
- **14** canonical MLB games
- **26** exact MLBAM pitchers
- **4** sportsbooks
- **31** distinct pitcher/line combinations
- **90** pitcher-book-line groups
- **90/90** complete Over/Under pairs
- **0** incomplete pairs
- **0** duplicate-ID groups
- **0** rows at/after target start
- quote lead time: **8h25m to 11h56m** before scheduled first pitch

Books observed:

- BetMGM — 52 rows / 14 events
- Bovada — 52 rows / 14 events
- DraftKings — 48 rows / 13 events
- Fanatics — 28 rows / 14 events

## Fail-closed identity exclusion

One provider event call was rejected and wrote **zero** Pitcher ER rows:

- lifecycle event: `baseball_mlb:mlb:sportsdataio:event:79584`
- canonical gamePk: `823572`
- provider event id: `49deafc3a88bf69634e0f3510d62b0ee`
- reason: `PROVIDER_EVENT_IDENTITY_MISMATCH`

The job is therefore correctly recorded as `partial`, not silently upgraded to
complete. The remaining 14 games are independently valid forward evidence.

## Credit boundary

- provider calls: **15**
- credits consumed: **15**
- credits remaining after capture: **5565**
- historical Odds API credits used by this work: **0**

## Certification

`PA13_FORWARD_CURRENT_PRICING_SOURCE_READY = YES`

`PA13_HISTORICAL_PRICING_CERTIFIED = NO`

`PA13_ROI_CERTIFIED = NO`

`PA13_CLV_CERTIFIED = NO`

`PA13_EV_CERTIFIED = NO`

`PA13_PRODUCTION_ELIGIBLE = NO`

## Next valid use

The forward corpus may be retained and, after final outcomes exist, joined to
research-only Pitcher ER predictions/outcomes using exact
`canonicalGamePk + pitcherMlbamId + line + book + timestamp` identity.

Do not infer or backfill historical economics from this forward corpus.

## Safety

- research-only / shadow-only
- Official Picks unchanged
- APOSTAR inactive
- no production promotion
- no historical Odds API credit spend
