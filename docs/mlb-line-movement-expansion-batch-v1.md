# MLB Line Movement Expansion Batch V1

Last updated: 2026-07-14

## Scope

- Provider: SportsDataIO Discovery Lab MLB Odds
- Date: `2026-07-12`
- Endpoint: `GET /api/mlb/odds/json/GameOddsLineMovement/{gameid}`
- New provider calls used: 14
- Concurrency: 1
- Retries: 0
- Timeout: 15 seconds
- Raw payload storage: none
- Production promotion: none

The pre-expansion audit found 15 persisted MLB events for `2026-JUL-12` and excluded the already completed GameId `78723`. The remaining safe GameIds were:

`78729`, `78724`, `78730`, `78732`, `78731`, `78722`, `78725`, `78727`, `78726`, `78733`, `78734`, `78735`, `78728`, `78736`.

Every remaining event had a mapped `sport_events` row, resolved home/away teams, event start, completed final result, existing `GameOddsByDate` rows, no existing completed line-movement sync job, no duplicate provider event mapping and no doubleheader ambiguity.

## Provider Results

All 14 approved calls returned HTTP 200.

| GameId | Nested records | Rows | Cutoff-safe | Inserted | Reused | Rejected | Moneyline | Run line | Total | Oldest timestamp | Newest timestamp |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| 78729 | 383 | 2,292 | 1,704 | 2,292 | 0 | 0 | 766 | 760 | 766 | 2026-07-11T19:15:08.000Z | 2026-07-12T17:34:45.000Z |
| 78724 | 264 | 1,578 | 846 | 1,578 | 0 | 0 | 526 | 526 | 526 | 2026-07-12T00:50:02.000Z | 2026-07-12T17:34:44.000Z |
| 78730 | 324 | 1,934 | 1,262 | 1,934 | 0 | 0 | 648 | 640 | 646 | 2026-07-11T19:15:08.000Z | 2026-07-12T17:39:59.000Z |
| 78732 | 519 | 3,096 | 2,190 | 3,096 | 0 | 0 | 1,038 | 1,020 | 1,038 | 2026-07-11T18:16:57.000Z | 2026-07-12T17:39:59.000Z |
| 78731 | 333 | 1,992 | 1,386 | 1,992 | 0 | 0 | 664 | 664 | 664 | 2026-07-12T00:37:16.000Z | 2026-07-12T17:39:59.000Z |
| 78722 | 280 | 1,660 | 952 | 1,660 | 0 | 0 | 558 | 544 | 558 | 2026-07-12T00:50:02.000Z | 2026-07-12T17:39:58.000Z |
| 78725 | 661 | 3,954 | 2,886 | 3,954 | 0 | 0 | 1,322 | 1,310 | 1,322 | 2026-07-11T18:11:57.000Z | 2026-07-12T17:38:50.000Z |
| 78727 | 627 | 3,718 | 2,938 | 3,718 | 0 | 0 | 1,254 | 1,216 | 1,248 | 2026-07-11T18:22:01.000Z | 2026-07-12T18:09:53.000Z |
| 78726 | 299 | 1,770 | 1,254 | 1,770 | 0 | 0 | 598 | 578 | 594 | 2026-07-11T18:20:19.000Z | 2026-07-12T18:09:53.000Z |
| 78733 | 440 | 2,628 | 1,740 | 2,628 | 0 | 0 | 880 | 870 | 878 | 2026-07-11T18:34:06.000Z | 2026-07-12T18:14:57.000Z |
| 78734 | 239 | 1,428 | 906 | 1,428 | 0 | 0 | 476 | 476 | 476 | 2026-07-12T02:43:33.000Z | 2026-07-12T18:34:56.000Z |
| 78735 | 384 | 2,270 | 1,652 | 2,270 | 0 | 0 | 768 | 734 | 768 | 2026-07-11T18:39:48.000Z | 2026-07-12T20:04:51.000Z |
| 78728 | 357 | 2,132 | 1,628 | 2,132 | 0 | 0 | 714 | 704 | 714 | 2026-07-11T18:39:48.000Z | 2026-07-12T20:09:28.000Z |
| 78736 | 380 | 2,270 | 1,568 | 2,270 | 0 | 0 | 760 | 750 | 760 | 2026-07-11T18:39:48.000Z | 2026-07-12T20:09:28.000Z |

