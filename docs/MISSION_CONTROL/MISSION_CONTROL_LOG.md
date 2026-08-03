# Mission Control Log

This log is append-only. Add entries at mission boundaries only.

## 2026-08-02 - MC-00 Mission Control Foundation

Baseline: `ddc79d7b4a5efa5068ff1e63bb68d95d84100e67`.

Created Mission Control V1:

- persistent mission-control documentation;
- canonical mission taxonomy;
- deterministic mission queue;
- project-health and sport-readiness matrices;
- read-only `/api/mission-control`;
- read-only `/mission-control`;
- stop conditions;
- resume guide;
- validator and certification artifacts.

No provider calls, production data mutations, prediction changes, settlement changes, learning changes, scheduler changes, Official Pick policy changes or manual deployment actions are part of MC-00.

## 2026-08-02 - MC-01 Operational Readiness Closure

Starting commit: `ed7a9d932ee3257fa7a20c84770c89edd4712d06`.

Production evidence confirmed MC-01 was the first eligible mission, but operational readiness remained conditional:

- scheduler execution was `LATE` by one interval;
- market freshness was `CRITICAL`;
- provider budget was `HEALTHY`;
- settlement closure had ready rows 0 and silent pending rows 0;
- protected scheduler dry-run without `CRON_SECRET` returned HTTP 401 as expected.

Repairs completed:

- Mission Control runtime state now reflects MC-00 production certification and MC-01 conditional status.
- Settlement Guarantee separates scheduler lateness into operational warnings instead of settlement failure when ready rows and silent pending rows are zero.

MC-01 remains `CONDITIONAL_PASS` with MC-STOP-005 active until the protected external scheduler and market-freshness evidence recover.

## 2026-08-02 - MC-01 External Scheduler And Freshness Observation

Read-only production observation did not clear MC-STOP-005.

Production served commit `0f02b355f19ccaf3c08682d304ac27a0a8f06027`, while the runtime-certified MC-01 repair commit remains `c337a850919e932e8b13a9024a88d52b3d1dc09b`.

Evidence:

- scheduler execution `CRITICAL`;
- scheduler running false;
- missed intervals 2;
- last successful protected invocation `2026-08-02T21:29:54.03+00:00`;
- market freshness `CRITICAL`;
- latest odds timestamp `2026-08-02T21:28:50.269Z`;
- market age about 40 minutes;
- product readiness `CRITICAL`;
- Settlement Guarantee PASS with ready rows 0, blocked rows 0 and silent pending rows 0.

GitHub Actions CLI was not available locally, so canonical production scheduler evidence was used. No code changes, provider calls, provider credits or data mutations were performed.

## 2026-08-02 - MC-01 Manual Protected Scheduler Diagnostic

MC-STOP-005 cleared.

GitHub Actions evidence:

- workflow run `30770704363`;
- trigger `workflow_dispatch`;
- commit `02e9d97169d8292a10126b4a8370cec227496ca1`;
- conclusion `success`;
- run start `2026-08-02T22:42:46Z`;
- run update/end `2026-08-02T22:43:01Z`;
- job `refresh` completed successfully from `2026-08-02T22:42:50Z` to `2026-08-02T22:43:01Z`;
- logs were unavailable through unauthenticated GitHub API, so production scheduler evidence was used for protected invocation effect;
- scheduled run `30770207492` also completed successfully on the same commit.

Production evidence:

- Operations Health `HEALTHY`;
- scheduler execution `HEALTHY`;
- scheduler running true;
- missed intervals 0;
- market freshness `HEALTHY`;
- adaptive odds status `FRESH`;
- latest odds timestamp `2026-08-02T22:42:59.132Z`;
- product readiness `HEALTHY`;
- Settlement Guarantee PASS with ready rows 0, blocked rows 0 and silent pending rows 0.

MC-01 is `PRODUCTION_CERTIFIED`. MC-02 is READY but was not started.

## 2026-08-02 - MC-02 Multi-Sport Data Readiness

MC-02 certified the data-readiness foundation for every configured target sport without starting MC-03.

Runtime and repository updates:

