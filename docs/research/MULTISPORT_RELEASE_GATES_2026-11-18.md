# Pick Analyzer — multideporte operational release gates (2026-11-18, Puerto Rico)

This is a **research-only audit** of the canonical Pick Analyzer project, `jlebronmarty-netizen/pick-analyzer`, Supabase `ynuocvexviorgdjrfthw`, Vercel `prj_hmkAkzUTe3b7M7yedvshGl5L9rP7`. Do not confuse it with the legacy `sports-edge-hub` repo. All findings are as of 2026-11-18 ~22:09 UTC and are not current indefinitely.

## Technical releases completed and tested

| PR | Main commit | Scope | Verification |
|---|---|---|---|
| #353 | `49f8ea7dd42c1ab2074e369f35029a7612e4ce3d` | TT post-capture out-of-scope `forecasts.skipped` ReferenceError eliminated | TT tests, multisport dashboard, TypeScript, Preview + production READY |
| #354 | `9e874d975e31fad6399c2f43daefbc9ab03b85b7` | NCAAF safe same-event kickoff drift ≤120min, previous frozen decisions immutable | Original NCAAF tests, time guard tests, TypeScript, Preview + production READY |
| #355 | `daa7e7d0875973bfff6fbb4bb19711e1c1dda0ef` | NCAAB informational postponed/rescheduled source states from existing free cron captures; no W/L grading | NCAAB lifecycle tests, multisport dashboard, TypeScript, Preview + production READY |
| #357 | `061d7f7409a336983a57d2a3bca068117b4d65e6` | NCAAF fail-closed source diagnostic reports offending event ID and diagnostic category | Existing source tests, identity tests, TypeScript, Preview + production READY |
| #360 | `6f6dd95680a1563617453e6de9324b1645f7c62a` | TT backlog prioritizes one oldest and one recent untried result; truthful `SETTLEMENT_BACKLOG` status; budget unchanged | TT core tests, queue tests, dashboard, TypeScript, Preview + production READY |

**Important**: Production `READY` is a successful deployment, not proof that subsequent sports crons have succeeded. Do not claim these sports are 100% operational until the post-release job ledger supports it. None of these PRs changed model formulas, Official Picks, protected NBA/GOAT or NHL pipelines, MLB off-season pause or provider subscription plans.

## Outstanding release gates (read-only observations)

### Table Tennis — highest priority

- Last pre-fix run: 2026-11-18 16:40:43 UTC `FAILED`, `MULTISPORT_OPERATION_FAILED`, despite inserting 174 forecast rows and 3 outcome rows. Production has since been updated, but no normal due cycle after fix at audit.
- Outstanding: **116 distinct overdue games / 348 market rows** (>12h), across moneyline, sets odd/even, and total points. The original 969 archived Tipsport finals contained **zero** exact matching pairs with ±5min, so blindly inserting results would fabricate evidence.
- Usage snapshot `edge_lab_tt_request_budget_v1`: **125/240 monthly** and **9/9 daily** on Nov 18; do not request any additional paid source call to test.
- Next scheduled due in `edge_lab_multi_locks_v1`: **2026-11-19 00:40:43 UTC = 2026-11-18 20:40 Puerto Rico**.
- Post-release gate: newest `edge_lab_multi_runs_v1` row after due has `status IN ('SUCCESS','PARTIAL')` **and no** `MULTISPORT_OPERATION_FAILED`; for backlog >10, expect `operational_state='SETTLEMENT_BACKLOG'`, warning `TT_SETTLEMENT_BACKLOG`, collector version V5; recovery strategy `OLDEST_AND_RECENT_UNTRIED` only when >100 backlog. Compare unique overdue events; if counts increase, the source-retention/coverage question is still unresolved. `PARTIAL` is an honest status; it is not equivalent to fully fixed settlement.

### NCAAF