Sportsbook was `Consensus` for every normalized row. Invalid line count was 0 for every game. Invalid price rows were rejected by the normalizer before persistence and did not create stored odds rows.

## Full-Date Odds Quality

- Total line-movement snapshots: 36,442
- Total cutoff-safe snapshots: 25,498
- Events represented: 15 of 15
- Events with usable cutoff-safe market coverage: 15 of 15
- Duplicate logical rows: 0
- Orphan odds: 0
- Unresolved events: 0
- Invalid stored moneyline lines: 0
- Invalid stored run lines: 0
- Invalid stored totals: 0
- Invalid stored American prices: 0
- Quarantine violations: 0
- Raw payload leakage: 0
- Secret exposure: 0

## Feature, Prediction And Settlement Batch

The existing `/api/features/store` route actions were reused. No new API route, dashboard panel, table or prediction engine was added.

- Feature snapshots attempted: 45
- Feature snapshots inserted first run: 42
- Feature snapshots reused first run: 3
- Feature snapshots rerun: 0 inserted, 45 reused
- Predictions attempted: 45
- Predictions inserted first run: 42
- Predictions reused first run: 3
- Predictions rerun: 0 inserted, 45 reused
- Settled predictions: 45
- Wins: 21
- Losses: 24
- Pushes: 0
- Voids: 0
- Pending: 0

By market:

| Market | Sample | Wins | Losses | Pushes | Voids | Pending |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Moneyline | 15 | 7 | 8 | 0 | 0 | 0 |
| Spread/run line | 15 | 7 | 8 | 0 | 0 | 0 |
| Total | 15 | 7 | 8 | 0 | 0 | 0 |

Technical backtest summary:

- Sample size: 45
- Average offered odds: -56.62
- Average predicted probability: 41.73%
- Brier score: 0.25118
- Duplicate feature keys: 0
- Duplicate prediction identities: 0
- Orphan prediction links: 0
- Recommended picks: 0
- Production-eligible feature snapshots: 0
- Production-eligible predictions: 0

This is real non-scrambled data, quarantined, technical validation only. It is not production performance, not model-promotion evidence and not a wagering recommendation.

## CLV Readiness

- Rows with valid later pregame comparison candidates: 42
- Rows without later pregame snapshot: 3
- Sportsbook mismatch: 0
- Line identity mismatch: 0
- Rows exposed to production CLV metrics: 0

No row was labeled as closing-line evidence. CLV remains quarantined technical readiness only until a separate closing-line policy is approved.

## Production Data Gate

All paid MLB rows remain `trial=false`, `scrambled=false`, `production_eligible=false` and quarantined in metadata. Production-facing recommendations, bankroll, Kelly, portfolio, model learning, calibration, production ROI and production CLV remain blocked.

Gate counts:

- Quarantined line-movement source rows: 36,442
- Valid stored line-movement odds rows: 36,442
- Valid feature snapshots: 45
- Linked predictions: 45
- Settled predictions: 45
- Timestamp-blocked line-movement rows for feature selection: 10,944
- Mapping-blocked rows: 0
- Sufficiency-blocked feature snapshots: 0
- Quality-blocked feature snapshots: 0
- Settlement-blocked predictions: 0
- Closing-snapshot-blocked production metric rows: 45
- Manual production candidates: 0

## Daily Capture Contract

The disabled MLB personal-plan Daily Sync descriptor represents a conservative 12-step contract:

1. schedule/status sync
2. initial `GameOddsByDate` capture
3. mid-day odds refresh
4. pregame odds refresh
5. optional final pre-first-pitch capture
6. availability/projection refresh where supported and approved
7. postgame results
8. team game stats
9. player game stats
10. settlement
11. data quality
12. technical reporting

Typical estimated daily calls: about 8 provider calls. Full-slate historical reconstruction with one line-movement call per 15 games would be about 22 calls. Both are under the 1,000-call plan. `GameOddsByDate` is one call per date, not per game. `GameOddsLineMovement` is not represented as routine every-game polling. Cron remains disabled.

## Remaining Blockers

- No production promotion is approved.
- No closing-line policy is approved.
- Larger samples and explicit production eligibility rules are still required before production ROI, calibration, learning, CLV or model promotion.
