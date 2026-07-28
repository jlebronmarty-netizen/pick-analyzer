# The Odds API Maximum Utilization V1 - Checkpoint 1

Generated: 2026-07-28T02:47:53.484Z

Commit: `19650ee34f680558e9edab4109c88b556828e0d5`

Status: LIVE_AUDIT_COMPLETE

## Credit Safety

- Provider calls made: 12
- Requests remaining before: 19970
- Requests remaining after: 19953
- Requests used observed: 17
- Required reserve: 2000
- Remote mutations: 0
- Production mutations: 0
- Rows persisted as odds/predictions: 0

## Catalog

- Provider sports found: 173
- Active provider sports found: 71
- Mapped sports: 8

## Capability Matrix

| Sport | Season state | Current events | Current odds | Event markets | Player props | Scores | Historical odds | Bookmakers | Regions |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| MLB Baseball | ACTIVE_OR_LISTED | AVAILABLE_WITH_ROWS | AVAILABLE_WITH_ROWS | AVAILABLE | AVAILABLE_NO_CURRENT_ROWS | AVAILABLE_WITH_ROWS | NOT_TESTED_RANGE_DISCOVERY_PENDING | 11 | us |
| NBA Basketball | INACTIVE_OR_NOT_LISTED | AVAILABLE_NO_CURRENT_ROWS | AVAILABLE_NO_CURRENT_ROWS | UNKNOWN | NOT_TESTED_CREDIT_PROTECTION | AVAILABLE_NO_CURRENT_ROWS | NOT_TESTED_RANGE_DISCOVERY_PENDING | 0 | us |
| NFL Football | ACTIVE_OR_LISTED | AVAILABLE_WITH_ROWS | AVAILABLE_WITH_ROWS | AVAILABLE | NOT_TESTED_CREDIT_PROTECTION | BLOCKED | NOT_TESTED_RANGE_DISCOVERY_PENDING | 11 | us |
| NHL Hockey | ACTIVE_OR_LISTED | AVAILABLE_WITH_ROWS | AVAILABLE_WITH_ROWS | AVAILABLE | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_RANGE_DISCOVERY_PENDING | 7 | us |
| Soccer | ACTIVE_OR_LISTED | AVAILABLE_WITH_ROWS | AVAILABLE_WITH_ROWS | AVAILABLE | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_RANGE_DISCOVERY_PENDING | 8 | us |
| Tennis | INACTIVE_OR_NOT_LISTED | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_RANGE_DISCOVERY_PENDING | 0 | none |
| UFC | ACTIVE_OR_LISTED | AVAILABLE_WITH_ROWS | AVAILABLE_WITH_ROWS | AVAILABLE | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_RANGE_DISCOVERY_PENDING | 8 | us |
| BSN Puerto Rico | INACTIVE_OR_NOT_LISTED | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_CREDIT_PROTECTION | NOT_TESTED_RANGE_DISCOVERY_PENDING | 0 | none |

## Coverage

- Sports with current events: 5
- Sports with current odds: 5
- Sports with score rows: 1
- Sports with player-prop rows: 0
- Bookmakers observed: betmgm, betonlineag, betrivers, betus, bovada, draftkings, fanatics, fanduel, lowvig, mybookieag, williamhill_us
- Markets observed: h2h, spreads, totals

## Validation

- Fixture validation: PASS
- Checks passed: 15/15

## Safety Notes

- No API key, authorization header or provider secret is written to this artifact.
- No SQL migration, historical import, feature rebuild, prediction generation or scheduler change was executed.
- Historical odds range discovery remains deferred to the next bounded checkpoint.