- added read-only `/api/mission-control/data-readiness`;
- added canonical sport-level readiness contract;
- mapped provider coverage across SportsDataIO, The Odds API, BSN sources and official/manual sources;
- updated Mission Control status, queue, checklist and certification artifacts.

Sport classifications:

- MLB: `DATA_READY`;
- NBA: `DATA_PARTIAL`;
- NFL: `DATA_PARTIAL`;
- NHL: `DATA_PARTIAL`;
- Soccer: `DATA_PARTIAL`;
- Tennis: `DATA_FOUNDATION`;
- UFC: `DATA_FOUNDATION`;
- BSN: `PROVIDER_BLOCKED`.

Safety evidence:

- normal readiness reads make provider calls 0;
- normal readiness reads make remote mutations 0;
- provider calls used during MC-02: 0;
- provider credits used during MC-02: 0;
- database mutations made during MC-02: 0;
- prediction, Official Pick, Kelly, settlement, learning, scheduler cadence and provider contracts unchanged.

MC-03 remains `PLANNED` and manual-only. The next READY queue item is MC-08.

## 2026-08-02 - MC-08A Homepage Experience

MC-08A implements the first bounded MC-08 product-experience sub-mission without starting MC-08B.

Homepage order is now:

- Decision Core Morning Brief;
- Rent Play;
- Moneyline Bet;
- Smart Parlay;
- Today's Watchlist;
- Decision Summary;
- collapsed Technical Evidence.

Planner, health, lifecycle, provider, budget, operations, model and diagnostics evidence remains available, but is secondary. No prediction formula, Official Pick policy, ranking, probability, confidence, edge, EV, Kelly, model, settlement, learning, scheduler, provider contract or budget behavior changed.

Local validation passed: MC-08A validator 37/37, Mission Control validator 57/57, C1 product validator 31/31, changed-file ESLint and `npm.cmd run build` with 396 generated static pages.

Production certification passed on commit `7af572ca66206780ed0c0da354d0309c72e73ef4`: `/api/system/version` returned HTTP 200 with provider calls 0, `/` returned HTTP 200, rendered desktop and mobile homepage markers were present, no horizontal overflow was observed, `/api/dashboard/today` returned HTTP 200 with provider calls 0 and remote mutations 0, and `/api/current-board?mode=current&limit=100` returned HTTP 200. MC-08B was not started.

## 2026-08-02 - MC-08B Rent Play Experience

MC-08B implements the Rent Play Experience V1 contract without starting MC-08C.

Rent Play now uses a typed `rent_play_v1` presentation contract over existing stored Today evidence. The card exposes actionability, model probability, current odds, implied probability, freshness, Official Pick distinction, Most Likely distinction, readiness gates, supporting reasons, risks and what would change the decision. Missing probability, EV, edge, odds and timestamps remain unavailable instead of being coerced to zero.

No prediction formula, probability, confidence, edge, EV, Kelly, model weight, champion/challenger state, Official Pick policy, settlement, result import, learning, scheduler cadence, refresh cadence, provider budget, provider mapping, sport certification or market certification changed.

Local validation passed: MC-08B validator 34/34, MC-08A validator 37/37, Mission Control validator 57/57, MC-02 validator 24/24, OE-003F validator 28/28, OE-003E validator 32/32, C1 product validator 31/31, changed-file ESLint and `npm.cmd run build` with 396 generated static pages.

Production certification passed on commit `310b72ab0b304a1901ce598527043043087c9c83`. `/api/system/version`, `/`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=100`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`, `/api/operations/health` and `/mlb-operations` returned HTTP 200. Desktop and mobile production renders showed the Rent Play card with unavailable odds, probability, edge and EV rendered as unavailable instead of zero. Provider calls and remote mutations remained 0. MC-08C is READY but was not started.

## 2026-08-02 - MC-08C Moneyline Bet Experience

MC-08C implements the Moneyline Bet Experience V1 contract without starting MC-08D.

