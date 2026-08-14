# NBA-02B1-R5 Replay Canary Persistence Certification

Status: `NBA_02B1_R5_REPLAY_CANARY_PERSISTENCE_PASS_READY_FOR_BULK`

NBA-02B1-R5 persisted the exact certified 24-game / 96-prediction NBA replay canary after the R4 odds-nullability migration was applied. No provider calls were made, NBA Current Era remained inactive and replay settlement stayed preview-only.

## Persistence

- Prediction history rows before: 3573
- Prediction history rows after: 3669
- First run inserted: 96
- First run reused: 0
- First run failed: 0
- Write chunks: 4
- Second run new logical predictions: 0
- Second run reused: 96
- Duplicate logical predictions: 0

## Readback

- Replay rows expected: 96
- Replay rows found: 96
- Missing rows: 0
- Wrong origin rows: 0
- Wrong sport rows: 0
- Wrong model version rows: 0
- Wrong feature version rows: 0
- Current Era identity collisions: 0

## Odds Nullability

- Model-only rows: 72
- Model-only null-odds rows: 72
- Price-aware rows: 24
- Price-aware null-odds rows: 0
- Non-replay null-odds rows: 0
- Current Era null-odds rows: 0
- Official Pick null-odds rows: 0
- Fake zero odds rows: 0
- Fake model-only `-110` rows: 0

## Settlement Preview

- Checked: 96
- Wins: 52
- Losses: 44
- Pushes: 0
- Blocked: 0
- Moneyline: 14-10-0
- Spread: 13-11-0
- Total: 13-11-0
- First Half: 12-12-0

## Isolation

- Replay settlement writes: 0
- NBA Current Era delta: 0
- Official Pick delta: 0
- Production learning delta: 0
- Production calibration delta: 0
- Current Era Performance delta: 0
- Settlement debt delta: 0
- Product surface replay visibility: 0
- NBA Current Era status: INACTIVE
- NBA scheduler status: INACTIVE

## Providers

- BallDontLie calls: 0
- The Odds API historical calls: 0
- SportsDataIO calls: 0

## Next

NBA-02B2 bulk model replay is ready for explicit authorization. It was not started in this phase.
