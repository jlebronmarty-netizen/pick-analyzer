# Event Identity Evidence Contract

Last updated: 2026-07-21

Universal Event Identity V1 treats identity evidence as deterministic facts, not probabilities.

## Accepted Evidence Codes

- `PROVIDER_ID_EQUAL`
- `SOURCE_ID_EQUAL`
- `SPORT_EQUAL`
- `LEAGUE_EQUAL`
- `SEASON_EQUAL`
- `HOME_TEAM_EQUAL`
- `AWAY_TEAM_EQUAL`
- `START_TIME_EQUAL`
- `START_TIME_WITHIN_RESCHEDULE_TOLERANCE`
- `DOUBLEHEADER_NUMBER_EQUAL`
- `ODDS_EVENT_ID_EQUAL`
- `RESULT_EVENT_ID_EQUAL`
- `STAT_EVENT_ID_EQUAL`
- `HISTORICAL_MAPPING_EQUAL`
- `CANONICAL_EVENT_ID_EQUAL`

## Blocking Evidence Codes

- `TEAM_NAME_DATE_ONLY`
- `CANONICAL_EVENT_MISSING`
- `HOME_AWAY_REVERSED`
- `PROVIDER_MAPPING_COLLISION`
- `MULTIPLE_EVENT_CANDIDATES`
- `TEST_FIXTURE_EXCLUDED`
- `POST_START_EXCLUDED`

## Trust Rules

An automatic repair may use exact provider, source or legacy mappings only when sport, league and season scope are compatible and there is exactly one canonical candidate.

A multi-field match is trusted only when stable identifiers agree. Required stable fields are sport, league, season, home team ID, away team ID and scheduled start. Team names and date alone are insufficient.

Doubleheaders require provider event ID, source mapping, doubleheader number, exact result mapping or unique exact scheduled start proof.

Rescheduled games require provider continuity or source lineage. A date-boundary shift alone is not enough to merge events.