Moneyline Bet now uses a typed `moneyline_bet_v1` presentation contract over existing stored Today evidence. The card exposes the supported Moneyline universe, selected team or participant, current moneyline, implied probability, model probability, probability advantage, freshness, actionability, Official Pick status, Rent Play relationship, Most Likely relationship, readiness gates, candidate rank, selection reasons, comparison reasons, risks and what would change the decision.

No prediction formula, probability, confidence, edge, EV, Kelly, model weight, champion/challenger state, Official Pick policy, Rent Play policy, Most Likely ranking, Best Value ranking, settlement, result import, learning, scheduler cadence, refresh cadence, provider budget, provider mapping, sport certification or market certification changed.

Local validation passed: MC-08C validator 43/43, MC-08B validator 34/34, MC-08A validator 37/37, Mission Control validator 57/57, MC-02 validator 24/24, OE-003F validator 28/28, OE-003E validator 32/32, C1 product validator 31/31, B2 through B6.1 product validators, route/artifact consistency 14/14, unsupported-market policy lock 19/19, scheduler health alignment 6/6, changed-file ESLint, JSON validation, Markdown validation, targeted secret scan, `git diff --check` and `npm.cmd run build` with 396 generated static pages.

Production certification passed on commit `b748b9f812afeaf7d8c96f561a480a49303a8cd4`. `/api/system/version`, `/`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=100`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`, `/api/operations/health` and `/mlb-operations` returned HTTP 200. Desktop and mobile production renders showed the Moneyline Bet card after Rent Play and before Smart Parlay, with unavailable odds, implied probability, edge and EV rendered as unavailable instead of zero. Desktop evidence showed status `POLICY_BLOCKED`, selection `ARI`, event `ARI @ CLE`, rank 1 of 3, 0 eligible Moneyline candidates. Provider calls and remote mutations remained 0. MC-08D is READY but was not started.

## 2026-08-02 - MC-08D Smart Parlay Experience

MC-08D implements the Smart Parlay Experience V1 contract without starting MC-08E.

Smart Parlay now uses a typed `smart_parlay_v1` presentation contract over existing stored Today evidence. The card exposes bounded available legs, local user-selected legs, rejected legs, per-leg probability, odds, freshness, actionability, Rent Play and Moneyline relationships, mechanical combined odds, explicit correlation status and unavailable joint probability when no certified method exists.

The old homepage probability multiplication was removed. MC-08D does not fabricate joint probability, silently assume independence, invent correlation coefficients, force default parlay legs, auto-save wagers or change Official Pick, Rent Play, Moneyline Bet, Most Likely or Best Value policy.

Local validation passed: MC-08D validator 47/47, MC-08C validator 43/43, MC-08B validator 34/34, MC-08A validator 37/37, Mission Control validator 57/57, MC-02 validator 24/24, OE-003F validator 28/28, OE-003E validator 32/32, C1 product validator 31/31, B2 through B6.1 product validators, route/artifact consistency 14/14, unsupported-market policy lock 19/19, scheduler health alignment 6/6, changed-file ESLint, JSON validation, Markdown validation, targeted secret scan, `git diff --check` and `npm.cmd run build` with 396 generated static pages.

