# SportsDataIO Capability Matrix

The typed source of truth is `src/config/sportsdataio-endpoint-catalog.ts`.

| Sport | Catalog Status | Trial Persistence | Odds Snapshot Status | Next Blocker |
| --- | --- | --- | --- | --- |
| NBA | Cataloged and partially implemented | Teams, players, injuries, lineups, player stats | BettingEvents discovery confirmed; no sportsbook-priced snapshots | Confirm exact priced market/outcome endpoint |
| MLB | Cataloged | Pending | Pending | Build sport-specific fixture normalizers before any calls |
| NFL | Cataloged | Pending | Pending | Build season/week fixture normalizers before any calls |
| NHL | Cataloged | Pending | Pending | Build goalie/line fixture normalizers before any calls |
| Soccer | Cataloged | Pending | Pending | Select one competition and build scoped fixtures |

Shared betting normalization now supports deterministic zero-call fixtures for discovery-only events, market-index records, priced outcomes, consensus outcomes, unlisted outcomes, entitlement-blocked statuses and archive-required routing.

No catalog entry authorizes production use by itself. Production eligibility still requires entitlement, payload validation, persistence validation, trial isolation, data-quality checks and explicit production approval.
