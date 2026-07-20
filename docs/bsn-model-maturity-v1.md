# BSN Model Maturity Mission V1

Status: Shadow-only model maturity layer.

This mission adds read-only BSN model maturity gates without activating betting. The layer reuses the Basketball Platform, Historical Builder, BSN Intelligence Engine, BSN Shadow Prediction Engine, Feature Store, Prediction SDK and existing dashboard architecture.

## Phases

1. Backtesting Engine: replays completed BSN games through the shadow model and compares predicted winner to actual winner.
2. Calibration Engine: builds reliability buckets, expected-vs-actual win rates and confidence correction guidance without changing model weights.
3. Performance Center: exposes accuracy, Brier score, prediction history, rolling accuracy, daily performance and timeline views.
4. Explanation Engine: reports strengths, weaknesses, missing data, confidence, feature quality and data sufficiency per replayed prediction.
5. Readiness Engine: computes prediction, calibration, recommendation and official-pick readiness as engineering indicators only.
6. Shadow Market Intelligence: previews probability, confidence, reason, feature quality and prediction quality with all betting surfaces disabled.
7. Activation Audit: decides whether BSN is eligible for future activation.

## Guardrails

- No Official Picks.
- No Current Board activation.
- No AI Leans, Watchlist, Bet Slip, EV, Kelly or value.
- No model weight changes.
- No prediction logic changes.
- No champion row mutation.
- No official threshold changes.
- No provider calls.
- No remote mutations.

## Current Audit Result

Recommendation: Continue Shadow.

Primary blockers:

- Historical sample is below official activation scale.
- Calibration is directional until the replay sample grows.
- Verified BSN odds are unavailable.
- Immutable pregame BSN feature snapshots are not persisted for replay certification.
- Player availability and boxscore depth remain unavailable.

## Routes

- `/api/bsn/model-maturity`
- `/api/bsn/model-maturity/backtesting`
- `/api/bsn/model-maturity/calibration`
- `/api/bsn/model-maturity/performance`
- `/api/bsn/model-maturity/explanations`
- `/api/bsn/model-maturity/readiness`
- `/api/bsn/model-maturity/shadow-market`
- `/api/bsn/model-maturity/activation-audit`