Production certification passed on commit `f9faf649d89cd343034e935225d7215dafcc754b`. `/api/system/version`, `/`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=100`, `/api/market-opportunities/most-likely`, `/api/market-opportunities/best-value`, `/api/operations/event-refresh-plan?sportKey=baseball_mlb&limit=200`, `/api/operations/health`, `/betting-workbench` and `/mlb-operations` returned HTTP 200. Desktop and mobile production renders showed Smart Parlay after Moneyline Bet and before Watchlist. Desktop state was `NO_SAFE_COMBINATION` with 8 available legs and 0 default selected legs; mobile state was `NO_GAMES`. Selection/deselection passed on desktop. Provider calls, remote mutations and wager writes remained 0. MC-08E is READY but was not started.

## 2026-08-03 - P1.3 Production Evaluation Policy Separation

P1.3 locally implements the approved policy decision that valid pregame model predictions can be production-evaluable independently from recommendation, actionability and Official Pick gates.

The implementation adds `production_evaluation_policy_v1_3` and persists the normalized policy contract inside future MLB prospective prediction snapshots. Low confidence, low edge, low EV, probationary calibration and stale price evidence remain recommendation/actionability blockers only. Data-integrity and excluded-scope blockers still prevent production evaluation.

The 45 rows from 2026-08-02 remain unchanged as non-production historical evidence.

Production certification passed on commit `a64c876b803c93f259424389d765282a9a0a3d1a`. `/api/system/version`, `/`, `/api/dashboard/today`, `/api/current-board?mode=current&limit=200`, `/api/operations/health` and `/api/performance` returned HTTP 200. Provider calls and remote mutations from certification reads remained 0. P2.0 is READY; MC-03 remains planned/manual-only.

## 2026-08-03 - P1.4 End-To-End Production Pipeline Certification

P1.4 was attempted after P1.3 production certification.

Read-only production evidence found 20 future MLB events with open cutoffs, including 8 current operating-day games needing refresh, but found 0 prediction rows generated after the P1.3 deployment observation time and 0 rows containing `feature_snapshot.productionEvaluationPolicy`.

Operations Health was `CRITICAL`: last protected scheduler invocation `2026-08-03T15:09:40Z`, scheduler evidence age 136 minutes, missed scheduler intervals 12 and market freshness `CRITICAL`.

P1.4 is `EXTERNAL_WAIT`. Required evidence is a successful post-P1.3 protected operating-day or automatic scheduler execution that persists cutoff-safe predictions with the P1.3 production-evaluation contract. P2.0 was not started.
## 2026-08-03 - P2.1 Supported-Market Prediction Coverage

P2.1 was started from commit `d909ac9e48c3bed2c2a00c1989d57dad0d48edb5` in the isolated autonomous worktree while paused MC-08E work remained preserved in the main checkout.

The implementation changes the MLB prospective generator from one selected odds row per event and normalized market to canonical event, market, outcome and line identity. Prediction reuse and stale-preview checks now include line identity. A protected read-only `/api/operations/prediction-coverage` endpoint reports every expected active-epoch current-day selection as created, missed, cutoff-missed or duplicate-collapsed.

No prediction formula, probability, confidence, edge, EV, Kelly, recommendation gate, Official Pick policy, settlement, learning, scheduler cadence or provider contract changed. P2.2 was not started.

Production certification completed on commit `a0e6329293686fe2557949f3f30e445c7e6880b8`. The repaired coverage endpoint reported 8 current MLB events, 48 expected selections, 48 predictions created, 48 production-evaluable rows, 0 missed opportunities, 0 cutoff misses, 0 duplicates and 100% coverage. The successful protected writer used 1 SportsDataIO provider call, made 145 remote mutations and rebuilt 48 downstream prediction rows with no persistence error. P2.2 is READY. MC-03 was not started and MC-08E remains paused.

P2.2 was then observed read-only. It is `WAITING_FOR_EXTERNAL_EVIDENCE`: the 48 Current V2 predictions exist, but current MLB events remain `HIGH_PRIORITY`/`ACTIVE_REFRESH` and are not yet final, so authoritative result import, settlement, learning evidence and Performance Current Era closure cannot be certified. P2.3 was not started.
# 2026-08-03 P2.1A Canonical Market-Prediction Granularity

- Status: PRODUCTION_CERTIFIED.
- Corrected the Current V2 supported-market contract from provider-side selection-level production evaluation to canonical event-market production evaluation.
- Expected 8-game MLB slate output is 24 canonical model predictions: 8 moneyline, 8 spread/run line and 8 total.
- Provider-side evidence can remain 48 contextual selections and must not be counted as 48 independent Performance or settlement-learning samples.
- P2.2 remains paused during certification and returns to `WAITING_FOR_EXTERNAL_EVIDENCE` only after production certification completes.
- Production commit `8821aa7830874653cc05744ff8eaad03cf42b6b3` certified 48 provider selections, 24 canonical markets, 24 canonical predictions, 0 missed canonical opportunities, 24 production-evaluable rows and 27 non-canonical Current Era rows excluded from Performance. P2.2 returned to `WAITING_FOR_EXTERNAL_EVIDENCE`.
