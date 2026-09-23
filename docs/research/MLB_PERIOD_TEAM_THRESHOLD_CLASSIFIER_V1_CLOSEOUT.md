# Period/team threshold classifier V1 closeout

State: `NO_DEVELOPMENT_GATE_PASS_NO_PROMOTION`.

Existing run https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/35674048891 completed successfully on SHA `1607c943091916027ae7782c378f6d11ebbfc349`. Artifact `10672821300` was downloaded and retained unchanged in `artifacts/research/mlb_period_team_threshold_classifier_v1.json`; ZIP SHA256 `70b5d714899414bc2a9f0638479aa5842a8d18a3a0a858e46e4dd7fd539ef4a1`.

## Evidence preserved

The existing experiment trained binary CatBoost distribution targets with rolling 2025 folds. Architecture/gate selection preceded its 2026 historical diagnostic; 2026 was already seen in earlier research and is not pristine external evidence. No new training or threshold search was performed during this closeout.

| Target | Preserved spec / probability gate | 2025 selected accuracy (n) | 2026 diagnostic accuracy (n) | 2026 coverage |
| --- | --- | ---: | ---: | ---: |
| F5 home margin >= -1 | ensemble / 0.90 | 80.72% (83) | 80.00% (10) | 0.44% |
| F5 home margin >= 0 | depth6 / 0.80 | 68.23% (192) | 71.93% (57) | 2.53% |
| F5 home margin >= 1 | depth6 / 0.75 | 60.95% (169) | 53.85% (65) | 2.88% |
| F5 home margin >= 2 | depth6 / 0.80 | 73.89% (203) | 73.44% (192) | 8.51% |
| Team runs >= 3 | ensemble / 0.85 | 75.85% (323) | 71.19% (59) | 1.28% |
| Team runs >= 4 | depth4 / 0.75 | 60.98% (164) | 59.09% (44) | 0.95% |
| Team runs >= 5 | depth6 / 0.80 | 64.00% (150) | 50.00% (52) | 1.13% |
| Team runs >= 6 | ensemble / 0.80 | 73.33% (480) | 67.49% (406) | 8.79% |

All eight `development_target_met` values are false. The 80.72% F5 margin target and 75.85% team-runs target have zero lift over their selected-sample majority baseline. The 80% 2026 figure is only 8/10 and also has zero selected-sample lift. These do not certify an advantage. Team observations include both sides of games and are not independent games.

These are scoring-distribution targets, not actual historical sportsbook lines. No ATS, ROI, EV or CLV certification follows. Existing results and formulas are preserved without changing thresholds or using the 2026 diagnostic to rescue them. The original four-qualified-month gate also differs from the stricter five-month revisit protocol; no candidate qualifies under either interpretation because the existing target gate already failed.

## Cleanup and continuation

The temporary `mlb-period-team-threshold-github-export-temp` exporter is closed as version 2, verified by actual HTTP POST returning 410 GONE. The archived workflow has no automatic trigger and its job is disabled. Vercel showed READY for the executed SHA.

Provider calls and Odds API credits during closeout: 0. No database data or grant changes, tracker changes, Official Picks writes, APOSTAR activation, recommendation backfill or production promotion.

F5 Spread transfer is separately preserved in PR #186 as 2/2 on 22 scored games, insufficient evidence. A separate F1 NRFI research version may test a new half-inning factorization with strictly prior pitcher/offense histories, fixed shrinkage and a single predeclared 0.75 confidence gate. This does not modify any frozen candidate above.
