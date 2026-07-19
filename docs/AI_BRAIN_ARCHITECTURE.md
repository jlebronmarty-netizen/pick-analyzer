# AI Brain Architecture

AI Brain & Trust System V1 extends the existing Universal AI Performance & Evolution Center. It does not create a second performance engine.

## Source Of Truth

- Sport discovery: `src/config/sports.config.ts`
- Prediction history: stored `prediction_history`
- Shadow evidence: existing BSN model maturity replay
- Calibration/readiness: existing calibration, Feature Store, Prediction SDK, Current Board and sport readiness contracts
- Daily memory: `ai_performance_snapshots` after migration `202607190001_ai_performance_snapshots_v1.sql`

## Scopes

Supported scopes are `ALL_SPORTS`, `SPORT`, `LEAGUE`, `MODEL_VERSION`, `CATEGORY` and `TIME_PERIOD`.

Future sports participate automatically when they are enabled in the Multi-Sport Registry and produce Prediction SDK/history-compatible rows.

## Guardrails

Provider calls added: 0.

External acquisition added: 0.

The AI Brain is read-only for predictions and never changes formulas, weights, thresholds, Current Board policy, official picks, champion/challenger/shadow state, V7 state, settlement, learning or historical rows.
