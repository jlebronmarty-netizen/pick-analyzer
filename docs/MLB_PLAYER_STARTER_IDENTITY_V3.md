# MLB Player And Starter Identity V3

Status: local identity reconciliation contract prepared; no mappings are persisted by this phase.

This phase unifies identity rules across SportsDataIO player IDs, Retrosheet IDs, The Odds API pitcher names, canonical players, pitcher projections, starter assignments and stored player props. It does not call providers, persist mappings, import rows, backfill predictions, seed epochs, activate V2 or mutate production data.

## Current Stored Evidence

- MLB player rows: 7389
- MLB provider identity rows: 59239
- MLB starter/lineup rows: 27
- MLB player stat rows: 47232
- Genuine stored MLB pitcher-outs prop rows: 11
- Certified The Odds API pitcher identity bridge: deterministic Will Warren mapping exists from prior approved work
- Normalized-only or ambiguous pitcher names remain unpersisted

## Identity Domains

| Domain | Source | Canonical target | Persistence rule |
| --- | --- | --- | --- |
| SportsDataIO player ID | `sport_players.provider_ids`, `provider_entity_mappings` | `sport_players.id` | persist only exact provider ID to canonical player |
| Retrosheet player ID | Retrosheet historical files/workflows | `sport_players.id` or review queue | persist only exact historical identity bridge |
| The Odds API pitcher name | outcome description/name key | `sport_players.id` | persist only exact/deterministic event-team-safe mapping |
| Starter assignment | `sport_lineups` / starter sync | canonical player or provider-scoped pending identity | no fabricated player row |
| Pitcher projection identity | pitcher projection and starter assignment services | canonical player/provider-scoped starter | block ambiguous name matches |
| Player prop identity | certified event + pitcher bridge | canonical player | no market line shown without same-event projection |

## Deterministic Matching Rules

Allowed:

- exact provider player ID match
- exact canonical provider mapping match
- exact Retrosheet ID match where source row explicitly supplies it
- The Odds API pitcher name match only after event crosswalk, team membership and starter/projection evidence agree
- provider-scoped starter ID when canonical player row is pending, clearly marked as pending

Blocked:

- normalized-only name match
- fuzzy name match
- same-name cross-team match
- same-name cross-event match
- missing provider ID with multiple canonical candidates
- player prop name match without event identity
- starter inference from final-only or post-start evidence

## Manual Review Queue

Review item shape:

```json
{
  "sportKey": "baseball_mlb",
  "source": "the-odds-api | sportsdataio | retrosheet",
  "sourceEntityType": "player | starter | pitcher_prop_outcome",
  "sourceIdentifier": "provider id or deterministic name key",
  "sourceDisplayName": "name as supplied by source",
  "candidateCanonicalIds": [],
  "evidence": [],
  "blockingReason": "NORMALIZED_ONLY | AMBIGUOUS | TEAM_CONFLICT | EVENT_CONFLICT | PROVIDER_ID_MISSING",
  "recommendedAction": "manual_review_or_source_metadata_required"
}
```

No review item may be auto-persisted.

## Starter Identity Rules

Starter assignment can be projection-eligible only when:

- event is pregame at evidence time
- starter status is confirmed, probable or explicitly source-supported expected
- source timestamp is present
- identity is exact canonical or provider-scoped pending
- team assignment matches event side
- post-start/final-only evidence is rejected

Relievers and bullpen usage must not be promoted to starter identity.

## Certification

- `MLB_PLAYER_IDENTITY_V3_PASS`
- `MLB_STARTER_IDENTITY_V3_PASS`
- `NO_AMBIGUOUS_PLAYER_PERSISTENCE_PASS`
- Provider calls: 0
- Remote mutations: 0
- Production mutations: 0
- New mappings persisted: 0
