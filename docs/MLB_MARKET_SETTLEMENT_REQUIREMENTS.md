# MLB Market Settlement Requirements V1

No market may activate without deterministic settlement.

Existing settlement-compatible markets:
- Moneyline: final winner
- Run Line: final margin plus spread
- Game Total: final combined runs

Team Totals:
- Required fields: final team runs
- Push: team score equals line
- Void: postponed/suspended rules must be explicit
- New settlement logic required

First Five:
- Required fields: inning-by-inning score through five innings
- Starter-change rules must be defined
- Push behavior depends on line and market
- New settlement logic required

NRFI/YRFI:
- Required fields: first-inning score
- Push usually not applicable, but book rules must be captured
- New settlement logic required

Pitcher Props:
- Required fields: official pitcher game stat, starter identity and game status
- Push: stat equals line where allowed
- Void: listed-starter and sportsbook-specific rules required
- Stat corrections must preserve audit trail
- New settlement logic required

Batter Props:
- Required fields: official batter game stat, lineup participation and game status
- Void: sportsbook-specific plate appearance/start rules required
- Stat corrections must preserve audit trail
- New settlement logic required

Combined/Alternate:
- Requires leg-level deterministic settlement.
- Same Game combinations need correlation-safe settlement and void behavior.
