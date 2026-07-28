# Universal Event Identity Materialization V1

Status: persisted.

This checkpoint materialized canonical `sport_events` from already stored provider evidence only. It made no provider calls and did not change prediction, settlement, learning, scheduler, portfolio, market-intelligence or Sports Center logic.

## Scope

Included:

- NFL stored The Odds API odds events.
- NHL stored The Odds API odds events.
- UFC stored The Odds API odds events.
- UFC stored completed score-result events.

Excluded:

- Soccer, because stored rows are scoped only to `soccer_generic`.
- Tennis, because no stored provider odds or result events are present.
- Any fuzzy or ambiguous match.

## Persisted Result

Initial dry-run planned:

| Sport | Events | Odds events | Result events | Odds rows linked | Result rows linked |
| --- | ---: | ---: | ---: | ---: | ---: |
| NFL | 75 | 75 | 0 | 1978 | 0 |
| NHL | 32 | 32 | 0 | 426 | 0 |
| UFC | 44 | 32 | 12 | 360 | 12 |

Persisted execution completed idempotently after one bounded retry:

- Canonical events materialized: 151.
- Provider mappings upserted: 151.
- Stored odds rows linked to canonical event IDs: 2764 total.
- UFC result rows linked to canonical event IDs: 12.
- Provider calls: 0.
- Remote mutations: bounded identity-only updates.

Final idempotency dry-run:

- Odds rows remaining to link: 0.
- Result rows remaining to link: 0.

## Post-Materialization Coverage

| Sport | Canonical events | Provider event mappings | Provider-native mappings | Odds rows | Result rows | Canonical result rows | Identity coverage | Remaining blocker |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| NFL | 75 | 75 | 0 | 1978 | 0 | 0 | 100% | none for current provider-evidence identity |
| NHL | 32 | 32 | 0 | 426 | 0 | 0 | 100% | none for current provider-evidence identity |
| UFC | 44 | 53 | 9 | 360 | 12 | 12 | 100% | 9 legacy/provider-native mappings remain for inspection |
| Soccer | 0 | 0 | 0 | 260 | 0 | 0 | 0% | competition-scoped canonical events and mappings missing |

## Safety

- No provider calls.
- No SQL.
- No prediction rows generated or updated.
- No settlement rows written.
- No learning labels written.
- No feature rebuilds.
- No scheduler changes.
- No fuzzy matching.

## Certification Markers

- `UNIVERSAL_EVENT_IDENTITY_MATERIALIZATION_V1_PASS`
- `NFL_CANONICAL_EVENT_IDENTITY_UNLOCK_PASS`
- `NHL_CANONICAL_EVENT_IDENTITY_UNLOCK_PASS`
- `UFC_CANONICAL_EVENT_IDENTITY_PARTIAL_PASS`
- `SOCCER_COMPETITION_SCOPE_STILL_BLOCKED_PASS`
- `NO_FUZZY_MATCHING_PASS`
- `NO_PROVIDER_CALL_PASS`
- `IDENTITY_ONLY_MUTATION_PASS`
- `NO_PREDICTION_MUTATION_PASS`
- `NO_SETTLEMENT_MUTATION_PASS`
- `NO_LEARNING_MUTATION_PASS`
