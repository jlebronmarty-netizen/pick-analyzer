# MLB BALLDONTLIE Pregame Lineup Freeze V1

Status: **RESEARCH-ONLY / PROSPECTIVE INFORMATION CAPTURE**

BALLDONTLIE documents MLB lineups as a pre-game endpoint that typically becomes available 1–2 hours before first pitch.

This capture reuses the existing hourly MLB settlement cron. It does not create a new scheduler.

## Freeze rule

A game is persisted only when:

- it is still pregame;
- first pitch is within 180 minutes;
- BALLDONTLIE returns exactly two batting-order teams;
- each team has exactly orders 1 through 9;
- every batter maps by exact normalized full name to exactly one MLBAM row in `pick2_mlb_players`;
- no fuzzy matching is used.

Partial or ambiguous lineups write zero rows.

The first complete observed lineup is immutable. Later hourly calls reuse/no-op for that event.

## Timestamp semantics

BALLDONTLIE's lineup response does not expose a provider publication timestamp.

Therefore `source_timestamp` is explicitly the time Pick Analyzer first observed a complete lineup. It is valid only prospectively and must be strictly before `targetStart`.

It must never be represented as the provider's original publication time.

## Storage

Existing table: `sport_lineups`.

Each stored batter row includes:
- MLBAM player ID;
- BDL game/player/lineup IDs;
- batting order;
- canonical gamePk;
- target start;
- first-observed timestamp;
- exact identity method;
- `fuzzyMatchingUsed=false`.

## Safety

The capture runs independently before settlement. A provider/capture failure is non-blocking and cannot prevent the existing settlement path.

- research/shadow only;
- no model or threshold changes;
- Official Picks eligibility false;
- APOSTAR disabled;
- no historical Odds API calls;
- no new cron schedule.
