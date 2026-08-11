# MLB Current Era Final V1

Status: READY_FOR_FINAL_REPLAY_AFTER_DEPLOYMENT

Date: 2026-08-11

Starting commit: `d264d7883834fadf255c2549aed233c0a04c18bf`

## Scope

MLB-FINAL-00 audits the Current Era MLB evidence chain before historical replay. It does not change prediction formulas, model weights, EV math, Official Pick policy, calibration status, scheduler cadence, settlement, learning, provider authority, database schema or SportsDataIO rollback posture.

## Provider Architecture

| Domain | Certified Source | Status |
| --- | --- | --- |
| MLB odds | The Odds API | Product primary |
| MLB schedule/status/starters/results | MLB Official / MLB Stats API | Primary |
| SportsDataIO MLB | Rollback only | Routine calls remain 0 |
| HR-03 calibration | Shadow only | Not promoted |

## Current Era Evidence Chain

Current Era MLB evidence flows through:

1. MLB Official schedule/status/starter data.
2. Stored feature context and prediction history.
3. The Odds API exact event/market/selection/line price evidence.
4. Current Board exact-line binding and fail-closed freshness.
5. Homepage decision surfaces as recommendation or review-only evidence.
6. MLB Official results into settlement, learning and Performance.

Current Board remains strict: started, historical, stale, unsupported, superseded or invalid rows are excluded from current actionability. Dashboard grounded evidence remains available for audit/review when stored pregame prediction evidence exists but current actionability is locked or price identity is unavailable.

## Live-Lock Semantics

Actionability and evidence visibility are separate:

- Started or closed games cannot create new recommendations.
- Stored pregame evidence can remain visible as review-only evidence.
- Missing current price/probability/edge/EV must remain unavailable when exact evidence does not exist.
- Live lock must not be presented as a cascade of fabricated missing-data failures.

## Best Available Review Option

MLB-FINAL-00 adds `best_available_review_option_v1` to homepage presentation. It reuses existing candidates and existing ranking signals; it does not introduce a betting model.

The review option:

- is labeled `BEST AVAILABLE REVIEW OPTION`;
- is explicitly `NOT A RECOMMENDATION`;
- prefers sufficiently evidenced candidates over N/A-heavy candidates;
- exposes probability, odds, implied probability, edge, EV and evidence time only when stored evidence exists;
- remains blocked by Official Pick/Rent Play/Moneyline/Smart Parlay policy gates.

## Gate Matrix

| Gate | Surface | Hard/Soft | Source | Lock Behavior | User Meaning |
| --- | --- | --- | --- | --- | --- |
| Pregame/cutoff | all recommendation surfaces | HARD | event lifecycle and cutoff | fail after start/cutoff | no new bet recommendation |
| Model probability | Rent Play, Moneyline, Parlay legs, Watchlist | HARD for recommendation, review context otherwise | prediction history/current board | visible if stored, blocks if missing | model view of the exact market |
| Exact-line price | Current Board, Rent Play, Moneyline, Parlay legs | HARD for recommendation | The Odds API selected price | unavailable when line moved or missing | no cross-line price binding |
| Freshness | recommendation surfaces | HARD | product freshness SLA | stale waits/fails closed | current evidence must be actionable |
| Edge/EV | Rent Play, Moneyline, Best Value | HARD for recommendation | existing EV functions | unavailable if probability or price missing | value is distinct from probability |
| Confidence | recommendation surfaces | HARD | prediction history/current board | blocks if unavailable/low | signal strength |
| Calibration | Official/recommendation gates | HARD where policy requires | HR-03 shadow status | blocks promotion | final replay required before promotion |
| Quarantine | Official/recommendation gates | HARD | production eligibility metadata | blocks promotion | current row is review-only |
| Operations readiness | recommendation gates | HARD where policy requires | operations health | fail closed on critical safety | product safety context |
| Starter/weather/park/bullpen | analysis context | SOFT/INFORMATIONAL unless policy requires | feature snapshot and MLB context | visible when linked | explanation context |

## Certification Target

`MLB_CURRENT_ERA_READY_FOR_FINAL_REPLAY` means:

- provider architecture is stable;
- Current Era predictions and current exact-line board evidence are coherent;
- recommendation surfaces distinguish no-qualified, review-only and actionable states;
- best available review-only evidence is visible when useful;
- post-start safety remains intact;
- settlement, learning and Performance remain stable;
- SportsDataIO routine MLB dependency remains removed.

