# ODDS-02A Event Mapping And Multi-Market Shadow Certification

Status: `ODDS_02A_WAIT_FOR_USEFUL_SHADOW_WINDOW`

Observation time: `2026-08-09T00:35:51Z` UTC.

Starting commit: `aaa1c45c7de027ae5a5ce6e6248712f371f70145`.

Production commit observed: `aaa1c45c7de027ae5a5ce6e6248712f371f70145`.

## Verdict

ODDS-02A did not consume the final authorized The Odds API request. Production read-only evidence showed only one unique Current Board event with three current candidates at the certification moment, below the required minimum of three expected-mappable current events.

The prior raw 24-event ODDS-02 provider response was not persisted in committed certification artifacts. The committed and production evidence preserves aggregate event counts, mapped-event counts, exact matched case studies, sportsbook coverage and freshness results, but not a row-level inventory of all 24 provider events. This is an evidence-retention gap for ODDS-02A, not proof of an event-mapping defect.

## Current Slate Gate

| Item | Result |
| --- | ---: |
| Current Board candidates | 3 |
| Unique Current Board events | 1 |
| Current expected-mappable events | 1 |
| Minimum useful final acquisition | 3 |
| Preferred useful final acquisition | 5+ |
| Final request consumed | No |

The only current Current Board event was `baseball_mlb:mlb:sportsdataio:event:79051` (`TB @ SEA`) with moneyline, spread and total candidates.

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
| Moneyline | 1 | Not run; useful-window gate failed |
| Run line | 1 | Not run; useful-window gate failed |
| Total | 1 | Not run; useful-window gate failed |

The final multi-event, multi-market coverage certification remains pending a useful window with at least three expected-mappable current events.

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

## Next Useful Window

Use the remaining final authorized request only when production Current Board exposes at least three expected-mappable MLB events, preferably five or more, before or near the actionable market window. The request should be one league-wide MLB shadow request for `h2h,spreads,totals`.
