# PA-13 — Current Pitcher Earned Runs Pricing Probe

Date: 2026-09-17

Status:

`CURRENT_PITCHER_ER_PRICING_AVAILABLE_HISTORICAL_CERTIFICATION_STILL_OPEN`

## Scope

Perform one bounded pregame provider probe for MLB market key:

`pitcher_earned_runs`

The probe was executed only in an isolated Vercel preview build. It did not write to Supabase, did not touch Official Picks, and did not activate APOSTAR.

## Target event

- provider event id: `b9c3b50472005c67c30de323cd8a5396`
- Kansas City Royals @ Houston Astros
- provider commence time: `2026-09-17T23:17:00Z`
- probe observed in Vercel build logs at approximately `2026-09-17T23:05:43Z`
- strictly pregame at execution

## Provider result

Provider: The Odds API

HTTP: `200`

Market:

`pitcher_earned_runs`

Result:

`AVAILABLE`

Returned:

- books: **4**
- player/market quotes: **12 outcomes**
- players: **2**
- lines observed: **0.5, 2.5**
- provider request cost: **1**
- requests remaining after probe: **5,591**

Books returned:

- BetMGM
- Bovada
- DraftKings
- Fanatics

FanDuel and Caesars were **not returned for this event/market snapshot**. This is not evidence that those books never offer the market; it is only the exact result of this pregame provider observation.

## Exact observed pairs

### Seth Lugo — 2.5 earned runs

- Fanatics: Over -140 / Under +100
- Bovada: Over -150 / Under +110
- BetMGM: Over -140 / Under +100
- DraftKings: Over -131 / Under -101

### Miguel Ullola — 0.5 earned runs

- Bovada: Over +160 / Under -230
- BetMGM: Over +160 / Under -225

Provider market update timestamps were between `23:04:55Z` and `23:05:37Z`.

## Disposition

The previous stored-project audit remains true:

`HISTORICAL_PITCHER_ER_PRICING=ABSENT`

However, current provider availability is now independently demonstrated:

`PA13_CURRENT_PITCHER_ER_PRICING_AVAILABLE = YES`

Therefore the valid forward path is to add versioned, research-only pregame capture for exact:

- event identity;
- pitcher identity;
- selection;
- line;
- sportsbook;
- American price;
- provider timestamp;
- acquisition timestamp;
- provider lineage.

Do not infer historical ROI, CLV or EV from this one current snapshot.

The Odds API documentation lists `pitcher_earned_runs` as a supported MLB player-prop key and documents historical additional-market support after May 2023. Historical availability for the exact 2025 research population still requires a separate bounded historical certification before any backtest economics may be claimed.

## Safety

- research-only;
- provider requests used by this probe: 1;
- Supabase writes: 0;
- Official Picks modified: false;
- APOSTAR activated: false;
- historical pricing certified: false;
- ROI certified: false;
- CLV certified: false;
- EV certified: false;
- API key exposed: false.
