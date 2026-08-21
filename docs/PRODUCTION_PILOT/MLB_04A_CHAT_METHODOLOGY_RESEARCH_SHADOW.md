# MLB-04A Chat Methodology Research Shadow Foundation

Classification: `MLB_04A_CHAT_METHODOLOGY_RESEARCH_FOUNDATION_CERTIFIED_DESIGN_ONLY`

MLB-04A is a bounded research-only phase. It does not continue MLB-03 accumulation, does not create a fourth clean canary, does not execute settlement, does not promote Official Picks, and does not activate learning, calibration, bankroll, notifications, product visibility or scheduler automation.

## Purpose

The manual ChatGPT-style MLB workflow is treated as an observable methodology to reconstruct, not as ground truth. Its reported probabilities are not copied into Pick Analyzer.

The research contract compares:

- `RAW_BASELINE`
- `CALIBRATED_SHADOW`
- `MLB_CHAT_METHOD_RESEARCH_SHADOW_V1`

The third layer starts as a transparent scorecard and frozen prediction ledger, not a probability engine.

## Current Model Inventory

The active MLB model path is:

- raw baseline: `baseball_mlb_prospective_preview_v1`
- calibrated shadow: `MLB_CALIBRATED_SHADOW_V1`
- selected MLB-03 contract: `CALIBRATED_BASELINE_ONLY`
- supported core markets: Moneyline, Run Line, Total

The current registered MLB feature set requires `event_context`, `team_form` and `market_odds`. Starter, pitcher, weather, park, injury and lineup context are optional or forward-only. Bullpen, injury diagnosis, confirmed lineup, player detail and player stat caches remain partial or blocked.

## Feature Gap Summary

Available and used:

- market price for exact core markets
- event, market, selection and line identity
- raw and calibrated probability comparison for Moneyline, Run Line and Total

Available but not selected in MLB-03 calibrated shadow:

- opponent offense strength
- recent team form
- home/away context
- alternate run-line and total evidence as exact-line research material

Partial:

- probable or confirmed starters
- starter ERA/recent performance
- starter handedness
- pitcher matchup quality
- bullpen quality and recent workload
- offensive and handedness splits
- weather and park context
- pitcher prop outcome foundation

Forward-only or missing:

- confirmed batting order
- lineup availability
- injuries
- NRFI/YRFI market and settlement foundation
- best-market selection across unsupported markets

## Research Scorecard

`MLB_CHAT_METHOD_RESEARCH_SHADOW_V1` may record component scores:

- `STARTER_EDGE`
- `OFFENSE_EDGE`
- `BULLPEN_EDGE`
- `SPLIT_EDGE`
- `LINEUP_EDGE`
- `CONTEXT_EDGE`
- `MARKET_VALUE`

Only components with timestamp-safe evidence may be populated. Missing components remain null with blockers. The scorecard may rank candidates and assign confidence tiers, but it must not emit calibrated probability until enough frozen historical or forward evidence exists.

## Snapshot Contract

`MORNING` and `FINAL_PREGAME` are immutable separate snapshots.

`MORNING` may include probable starters, projected lineup context, stored market odds and context blockers known at that time.

`FINAL_PREGAME` may include confirmed starters, confirmed lineups and latest exact-line market price only when all source timestamps are pre-start and cutoff-safe.

Neither snapshot may be overwritten with later information, post-start odds, final results, settlement, same-game stats or retrospective starter substitutions.

## Comparison Contract

Raw, calibrated and chat-method research evidence can be compared only for the same event, market, selection and exact line. Book identity remains explicit. Moved-line or cross-book comparisons require an explicit policy and may not reuse probabilities across lines.

## Accuracy Contract

No accuracy claim, including any "80 percent" claim, is valid without a frozen pregame ledger containing date, event, market, selection, line, sportsbook, odds, methodology version, prediction timestamp, snapshot type and final result.

Future evaluation must report sample size, accuracy, Brier score, log loss, calibration error, flat-unit ROI, market breakdowns, favorite/underdog splits and morning versus final-pregame performance.

## Props And NRFI/YRFI

Pitcher props remain partial and not prediction-ready. Historical outcome evidence exists for some pitcher stat families, but current sportsbook prop odds, opening/closing prop lines, settlement activation and complete feature contracts remain blocked.

NRFI/YRFI is not ready. It lacks verified market normalization, first-inning feature models, top-order lineup certainty and settlement evidence.

## Recommended Order

1. `MLB-04B_MORNING_FINAL_PREGAME_SNAPSHOT_AUTOMATION`
2. `MLB-04C_CHAT_METHOD_RESEARCH_SHADOW_SCORECARD_LEDGER`
3. `MLB-04D_CONTEXT_SOURCE_COMPLETION`
4. `MLB-05_PITCHER_PROP_FOUNDATION`
5. `MLB-06_NRFI_YRFI_FOUNDATION`

Provider calls: 0

Production database mutations: 0

Runtime prediction writes: 0
