# Pick Analyzer MLB Roadmap Realignment V1

Certification: `PICK_ANALYZER_MLB_ROADMAP_REALIGNMENT_FROM_PARLAY_AUTOMATION_TO_PICK_ANALYSIS_CERTIFIED`

Date: 2026-09-04

## Decision

Pick Analyzer MLB is an individual-pick/value-analysis system. 100-daily-parlay generation is not a core product requirement.

The current MLB product direction is a sports-betting pick analysis and value-scoring platform focused on individual pick analysis, calibrated probability estimation, market-implied and no-vig price comparison, edge/value scoring, matchup intelligence, selective Official Picks, and a sortable Value Board. Parlays remain optional, user-selected, bounded downstream analysis only.

## Retired Current Objective

The following goals are retired as active MLB core objectives:

- Mandatory 100 MLB parlays per day.
- Portfolio 101 as a required daily product layer.
- Full-slate combinatorial parlay generation.
- Parlay count as a model training or product success target.
- Automatic parlay production as a substitute for individual edge certification.

Historical references to these goals remain valid as legacy or experimental context, but they are not current roadmap authority.

## Active Core Product Contract

The active MLB product contract is individual-pick-first:

- Evaluate each supported market selection independently.
- Estimate model probability for the exact selection.
- Compare against market price, implied probability, and no-vig fair probability.
- Score edge, expected value, confidence, risk, sample sufficiency, and explanation evidence.
- Promote Official Picks only when selective recommendation gates pass.
- Allow zero Official Picks on a slate.
- Keep high probability, positive expected value, and official recommendation status distinct.

## Supported Market Scope

The current planning scope is:

- Full-game moneyline.
- Full-game run line.
- Full-game total.
- Team total.
- NRFI/YRFI.
- Pitcher strikeouts, outs, earned runs, and hits allowed.
- Batter hits, total bases, and home runs.
- Additional markets only after data, identity mapping, price evidence, labels, replay, validation, and UI contracts are certified.

## Value Contract

Each eligible pick-analysis row should preserve this sequence:

`odds -> implied probability -> no-vig fair probability -> model probability -> edge -> expected value -> value score -> confidence -> recommendation gate`

Probability, price, value, and recommendation are separate fields. A likely outcome can still be poor value; a positive edge can still be below Official Pick policy; and a recommendation can be absent even when a row is useful analysis.

## Value Board Contract

The Value Board should be sortable and filterable by sport, slate, event, market, selection, odds, implied probability, no-vig probability, model probability, edge, expected value, value score, confidence, risk flags, data freshness, recommendation status, and explanation factors.

## Explanation Contract

Every user-facing pick analysis should expose concise factor evidence:

- Matchup context.
- Team form and starter context where supported.
- Bullpen context where supported.
- Batter or pitcher prop context where supported.
- Price and no-vig context.
- Data sufficiency and freshness.
- Recommendation blockers when present.

## Factor Edge Table

Future MLB UI and API work should support a Factor Edge table that separates model inputs, market-price evidence, confidence/risk flags, and recommendation policy. The table must never imply that an informational edge is an Official Pick.

## Optional Parlay Layer

Parlay analysis is optional and downstream. It may combine user-selected or tightly bounded candidate legs after individual-leg analysis exists. It must include correlation warnings, dependency/correlation treatment, combined price evidence, stake/risk context, and explicit uncertainty about joint probability unless a certified joint-probability method exists.

No automatic 100-parlay generation is authorized by this realignment.

## Provider Responsibility Matrix

| Provider | Current MLB Responsibility |
| --- | --- |
| MLB Official / MLB Stats API | MLB identity, schedule, status, metadata, and official game/player evidence where required. |
| Statcast / Baseball Savant | Pitch-level performance history and certified raw/statistical feature foundation. |
| The Odds API | Market price evidence for supported betting markets. |
| BALLDONTLIE | Supplemental sports data only where a certified contract supports the sport/domain. |
| SportsDataIO | Not required by Pick 2 MLB. Do not restart MLB credential repair for the current MLB roadmap. |

`SPORTSDATAIO_MLB_REQUIRED_BY_PICK2 = NO`

## Existing Foundation

The certified MLB data foundation is preserved and remains useful:

- Raw 2025 Statcast rows: 712,528.
- Native MLB games: 2,430.
- Native MLBAM players: 1,469.
- Feature snapshots: 67,433.
- Team daily feature rows: 4,498.
- Starter daily feature rows: 4,498.
- Bullpen, batter, matchup, and first-inning daily feature rows: 0.
- Models: 0.
- Champion: `NONE`.
- Predictions: 0.
- 2026 raw rows: 0.

No data rollback is required. The partial 01D feature work remains useful for pick analysis and model dataset preparation, not parlay-only automation.

## Model Objective

Future model work is realigned to calibrated individual selection probability and market-relative value:

- Log loss.
- Brier score.
- AUC where suitable.
- Calibration and reliability.
- Market-relative edge.
- Closing-line value.
- Downstream ROI tracking after production-safe prediction and settlement evidence exists.

The model objective is not daily parlay volume.

## New Phase Sequence

1. Complete R1H manual schema readback and R1I partial daily-feature DML resume if separately authorized.
2. Certify 01D feature persistence completion for individual pick modeling.
3. Prepare market-specific model datasets.
4. Train and validate market-specific individual-pick probability models.
5. Add price/no-vig/value scoring.
6. Build Value Board and pick-detail explanations.
7. Certify selective Official Picks.
8. Add optional user-selected parlay analysis only after individual-leg value and correlation contracts are certified.

## Safety

This realignment is repository-only. It makes no production DML mutations, no production DDL mutations, no provider calls, no feature DML, no model changes, no prediction writes, no 2026 import, no automation activation, and no cron changes.
