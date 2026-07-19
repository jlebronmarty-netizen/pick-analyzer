# Universal AI Performance & Evolution Center V1

Status: read-only central AI performance evaluation system.

AIPEC evaluates Pick Analyzer prediction engines across every registered sport without creating betting recommendations or changing model behavior. It is driven by the existing sport registry, so future enabled sports automatically appear in the center once they have prediction history or shadow replay data.

## Sources Reused

- Prediction SDK.
- Feature Store.
- Historical Builder handoffs.
- Settlement outputs in `prediction_history`.
- Replay outputs, including BSN shadow replay.
- Calibration service.
- Learning progress metrics.
- Current Board read-only status.
- Existing prediction history.
- Basketball and BSN maturity layers.
- MLB platform through prediction history and Current Board.
- Multi-sport registry.

## Capabilities

- All-sports and per-sport performance dashboards.
- Universal prediction history view.
- Accuracy, rolling accuracy, ROI when available, yield when available, Brier score, log loss, calibration error, confidence, feature quality, data sufficiency and coverage.
- Shadow, Official, AI Lean, Watchlist and Avoid accuracy buckets when data exists.
- Model drift, confidence drift, feature drift, learning progress and prediction stability.
- Daily, weekly, monthly, season and lifetime trends.
- Champion, challenger, shadow, rollback and promotion-readiness evolution views.
- Performance timeline summaries.
- Confidence and reliability curves.
- Per-sport readiness indicators.
- AI report cards.
- Computed daily update surface after settlement.

## Routes

- `/api/ai-performance-center`
- `/api/ai-performance-center?sportKey=baseball_mlb`
- `/api/ai-performance-center?sportKey=basketball_bsn`
- `/api/ai-performance-center/daily-update`

## Guardrails

- No prediction model changes.
- No threshold changes.
- No betting activation.
- No Official Pick mutation.
- No Current Board mutation.
- No Bet Slip changes.
- No provider logic changes.
- No settlement or learning logic changes.
- No champion or V7 mutation.
- Provider calls and remote mutations remain zero.
