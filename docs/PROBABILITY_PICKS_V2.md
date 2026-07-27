# Probability Picks V2

Status: local implementation and certification pending.

## Scope

Probability Picks V2 is the detailed exploration companion to AI Briefing V2. It remains projection-only and uses existing stored model outputs, sport certification metadata, existing score values and existing correlation-aware parlay contracts.

## Current-State Audit

- Source rows: future pregame `prediction_history` rows for moneyline, run line and totals, plus existing MLB pitcher projection previews for pitcher outs.
- Lifecycle filtering: completed, final, settled, closed, ignored, historical, replay, preview-shadow, live, started, cancelled, void, post-start, post-final and invalid-cutoff rows are excluded before ranking.
- Sport eligibility filtering: `baseball_mlb` remains `CERTIFIED_LIMITED` and ranking eligible. Soccer EPL, NCAA Football and other stored sports remain `ENGINE_NOT_CERTIFIED` unless a separate certification phase proves otherwise.
- Probability filtering: request filters may set minimum probability, but no service threshold or probability formula is changed.
- Confidence filtering: request filters may set minimum confidence, but confidence values are not recalculated.
- Quality filtering: request filters may set minimum quality, but quality values are not recalculated.
- Sorting: default display order remains existing score order. V2 adds transparent presentation-only sort options for probability, confidence, quality, stability, freshness and event start.
- Section assignment: existing sections remain available, with top probability, confidence, quality, stable, pitcher projection, team projection and projection-only groups.
- Parlay eligibility: existing parlay thresholds, leg eligibility, combined probability logic, correlation penalties, confidence logic and quality logic remain unchanged.

## V2 Additions

- Additive API metadata: `version`, V2 sport eligibility details, ranking/parlay eligible sports, excluded rows by reason, qualified rows by sport, freshness summary, top signals, filter metadata, sort metadata and AI briefing context.
- Page structure: Today Overview, Top Probability Signals, By Sport, AI Parlays, Sports Not Ready Today and Methodology and Definitions.
- Pick Explanation V2: each pick now carries `whyQualified`, `mainRisks` and safe supporting links derived from existing drivers, risks, sport certification, starter status, freshness and source.
- Metric clarity: Probability, Confidence, Quality, Risk, Stability and Certification definitions are visible without changing calculations.
- AI Briefing integration: `/ai-operations` now links into Probability Picks anchors for all qualified picks, top signals, MLB opportunities and warnings.
- Empty states: no qualified picks, no certified sports, restrictive filters, no parlays, sport not certified, out-of-season and stale data states are represented by precise copy or response metadata.

## Safety Boundaries

- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- SQL migrations: none
- Epoch seed: not applied
- Historical imports: not executed
- Feature rebuilds: not executed
- Scheduler behavior: unchanged
- Learning Brain weights: unchanged
- Probability, confidence, quality and thresholds: unchanged
- Parlay and correlation math: unchanged

## Remaining Blockers

- Multi-sport ranking remains blocked until another sport has certified current stored data, settled validation, readiness evidence and product approval.
- Multi-sport parlays remain unavailable while MLB is the only eligible Probability Picks sport.
- Pitcher outs remain projection-only unless same-event market identity and line overlap are certified elsewhere.

## Certification Markers

PROBABILITY_PICKS_V2_PASS
PROBABILITY_PICKS_MULTI_SPORT_ELIGIBILITY_PASS
PROBABILITY_PICKS_GLOBAL_RANKING_PASS
PROBABILITY_PICKS_BY_SPORT_PASS
PROBABILITY_PICKS_EXPLANATION_PASS
PROBABILITY_PICKS_FILTERING_PASS
PROBABILITY_PICKS_SORTING_PASS
PROBABILITY_PICKS_FRESHNESS_PASS
PROBABILITY_PICKS_EMPTY_STATE_PASS
PROBABILITY_PICKS_AI_BRIEFING_INTEGRATION_PASS
PROBABILITY_PICKS_PARLAY_PRESENTATION_PASS
PROBABILITY_PICKS_API_COMPATIBILITY_PASS
PROBABILITY_CONFIDENCE_QUALITY_CLARITY_PASS
NO_UNCERTIFIED_SPORT_RANKING_PASS
NO_SPORTSBOOK_DEPENDENCY_PASS
NO_RECOMMENDATION_PASS
NO_PROBABILITY_CHANGE_PASS
NO_CONFIDENCE_CHANGE_PASS
NO_QUALITY_CHANGE_PASS
NO_THRESHOLD_CHANGE_PASS
NO_CORRELATION_MATH_CHANGE_PASS
NO_MODEL_CHANGE_PASS
NO_LEARNING_CHANGE_PASS
NO_DATABASE_MUTATION_PASS
NO_EPOCH_ACTIVATION_PASS
NO_CERTIFIED_PLATFORM_REGRESSION_PASS
