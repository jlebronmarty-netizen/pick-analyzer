# MLB Main Markets BALLDONTLIE 2025 Opening-Odds Coverage Probe V1

Status: **RESEARCH-ONLY / READ-ONLY PROVIDER PROBE**

Purpose: determine whether the existing BALLDONTLIE GOAT subscription can supply enough 2025 opening Moneyline, standard Run Line and Full Game Total evidence to justify a full historical research backfill without spending The Odds API historical credits.

The probe is deliberately bounded to six representative regular-season dates:

- 2025-04-15
- 2025-05-15
- 2025-06-15
- 2025-07-15
- 2025-08-15
- 2025-09-15

For each date it reads:
1. BALLDONTLIE MLB games;
2. BALLDONTLIE opening odds.

Historical game identity is reconciled against `historical_baseball_games` using exact date + canonical home team + canonical away team. Team aliases are deterministic, not fuzzy. If more than one historical game matches the same date/team pair, the game is marked ambiguous and excluded.

The output reports:
- historical games;
- BDL games;
- matched / ambiguous / unmatched identities;
- opening rows and vendors;
- exact canonical games with usable Moneyline pairs;
- exact canonical games with standard spread pairs;
- exact canonical games with total over/under pairs;
- market-specific coverage percentages.

No database writes occur.

Provider-call bound: at most 24 calls. No The Odds API historical calls are made.

A full 2025 backfill is **not** authorized by this PR. The next gate is the coverage probe result.
