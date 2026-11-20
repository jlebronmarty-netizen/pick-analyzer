# NCAAB — prospective side-preserving calibration (Nov 19, 2026)

**Scope:** Free NCAAB only. Keep NCAAB_PRESEASON_V1 original immutable, no NBA/GOAT or paid provider calls, no official picks, no model auto-promotion.

## Verified operational state
- 66 NCAAB daily core cycles were PASS as of Nov 19 22:00 UTC; 811 immutable predictions, 730 collected final outcomes, 84 official game contexts, 2,589 opponent records.
- Strict exact scheduled time + home/away ID identity + actual final observed after schedule produces **697** valid settled predictions, **546/697 (78.34%)** winner calls, Brier **0.19219**, log-loss **0.57321**, projected margin MAE **13.052**, total MAE **14.281**.
- Predicted home win rate on these games averaged **58.78%**; actual home win was **76.33%**. Model predicted margin minus actual home margin averaged **-6.402**, and predicted total minus actual total **-1.917**. These are cohort-dependent biases, not evidence a universal home adjustment is justified.
- Always picking home would achieve **532/697** directionally and a fixed baseline probability 0.75 has Brier **0.18086**, below the raw model Brier. This is a biased easy-schedule benchmark, not a tested betting strategy; sportsbook ML prices often missing.
- **33** finals differ from original scheduled time or home/away identity; some differ only by a known small delay or a verified side swap. They are excluded from the deliberately strict calibration history. Existing NCAAB reconciliation may settle these safely under its independent identity/time gate, but do not silently include them in our calibration.
- **Four** older forecasts have no final associated in this snapshot; the source can be postponed/rescheduled. No forced, invented settlement.

## Historical experiments — informative, NOT independent prospective validation
- Fixed 2026-11-14 00:00 UTC boundary: **426** valid results whose final was captured before the boundary are available as training; **165** subsequent forecasts issued after the boundary have results.
- Unrestricted fixed past residual + shrink factor n/(n+100) on the 165: ML Brier **0.19757 -> 0.17409**, but directional hits **128 -> 121**.
- **Side-preserving** projection caps probability on the same side of 50% as the frozen original: on the same 165, Brier **0.19757 -> 0.16633**, Log Loss **0.58469 -> 0.50629**, and winner hits **128 -> 128**. This is a retrospective exploratory check after looking at the sample; never label it a future holdout guarantee.
- Sequential as-of historical study on **504** games with >=100 earlier known final scores: raw ML Brier **0.19917**, unrestricted adjustment **0.17578**, raw picks **383**, unrestricted picks **372**. Margin MAE **12.556 -> 12.111** after shrinkage; Total MAE **14.306 -> 14.336**, so NO Total correction is deployed.
- High home-vs-visitor imbalance can reflect non-D1 opponents, neutral sites, and schedule mix, not genuine per-game edge. Require subgroup calibration and better location/competition metadata before adopting any broad correction.

## New prospective SHADOW protocol
- `NCAAB_CALIBRATION_SHADOW_ENABLED` defaults **OFF**. Only newly generated pregame forecasts in the just-completed existing NCAAB daily cron (created in the preceding 8 minutes, 60+ minutes to tip) can be frozen; no replay of earlier games.
- Historical records accepted into training only when original forecast was emitted before game, matching team IDs and exact scheduled time, its final observed after game AND before the CURRENT ORIGINAL forecast's emission. Reject duplicate candidate team/identity evidence, large reschedules, and any outcome not already known.
- At least 100 strictly earlier verified finals required, fixed shrink constant **100**. Produce a fully unrestricted probability candidate for diagnostics and a **side-preserving candidate** that cannot flip the original winner selection; freeze original probability, unchanged predicted winner, raw and adjusted margin, and **unchanged Total**.
- New append-only table `ncaab_calibration_shadow_v1` with RLS, deny public/authenticated, allow service role SELECT/INSERT and explicitly revoke UPDATE/DELETE/TRUNCATE. Timestamp and research-only constraints fail closed; source history digested for audit. No modifications to original data or production forecast model.
- The existing authenticated cron calls the guarded writer *after* core/causal processing. Zero extra provider HTTP calls, no new cron, no subscription, no FanDuel odds or bet orders.
- Read-only GET `/api/ncaab/calibration-shadow` scores the exact same settled games for baseline/unrestricted/side-preserving ML, margin MAE and unadjusted total; reports pending, invalid, and original winner hits alongside Brier and Log Loss.
- First 30 *new independent* games are only an initial check; 100+ across several dates/opponents and verified relative performance are needed before any official model promotion. Track side preservation, always-home benchmark and subgroup differences, and preserve original prior timestamps.

## Release sequence
1. CI unit/TypeScript and Vercel Preview success; no provider calls.
2. Review/apply additive migration and verify RLS/no update permissions.
3. Merge with no model changes and deploy production READY.
4. Enable `NCAAB_CALIBRATION_SHADOW_ENABLED=true` for production and redeploy exact reviewed Git commit. Only natural daily NCAAB cron collects future experiments.
5. First natural run must show source receipts, >100 as-of prior results, original winner unchanged, frozen source before event. Do NOT claim improved accuracy until later finals settle.
