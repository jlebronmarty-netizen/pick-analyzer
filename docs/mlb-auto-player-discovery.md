# MLB Automatic Player Discovery

Certification: `MLB_AUTO_PLAYER_DISCOVERY_PASS`

Date: 2026-07-21

## Summary

SportsDataIO MLB player-stat imports now preserve unresolved provider player identities as explicit reviewable provisional records without assigning a trusted canonical `sport_players.id`.

The workflow reuses `provider_entity_mappings` instead of adding a table. Trusted player mappings remain `entity_type='player'`; provisional unresolved identities use `entity_type='unresolved_player'` and keep `production_eligible=false`.

## Behavior

- Preserve provider player ID, provider name, provider team ID, season, source date and source stat record ID.
- Create or reuse one provisional mapping per provider player ID and season.
- Keep the affected `sport_player_stats` row with `player_id=null` until exact evidence exists.
- Mark identity status as `UNRESOLVED_PROVIDER_ID`, `PENDING_METADATA` and `REVIEW_REQUIRED`.
- Never use fuzzy name matching for trusted identity assignment.
- Do not block otherwise valid stat rows when event/team mapping is valid.

## Reconciliation

`src/services/mlb-unresolved-player-identity.service.ts` scans stored MLB game-stat rows with `player_id=null`.

Dry-run mode reports unresolved provider IDs and exact mapping availability with zero provider calls and zero mutations.

Write mode, protected by `CRON_SECRET` through `/api/mlb/players/unresolved-identities`, only:

- upserts provisional `unresolved_player` mapping rows for unresolved identities;
- applies exact trusted `entity_type='player'` mappings when already present;
- updates identity/lineage metadata only;
- never changes statistical values.

## Known Case

Provider player ID `10003762` (`Eliezer Alfonzo`) remains an unresolved provider identity unless exact SportsDataIO player metadata or a manual/admin-approved trusted mapping is supplied. This case must not be fuzzy matched.

## Validation

Operations Validation includes deterministic fixture coverage for:

- unresolved provider player creates a provisional record;
- repeated encounter reuses the provider tuple;
- no duplicate provisional identity;
- exact later mapping is the only automatic resolution path;
- duplicate names do not auto-match;
- another sport cannot match;
- no fuzzy automatic resolution;
- reconciliation is idempotent.

`npm.cmd run build` passed after implementation.
