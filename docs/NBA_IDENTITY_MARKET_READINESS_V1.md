# NBA Identity And Market Readiness V1

Status: readiness contract prepared; no NBA identity mappings, market rows, props, predictions or recommendations are created.

This phase documents NBA identity and market boundaries after the partial baseline certification. It does not call providers, persist mappings, sync odds, create player props, calculate EV, calculate Kelly, generate picks, apply SQL, import data or mutate production.

## Stored Evidence

| Evidence | Rows | State |
| --- | ---: | --- |
| provider identities | 2335 | partial mapping evidence |
| players | 579 | partial player dimension |
| teams | 30 | available |
| events | 14 | partial/trial |
| odds snapshots | 540 | partial/trial |
| player props | 0 | unavailable |
| predictions | 27 | legacy/trial |

## Identity Readiness

Allowed:

- exact provider ID to canonical NBA player mapping
- exact provider team ID to canonical NBA team mapping
- exact provider event ID to canonical event mapping when schedule identity is verified
- manual review queue entries for ambiguous player/team/event identities

Blocked:

- normalized-only player name persistence
- fuzzy player identity persistence
- cross-team or cross-season identity attachment
- prop identity inference without provider player ID or deterministic event/team/player evidence
- player stat import when the player identity is unresolved

## Market Readiness

Current full-game odds snapshots are partial/trial evidence only.

Allowed after future approval:

- standard full-game moneyline, spread and total snapshots where provider entitlement and event identity are verified
- read-only readiness reporting against stored snapshots
- market provenance and deterministic snapshot-key validation

Blocked:

- NBA player props
- alternate lines
- live betting markets
- historical/opening/closing line completion claims
- EV, Kelly, stake, bankroll, official-pick or portfolio logic
- any fake sportsbook line or consensus-derived multi-book claim

## Activation Boundary

NBA market data may not be used for production recommendations until:

- canonical event/result coverage is complete enough for validation
- market rows reconcile to certified event identities
- provider entitlement and budget are approved
- settlement and replay support are certified
- prediction model readiness is separately certified

## Certification Markers

- `NBA_IDENTITY_MARKET_READINESS_V1_PASS`
- `NBA_NO_AMBIGUOUS_IDENTITY_PERSISTENCE_PASS`
- `NBA_PLAYER_PROPS_REMAIN_BLOCKED_PASS`
- `NBA_NO_MARKET_OVERCLAIM_PASS`
- `NO_EV_KELLY_RECOMMENDATION_C3_PASS`
- `NO_PROVIDER_CALL_C3_PASS`
- `NO_REMOTE_MUTATION_C3_PASS`

Provider calls: 0

Remote mutations: 0

Production mutations: 0

New mappings persisted: 0

Market rows created: 0
