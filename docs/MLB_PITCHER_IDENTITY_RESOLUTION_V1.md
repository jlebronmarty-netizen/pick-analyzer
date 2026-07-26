# MLB Pitcher Identity Resolution V1

Status: PARTIAL

The identity bridge connects current SportsDataIO starter evidence to historical Retrosheet starter logs without fuzzy or last-name-only matching.

## Resolution Order

1. Existing `provider_entity_mappings` exact SportsDataIO player ID.
2. Existing `sport_players.provider_ids` exact SportsDataIO player ID.
3. Existing MLB official player ID when present.
4. Exact normalized full name plus team where a persisted current player row exists.
5. Provider-scoped GamesByDate player ID plus exact starter full name when local player row is pending.
6. Historical Retrosheet identity by exact normalized full name; ambiguous names are blocked.

## Prohibited Behavior

- No last-name-only matching.
- No fuzzy automatic matching.
- No team-only matching.
- No duplicate local player rows are created.
- No two active provider players mapped to the same historical identity.

## Current Proof

For the 2026-07-26 slate after authorized GamesByDate refresh:

- Provider starter IDs found: 16
- Projection-safe pitcher bridges: 11
- Historical IDs bridged with recorded-outs samples: 11
- Ambiguous bridges accepted: 0
- Duplicate historical mappings accepted: 0
- Inactive player mappings accepted: 0

Some projection-safe rows use provider-scoped player IDs because the local `sport_players` row is pending. These are real SportsDataIO IDs and are marked with `CANONICAL_PLAYER_ROW_PENDING` in assignment warnings.
