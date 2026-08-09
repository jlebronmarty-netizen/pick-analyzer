# ODDS-02A Event Mapping And Multi-Market Shadow Certification

Status: `ODDS_02A_FINAL_REQUEST_CONSUMED_CERTIFICATION_INCOMPLETE`

Observation time: `2026-08-09T15:08:15Z` UTC.

Starting commit: `6e8e31c6b949cc698674ba4a915c55455a3c5b85`.

Production commit observed: `6e8e31c6b949cc698674ba4a915c55455a3c5b85`.

## Verdict

ODDS-02A cannot be certified as PASS.

The final useful-slate gate passed. Production exposed 14 Current Board MLB events, 42 current candidates, and 15 lifecycle events on operating date `2026-08-09`. The final authorized The Odds API shadow request was then executed through the protected production route.

The protected route returned HTTP 200, but the local certification client parsed the response as a nested `data` payload even though the repository `apiOk` contract returns the service payload at the top level. Because the final request budget is now consumed, the live shadow payload cannot be safely reacquired without exceeding the approved ODDS-02/02A provider limit.

This is not evidence of a provider, mapping, model, or production isolation defect. It is a certification evidence-capture failure.

## Current Slate Gate

| Item | Result |
| --- | ---: |
| Operating date | `2026-08-09` |
| Current Board events | 14 |
| Current Board candidates | 42 |
| Current expected-mappable events | 14 |
| Lifecycle events | 15 |
| Active-refresh lifecycle events | 14 |
| Minimum useful final acquisition | 3 |
| Preferred useful final acquisition | 5+ |
| Gate decision | `CONSUME_FINAL_REQUEST` |
| Final request consumed | Yes |

The useful-window requirement was satisfied before the protected request was made.

## Protected Request Evidence

| Item | Result |
| --- | --- |
| Endpoint | `/api/operations/odds-shadow-comparison` |
| Method | `POST` |
| Confirmation | `ODDS_02_SHADOW` |
| Max calls | 1 |
| HTTP status | 200 |
| Secret values exposed | No |
| Client parser result | `PAYLOAD_NOT_CAPTURED_FLAT_ENVELOPE_MISMATCH` |

The failed local extraction expected `$response.data`, but `src/lib/api-contract.ts` flattens successful payloads through `apiOk(payload, requestId)`. The parser therefore produced null certification fields even though the protected route returned HTTP 200.

## Request Accounting

| Item | Result |
| --- | ---: |
| Authorized ODDS-02/02A requests | 3 |
| Requests used before final ODDS-02A attempt | 2 |
| Final ODDS-02A request consumed | 1 |
| Cumulative requests used | 3 |
| Remaining authorized requests | 0 |
| Prior observed credits/request | 3 |
| Cumulative expected credits | 9 |

No fourth request is authorized.

## Certification Coverage

The following ODDS-02A final proof items remain uncertified because the live response payload was not captured: events returned, expected events mapped, unmapped expected events, ambiguous events, moneyline coverage, run line coverage, total coverage, core-book coverage, freshness comparison, price comparison, shadow edge / EV impact and Official Pick shadow comparison.

## Prior ODDS-02 Evidence

| Metric | Result |
| --- | ---: |
| The Odds API events returned | 24 |
| Final production expected mappable | 1 |
| Final production actually mapped | 1 |
| Raw returned coverage | 1 / 24 = 4.17% |
| Expected-mappable coverage | 1 / 1 = 100% |
| Ambiguous events | 0 |
| Shadow snapshots | 1168 |
| SportsDataIO fresh / aging / stale | 0 / 0 / 3 |
| The Odds API fresh / aging / stale | 21 / 3 / 0 |

The raw 1-of-24 number must not be used as the mapping reliability rate because The Odds API can return a broader league-wide upcoming-event window than Pick Analyzer's active Current Board slate.

## Preserved Exact Market Evidence

The latest certified production shadow case study remains:

| Field | Value |
| --- | --- |
| Event | `TB @ SEA` |
| Canonical event | `baseball_mlb:mlb:sportsdataio:event:79051` |
| Market | `spread` |
| Selection / line | `SEA -1.5` |
| SportsDataIO price | `+178` |
| SportsDataIO source age | approximately 243 minutes |
| The Odds API best fresh price | `+175` |
| The Odds API best fresh book | BetRivers |
| The Odds API source age | approximately 1 minute |
| Binding | exact event, exact market, exact selection, exact line |

