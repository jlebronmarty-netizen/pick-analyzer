# NHL V6 — late pregame research protocol (Nov 19, 2026)

**Purpose:** Solve the timing mismatch between early NHL Poisson SHADOW freeze and the free ESPN goalie probable source, while prospectively freezing a single exploratory Circa Moneyline home-bias calibrator. **No official picks, no goalie model adjustment and no added provider calls.**

## What V6 actually does
- Keep early `nhl_challenger_shadow_v1` and immutable DRatings `nhl_free_predictions_v1` untouched.
- After the already scheduled daily 22:07 UTC free NHL-wide ESPN probable capture, create an **independent** append-only V6 decision for future games 60 minutes–8 hours ahead, with a fresh NHL run no older than 45 minutes and a source goalie snapshot no older than 45 minutes.
- Require BOTH named probable goalies, matched exactly by NHL game/teams/date, and original reliable timestamp; explicitly store `isConfirmedStarter:false`, `goalieAdjustmentApplied:false`, no verified player ID crosswalk.
- Recompute independent Poisson goal expectations *only with verified earlier finals as-of the new decision*; this is a **late baseline**, not a goalie-sensitive model.
- Capture a Circa pregame Moneyline quote no older than 40 minutes, matching event/scheduled time/teams, with observed timestamp before freeze. No public provider calls are made by V6.
- Historical home bias is calculated ONLY from games where: the score was observed after puck drop and **before** the late decision; a pregame Circa quote was captured >=10 minutes before that game's start; home/away IDs, event IDs and start times match; conflicting duplicate finals are excluded.
- Fixed exploratory formula from previous researched V0: `p_candidate = clamp(p_Circa_no_vig + rolling_bias * n/(n+50), 0.01, 0.99)` when `n>=20` fully eligible past games. No tuning/selection of bias parameters on current/future outcome, no validation claim.
- Store Circa no-vig baseline, original (early) DRatings probability, late independent Poisson probability, fixed candidate and goalie source evidence in the separate `nhl_late_shadow_v6` table. Record `prospectiveHoldoutValidated:false`, and never write to production pick or model tables.
- A read-only `/api/nhl/late-v6-readiness` reports row counts, prospective Brier comparisons, goalie coverage and missing sample gates; it cannot promote a candidate.

## Release safety
- Guarded by **OFF-default** `NHL_LATE_V6_SHADOW_ENABLED`. Existing free NHL cron only, at UTC hour 22 before minute 21. No additional crons or paid calls.
- Unique per event V6 ID; write-once upsert-ignoreDuplicates. Separate RLS table denies anonymous/authenticated, permits service-role SELECT/INSERT only and revokes UPDATE/DELETE/TRUNCATE.
- Migration: `supabase/migrations/20261119230700_nhl_late_shadow_v6.sql`, not safe to deploy before reviewed CI and verified Supabase migration.
- Source archive bounded: max 2000 NHL runs, 3500 quotes and 250 outcome/prediction rows, fail closed if truncated; max 16 V6 research writes in one cron invocation. No backfilling to prior NHL games.
- The standalone V6 is optional: if absent, original NHL collector, early V1 freeze and ESPN V5 remain unchanged. No changes to FanDuel/MLB/NBA/GOAT or any other sport.

## Gate for final NHL readiness
1. Verify one real V6 run after 22:07 UTC: goalie snapshot time < freeze < scheduled start by 60m; all early V1 rows unchanged.
2. Verify matched Circa odds/probabilities and count as-of prior observations; no future outcome used.
3. Freeze and monitor at least 30 independent **new** results for an initial calibration screen and 100+ across different dates for robust evaluation; use paired Brier, logloss, calibration, direction and identical per-game market quotes with uncertainty. Existing 54 retrospective Circa examples remain exploratory.
4. Obtain a documented verified pregame **confirmed starter** source and independent ESPN-to-NHL player crosswalk before any starter-specific goal adjustment; postgame longest time on ice is NOT equivalent to confirmed starter.
5. Research Puck Line/Total using exact available line and explicit pushes/OT/shootout book rules, not arbitrary -1.5 / Over5.5 proxies. Then evaluate goalie/PP-PK contribution in separately frozen paired ablations.
6. Promote to official model only following a separate reviewed release; no switch from research to official in this PR.

## Reference checked before implementation
- As of Nov 19 18:07 UTC: 16/16 free ESPN paired probables captured before puck drop but all 15 matching early V1 freezes preceded goalie evidence by 8.2 hours mean; 0 confirmed starters.
- NHL Moneyline paired 80 games: Circa no-vig Brier .23890 vs frozen DRatings .24862; prospective improvement of previously selected calibration still **unproven**.
- 29 original NHL Poisson V1 frozen, 20 evaluated, no winner prediction validated. No arbitrary target ROI claim.
