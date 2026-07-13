# Soccer Prediction Engine V1

## Status

Completed as a provider-independent prediction architecture module.

Completion labels:

- `ARCHITECTURE_COMPLETE`
- `DETERMINISTIC_VALIDATION_COMPLETE`
- `REAL_DATA_VALIDATION_PENDING`
- `HISTORICAL_CALIBRATION_PENDING`

## Objective

Create the first soccer prediction engine architecture using Shared Sport Prediction Engine SDK utilities, Feature Store Core and Soccer Feature Store Integration V1.

This module does not train a model, call providers, persist picks, settle picks or claim production betting accuracy.

## Implementation

- Service: `src/services/soccer-prediction-engine.service.ts`
- Dashboard panel: `src/components/dashboard/SoccerPredictionEnginePanel.tsx`
- Dashboard mount: `src/app/dashboard/page.tsx`
- APIs:
  - `GET /api/soccer/predictions`
  - `GET /api/soccer/predictions/health`
  - `GET /api/soccer/predictions/validation`

## Markets

V1 produces deterministic previews and contracts for:

- 1X2
- moneyline alias compatibility
- double chance
- draw no bet
- totals
- both teams to score
- first-half 1X2
- first-half totals
- qualification
- Asian handicap contract only

## Soccer-Specific Rules

- Home, draw and away probabilities are normalized together and must sum to 100.
- Three-way no-vig probabilities remove overround across home, draw and away together.
- Double chance derives from normalized 1X2 probabilities.
- Draw no bet conditions on non-draw outcomes.
- Both teams to score is separate from total goals probability.
- Qualification is separate from match winner.
- First-half markets use first-half projections, not full-match results.
- Confidence is capped while draw-aware, league-strength, lineup, injury and expected-goals domains are missing.

## Missing Inputs

The engine does not fabricate:

- draw-aware context
- league strength
- confirmed lineups
- injuries
- expected goals
- head-to-head
- market movement

Those unavailable domains remain warnings and keep the engine in partial status.

## Validation

`GET /api/soccer/predictions/validation` checks:

- home/draw/away probabilities sum to 100
- no negative probabilities
- fair odds calculation
- double chance derivation
- draw no bet derivation
- totals over/under complementarity
- BTTS yes/no complementarity
- first-half calculations
- stale-data warning
- missing lineup/injury warning
- insufficient-data behavior
- no leakage
- no persistence
- zero provider calls

## Persistence

No migration is required. V1 returns deterministic previews only and does not write to `prediction_history`.

## Future Work

- Real stored-data candidate generation after normalized soccer event and odds coverage is verified.
- Draw-aware and league-specific feature definitions after approved sources exist.
- Historical calibration with settled soccer predictions.
- Production persistence only after validation and duplicate-prevention rules are implemented for soccer.
