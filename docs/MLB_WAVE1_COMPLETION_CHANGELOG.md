# MLB Wave 1 Completion Changelog

Last updated: 2026-07-20 20:39:39 -04:00

## Phase 6 - Player Props Data Foundation V1

Status: BLOCKED after foundation implementation.

Summary:
- Added `mlb_player_props_foundation_v1` as a read-only provider-independent foundation.
- Added `/api/mlb/player-props/foundation`.
- Added Operations Validation fixture coverage.
- Cataloged pitcher prop markets: strikeouts, outs recorded, earned runs, hits allowed, walks allowed and pitches thrown.
- Cataloged batter prop markets: hits, total bases, runs, RBI, home runs, walks and strikeouts.
- Defined storage and lineage contracts for canonical players, provider mappings, participation, player game logs, prop odds snapshots, results/settlement, features, data quality and historical import checkpoints.
- Added deterministic over/under prop fixture normalization with production use disabled.

Validation:
- Operations Validation includes `mlb_player_props_foundation_validation_v1`.
- Fixture checks: 11/11 PASS.
- Local `/api/mlb/player-props/foundation?includeValidation=true`: `status=BLOCKED`, `phase7CanBegin=false`, `phase7Certification=BLOCKED`.
- Stored data audit: `sportPlayers=7389`, `providerMappings=57839`, `playerStats=45873`, `storedPlayerPropOddsSnapshots=0`.
- Provider calls 0.
- Remote mutations 0.
- `npm.cmd run build`: PASS.

Blockers:
- MLB player prop odds endpoint is not confirmed for the current subscription.
- MLB player prop odds entitlement is not confirmed.
- No stored MLB player prop odds snapshots exist.
- Player prop settlement rules are not implemented.
- Phase 7 prediction engine cannot begin honestly.

Guardrails:
- No fake prop odds.
- No fake prop probabilities.
- No prop prediction output.
- No provider call.
- No migration applied.
- Prediction formulas unchanged.
- Recommendation policy unchanged.
- Category assignments unchanged.
- Candidate ranking unchanged.
- Official thresholds unchanged.
- Provider integrations unchanged.
- Settlement and learning unchanged.

Stop Gate:
- Wave 1 execution stops here per mission rules because Phase 6 certification is BLOCKED.

## Phase 5 - AI Picks Feed V1

Status: PASS locally.

Summary:
- Added `mlb_ai_picks_feed_v1` and `mlb_ai_picks_feed_item_v1` as additive read-only contracts.
- Derived feed items only from existing Current Board candidates, `official_pick_v1`, `market_alignment_v1`, `recommendation_explanation_v1` and selected odds lineage.
- Added `aiPicksFeed` to the Current Board response.
- Added `sections.aiPicksFeed` to the Today contract.
- Added a User Mode AI Picks Feed panel with grounded metrics, price, sportsbook, model probability, implied probability, edge, EV, confidence, risk, market age, blocker and promotion condition.
- Kept Official Pick and Best Bet Today labels restricted to candidates with an existing official contract.
- Kept informational rows separate as Most Likely, Best Value, Watch Closely, Hidden Value, Avoid, Data Risk and Market Update.

Validation:
- Operations Validation includes `mlb_ai_picks_feed_validation_v1`.
- Fixture checks: 13/13 PASS.
- Local `/api/current-board?includeValidation=true`: 12 Current Board candidates, feed `AVAILABLE`, 23 feed items, provider calls 0, remote mutations 0.
- Local `/api/dashboard/today?includeValidation=true`: feed section `AVAILABLE`, 23 feed items, provider calls 0, remote mutations 0.
- Current local sample: 0 Official Pick/Best Bet Today items, 0 Best Value items, 5 Most Likely, 5 Watch Closely, 5 Avoid, 5 Data Risk and 3 Market Update items, with stale items clearly marked stale.
- `npm.cmd run build`: PASS.

Guardrails:
- Prediction formulas unchanged.
- Recommendation policy unchanged.
- Category assignments unchanged.
- Candidate ranking unchanged.
- Official thresholds unchanged.
- Provider integrations unchanged.
- Settlement and learning unchanged.
- Unsupported markets unchanged.
- No fabricated market movement claims.

Production:
- Not pushed.
- Not deployed.
- Awaiting explicit approval before production activation.

## Phase 4 - Official Pick Experience V1

Status: PASS locally.

Summary:
- Added `official_pick_v1` and `official_pick_experience_v1` as additive read-only contracts.
- Derived Official Pick presentation only from existing Current Board candidates, selected odds lineage, `market_alignment_v1`, `recommendation_explanation_v1` and the existing recommendation eligibility policy.
- Added `sections.officialPicks` to the Today contract.
- Added a premium User Mode Official Pick card and a truthful empty state when zero Official Picks exist.
- Preserved Top AI Opportunity as informational when no Official Pick exists.

Validation:
- Operations Validation includes `official_pick_experience_validation_v1`.
- Fixture checks: 14/14 PASS.
- Local `/api/current-board?includeValidation=true`: official experience `EMPTY_VALID`, provider calls 0, remote mutations 0.
- Local `/api/dashboard/today?includeValidation=true`: official section `EMPTY`, Top AI Opportunity retained, provider calls 0, remote mutations 0.
- `npm.cmd run build`: PASS.

Guardrails:
- Official thresholds unchanged.
- Category assignments unchanged.
- Candidate ranking unchanged.
- Prediction formulas unchanged.
- Recommendation policy unchanged.
- Provider integrations unchanged.
- Settlement and learning unchanged.

Production:
- Not pushed.
- Not deployed.
- Awaiting explicit approval before production activation.