- Prior run: 2026-11-18 16:10:43 UTC `PARTIAL`, 137/138 verified FBS team schedules; ESPN team ID **68**, Boise State, failed `EVENT_IDENTITY_MISMATCH`. A Boise State **Nov 28 flex opponent was TBD** on the team's official 2026 schedule, an unverified hypothesis for the mismatch, not sufficient to bypass identity checks. Reference: https://broncosports.com/news/2026/2/11/football-boise-states-2026-schedule-officially-announced/
- Next scheduled due: **2026-11-19 04:10:43 UTC = 2026-11-19 00:10 Puerto Rico**. Expect the rejected source to contain `source_errors[].event_id` and `diagnostic`; determine whether this is an unassigned opponent, upstream inconsistency, or wrong source ID *before* changing parser behavior.
- Five previously settled `DISPUTE` cases have verified final data but kickoff shifts: two ≤120min and three >120min. The #354 change covers **future** reconciliation; it did not mutate existing outcomes. Do not invent retroactive W/L or relax team identity/venue/season/freeze cutoffs.

### NCAAB

- Last 61 runs all `PASS` at audit. The immutable NCAAB preseason model and outcomes remain separate. Five historical overdue fixtures are postponement or reschedule, not necessarily five missing finals. PR #355 records lifecycle states through **normal existing free captures**, and there is no immediate backfill or new provider call. New source labels are informational, not auto-graded.
- Accuracy research isolated in previous branch `research/multisport-operational-audit-20261117`: verified 611 games, 480 correct (78.56%); exploratory home-favorite-only Brier change from 0.19383 to 0.16525 in 538 games, directional hits unchanged 416/538. It is **retrospective/post-hoc**, not validated on untouched holdout, and not merged with official models.

### Soccer / NFL

- Soccer independent `edge_lab_runs_v1` succeeds frequently (666 SUCCESS / 4 PARTIAL at last audit); 40 forecast-market rows, 18 results across only **9 games**, none overdue. Not enough to declare accuracy or profitable edge. Retain free current shadow collection.
- NFL `free_sports_runs_v1` 48 `OK` with 32 forecasts and 14 results at audit; no past-due unmatched forecasts; separate NFL from NCAAF.

### UFC

- Latest runs `PARTIAL` due to **6 identities/historical outcomes without unambiguous winners**, and **13 `INSUFFICIENT_OR_UNCERTAIN_HISTORY` abstentions**. 47 forecasts, 10 results, 372 quotes; no overdue forecasts. These are appropriate fail-closed quality controls, not an outage. No winner inference from ambiguous finals.

### ATP

- Latest RapidAPI capture `OK`, e.g. 6 normalized ATP upcoming matches in Nov 18 snapshot, but **zero eligible forecast records**. The provider did not yield fully verified pregame quotes for every match; `price=null` or `executionVerified=false` occur. Do not turn calendar captures into price-backed bets or assume ATP is certified operational for picks. No extra paid calls.

### BSN

- API-Sports latest archive errors were decoded from the **saved compressed provider responses**, not guessed:
  - `games?league=76&season=2025` returned HTTP 200 with error: `Free plans do not have access to this season, try from 2022 to 2024.`
  - `games/statistics/teams?ids=...` returned HTTP 200 with error: `Free plans do not have access to the Ids parameter.`
- Historic BSN 2022, 2023, 2024 free games data were captured with partial archive coverage but do not supply 2025/26 official model-ready history. No new subscription is authorized.
- Official site offers free browsing at https://bsnpr.com/; terms at https://wp.bsnpr.com/terminos-y-condiciones/ explicitly prohibit mass scraping without BSN written authorization. Do not create an automated extractor from that site without permission; possible manual validation or licensed archive alternatives require rights review.

## Safe checkpoints and immediate next actions

1. Read TT/NCAAF scheduled post-deployment results; do not force an off-cadence paid cron. One-time user notification/check is scheduled Nov 19 at 00:45 Puerto Rico, read-only.
2. TT: verify V5 recovery ledger, compare backlog, and preserve immutable final matching (players ±5m, one unambiguous final). If backlog still rises despite improved targeting, research more comprehensive **authorized** free result sources; never relax the identity or add phantom W/L.
3. NCAAF: use exact ID from new diagnostic to solve one provider event without changing frozen model or invalidating safe gates.
4. NCAAB: validate lifecycle display after natural capture, report five legacy cases as postponement/review rather than false loss; keep calibration candidates SHADOW.
5. Retain UFC abstentions, ATP research-only without verified forecast quotes, BSN paused/restricted unless acceptable authorized recent data exists.

All provider budgets, Official Pick policies, and user instruction to avoid new paid subscriptions remain in force.
