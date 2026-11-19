# NHL — Readiness audit (Nov 19, 2026)

**Research only.** All numbers from read-only Supabase Pick Analyzer at about 18:07 UTC Nov 19. No change to main, frozen forecasts, model weights, provider subscriptions or crons.

## Operating checks
- 724 NHL runs: 677 PASS / 47 PARTIAL; latest PASS Nov 19 18:07 UTC.
- 111 DRatings predictions, 99 outcome rows, no overdue settled-eligible match at review.
- 29 frozen Poisson SHADOW predictions, 20 outcome matched, zero official picks / zero production eligible.
- 2938 Circa ML quote observations from 92 events.

## Calibration — not ready
- DRatings home-win Brier = 0.24127 across 99 finished games; average predicted home probability 0.5361, observed home-win rate 0.4444. Descriptive, not a calibrated deployment.
- Strict 80-game same-event, same-team, pregame Circa quote pairing: DRatings Brier 0.24862 / logloss 0.69216 / 43 correct versus Circa no-vig Brier 0.23890 / logloss 0.67095 / 47 correct. The quote may be newer than frozen DRatings, so NOT a same-time EV or CLV claim.
- Re-executed the already locked exploratory rolling Circa bias v0 on 54 eligible pairs: Circa Brier 0.25446 versus corrected 0.24537; naïve IID CI for gain [-0.00663, 0.02482] includes zero. It is post-hoc, no independent holdout.
- Poisson shadow on only 20 settled: Moneyline Brier 0.28240, 10/20 correct; same 20 DRatings Brier 0.27933, 9/20 correct. Home -1.5 fixed research proxy Brier 0.29934; Over 5.5 fixed research proxy Brier 0.25069; Total goals MAE 1.922, home margin MAE 2.603. Not model validation.
- Rest-only uniform penalties were previously shown to worsen tiny-sample Brier. Do not activate.
- Reproducible, executed SQL: sql/research/nhl_20261119_circa_calibration_baseline.sql

## Goalies — capture good, freeze timing wrong for model V1
- Three successful free ESPN captures Nov 16–18, with 2 + 11 + 3 games respectively, all 16/16 paired probable-only goalies, **zero confirmed**. One free ESPN-wide call daily around 22:07 UTC, no model adjustments or official claims.
- Nov 19 capture was NOT due at the audit's 18:07 UTC snapshot; no demonstrated Nov 19 outage.
- All 16 ESPN goalie snapshots arrived >=1h before puck drop, average 2.87h lead, minimum 1.87h. They can inform a **separate late pregame** research decision.
- 15 of those 16 events had an earlier immutable frozen Poisson record. The goalie info was captured AFTER that freeze for all 15 (mean 8.20h later). Thus 0/15 could enter that original decision. Correct as-of exclusion is necessary; never backfill into old decisions.
- Postgame NHL boxscore name audit: the 16 paired probable records (32 sides) match 32/32 abbreviated names of the player with the longest time on ice. This is source concordance only, NOT a proof the goalie was officially confirmed pregame or even that longest TOI always means true starting goalie.
- ESPN goalie athlete IDs and NHL player IDs are not interchangeable; no verified immutable crosswalk yet. sport_lineups currently contains zero NHL confirmed goalies.
- Reproducible, executed SQL: sql/research/nhl_20261119_goalie_asof_readiness.sql

## PP/PK, other sources and market contracts
- Five 32-team daily PP/PK captures Nov 15–19. 24/29 Poisson SHADOW frozen records attach PP/PK context; none have independently verified model value or official use. All 29 have historical goalie/rest research context, not next-game confirmed goalie.
- Source-reused Circa quotes in NHL runs: 925 pregame spread rows across 32 events (20 completed), 925 pregame totals across same 32 (20 completed). Spreads include home +1.5 or -1.5; totals vary 5.5, 6, 6.5.
- Zero spread/total rows have certified OT/SO sportsbook settlement rules. They are NOT FanDuel. Poisson currently outputs fixed research -1.5 and Over 5.5, not exact odds-linked markets.

## Precise exit gates
1. Build an **append-only late-pregame goalie research record** after the free ~22:07 ESPN snapshot, separate from the immutable early SHADOW. Zero paid calls. Require pregame observation timestamp, verified team and probable status. Do not call an unconfirmed goalie 'confirmed'.
2. Verify player ID crosswalk, historical goalie stats computed strictly before this late decision, and independent source with actual published-before-game **confirmed starter** evidence. Backtest probable name concordance independently; keep denominators (probable, confirmed, missing).
3. Freeze a single calibration challenger using the pregame Circa/DRatings series, prevent lookahead (result observed before later forecast), then prospectively assess out-of-sample Brier, logloss, accuracy and calibration. At least 30 independent holdout games for an initial screen, preferably 100+ across multiple days to consider release. Do not tune repeatedly on prior cohorts.
4. Calibrate Poisson against real line-specific home puck spread / game totals incl integer push, OT/SO contract and true matched quote timestamp. Test goalie, PP/PK and rest as **separate paired ablations**; a higher retrospective accuracy is insufficient for ROI.
5. No model promotion, Official Picks, extra paid API usage or modifications to NBA/GOAT or paused MLB until a validated prospective gate passes.

Status: read-only audit done. Current production models and scheduled crons unchanged.
