# F5 Spread frozen-candidate transfer diagnostic V1

State: `INSUFFICIENT_SAMPLE_NO_PROMOTION`. Research/shadow only.

## Verified execution

- Verified main before changes: `c8aac46648b38935a6dd00f17e0987b90b042033`.
- PR: https://github.com/jlebronmarty-netizen/pick-analyzer/pull/186
- Run: https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/35675057422/attempts/2
- Attempt 2 completed successfully at 2026-09-22T01:26:54Z.
- Executed SHA: `49ee1f60601d4ba51a127e6f3d13b262aa521a2f`.
- Artifact ID: `10673275715`; ZIP SHA256: `350afdecc252ce5b80ecedfc56b6ef4bdae24a3bd74cb525f8789e247cd0fd42`.
- Exact artifact retained at `artifacts/research/mlb_f5_spread_transfer_diagnostic_v1.json`.
- Canonical Supabase `ynuocvexviorgdjrfthw` was `ACTIVE_HEALTHY`.
- Vercel main deployment and the executed PR SHA were both `READY`.

## Result

| Metric | Observed |
| --- | ---: |
| Games scored | 22 / 22 |
| Selected | 2 |
| Wins | 2 |
| Losses | 0 |
| Pushes | 0 |
| ATS accuracy, wins / (wins + losses) | 100% |
| Coverage, selected / scored | 9.0909% |

Both selections occurred on 2025-05-15: ATL -0.5 (gamePk 777909, F5 4-0) and LAD -1.5 (777946, F5 15-2). These are historical diagnostic selections, not recommendations or retrospective pick records.

The source remains `catboost_win_pct_sign_agreement`, probability threshold 0.75, source result 43/64 = 67.1875%, state `REVISIT_SECOND_PASS_BELOW_75`. No model, side rule or threshold was retuned for spread outcomes. Monthly training uses strictly earlier games; the 22 purchased FanDuel T-60 lines are used only for settlement.

Two wins on one date do not certify a 75% model. This is historical seen-development evidence, not pristine external or prospective evidence. The source feature selector uses the historical corpus for feature availability, another reason not to interpret this transfer as clean external validation. No rescue, wider threshold search, promotion or additional Odds API acquisition follows from this result.

## Cleanup and boundaries

The temporary `mlb-f5-ml-revisit-github-export-temp` exporter was deployed as version 5 with an unconditional 410 GONE response. An actual POST returned HTTP 410. Its closed implementation contains no database client, credential lookup, provider call or write. Automatic diagnostic execution is removed and the archived workflow job is disabled.

Odds API calls and credits: 0. No new provider calls. No Official Picks writes, APOSTAR activation, recommendation backfill, production-model promotion or tracker modifications. The previously confirmed Odds API balance of about 2,032 is not a fresh balance measurement.

## Next research evidence

The live audit found a completed period/team threshold-classifier run, `35674048891`, on branch `research/period-team-threshold-classifier-v1-20260921`. Review and preserve it before duplicating that experiment. Its 2026 output is already-seen historical diagnostic evidence. Exact historical lines remain necessary for real-line certification of other period and team markets.

Validation: independent 22-row frozen-rule and exact-line settlement replay PASS; npm.cmd run build PASS (400 static pages, CI placeholder configuration; no live data used by build).
