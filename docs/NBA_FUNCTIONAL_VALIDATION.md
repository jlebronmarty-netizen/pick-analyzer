# Functional integration validation scope

The existing protected /api/sports/basketball_nba/events and /odds now read the durable shared archive for the default/BALLDONTLIE provider in production. Explicit alternate providers and non-NBA routes retain their prior implementations. Public canonical requests are rejected instead of exposing the paid feed. Navigation links enter the protected NBA market-data page. Freshness and unsupported periods remain explicit.

The latest schedule is not silently treated as an officially verified NBA calendar. Archived event identities use canonical team codes and BDL namespace or exact prior team/time matches. Odds still require exact paired sides, signed handicaps, timestamps and independent sportsbook settlement rules. No model probability is inferred from price.

Tests executed in the local working source: 27 Node tests for contract/source/date/line/identity validation, paired-price normalization, phase segregation, bounded capture planning, selection persistence, single-flight polling, visibility and retries. Four transactional SQL tests passed (insert, idempotency, immutable archive, legacy projection), with synthetic rows rolled back. Compiler, protected endpoint and browser tests must be recorded separately; these unit tests alone are not an end-to-end certificate.

Scheduled persistence uses the existing NBA half-hour invocation; source polling remains the central five-minute job. This is not an exhaustive tick archive. The current-day sync endpoints do not fabricate historical prices. Other sports, old model inputs, official injuries/lineups, predictions and settlement are outside this data-only change.