Book-level prices observed for the exact market included FanDuel `+164`, MyBookie `+166`, Bovada `+170`, DraftKings `+169`, Caesars `+170`, Fanatics `+165` and BetRivers `+175`.

Core sportsbook identity remains preserved from ODDS-02 evidence: FanDuel, DraftKings, BetMGM and Caesars were all observed in the shadow acquisition.

## Mapping Contract

The current ODDS-02 service maps provider events by normalized home/away teams and a bounded 15-minute start-time tolerance. It returns `AMBIGUOUS` when more than one candidate matches and does not automatically map same-team games across different start times.

Preferred identity hierarchy for ODDS-03 remains:

1. Existing provider entity mapping or crosswalk when available.
2. Exact canonical provider crosswalk.
3. Normalized home/away teams plus bounded start-time tolerance.
4. No automatic mapping if ambiguous.

Audited alias coverage in the current service includes the known MLB abbreviations used by SportsDataIO and The Odds API, including `ATH/OAK`, `CHW`, `KC`, `SD`, `SF`, `TB` and `WSH`.

Timezone and date behavior was audited at the gate by comparing production `/api/system/version`, `/api/current-board?mode=current&limit=200`, `/api/operations/event-lifecycle?sportKey=baseball_mlb&limit=200` and `/api/performance` at `2026-08-09T00:35:51Z`. The current operating date and Current Board scope exposed one current canonical event while lifecycle exposed 15 MLB events, mostly already started. ODDS-02A therefore treats the mappable denominator as the current canonical board/event operating scope, not the raw league-wide provider event count or a shifted calendar-date guess.

## Root Cause Classification

Current classification:

- `OPERATING_WINDOW_SCOPE_DIFFERENCE`: likely and supported by the one-event Current Board window at final certification time.
- `PRIOR_RAW_EVENT_PAYLOAD_NOT_PERSISTED`: proven evidence-retention limitation for row-level reconstruction.
- `NO_MAPPING_DEFECT`: not fully certifiable until a useful multi-event shadow window is observed.

No runtime mapping repair is approved or required from the current evidence.

## Multi-Market Coverage

The current slate gate confirms the one expected-mappable event has three production candidates:

| Market | Expected current candidates | Final request measurement |
| --- | ---: | --- |
| Moneyline | 14 | Final response payload not captured |
| Run line | 14 | Final response payload not captured |
| Total | 14 | Final response payload not captured |

The final multi-event, multi-market coverage certification remains incomplete because the final response payload was not captured. A new acquisition is not authorized under ODDS-02A because the request budget is exhausted.

## Price Policy Recommendation

Recommended future policy for ODDS-03 evaluation: `BEST_FRESH_WITH_USER_BOOK_PREFERENCE`.

Rationale: it supports real bet availability and user reproducibility while avoiding false edge inflation from stale or unavailable prices. The production system should retain consensus context, certified book prices, source timestamps and capture timestamps, but no cutover is implemented in ODDS-02A.

## Credit Economics

Observed ODDS-02 request cost remains 3 credits per league-wide MLB request for `h2h,spreads,totals`.

| Slate | Practical cadence | Estimated requests/day | Estimated credits/day |
| --- | --- | ---: | ---: |
| 10 games | 30-60m early, 15m mid-window, 10m near starts, 5m final 30m | 30-37 | 90-111 |
| 15 games | same cadence, event-level suppression required | 37-43 | 111-129 |
| 30-day month | practical range | 900-1290 | 2700-3870 |

## Props Preparation

The same event-mapping contract can support future player props only after additional identity work:

- player ID
- player-name normalization
- player team
- event crosswalk
- prop market key
- exact line

No player props request was made and no player props implementation was started.

## Production Isolation

- SportsDataIO remains production odds authority.
- The Odds API remains shadow-only.
- Current Board production pricing was not changed.
- Official Pick, Rent Play, Moneyline, Smart Parlay and Watchlist policies were not changed.
- Prediction probabilities, confidence, edge, EV, settlement, learning, Performance, scheduler cadence and provider budgets were not changed.
- Certification reads made zero provider calls.
- Certification reads made zero database mutations.
- ODDS-03, Historical Replay, Player Props and MC-03 were not started.

## Next Step

Do not perform ODDS-03 from this evidence. Any future The Odds API cutover work needs a new explicit provider-call authorization and a capture-safe certification command that preserves sanitized aggregate response evidence before consuming the final request in that budget.
