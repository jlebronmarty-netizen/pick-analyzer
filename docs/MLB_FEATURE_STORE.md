# MLB Feature Store

Status: Active

MLB feature generation reads normalized schedule, odds, team/player stats and context rows through the existing Feature Store architecture.

SportsDataIO Discovery V1 does not add feature builders. It reports which provider fields may become feature inputs after deterministic verification.

Current unavailable or limited feature domains:

- Confirmed lineups
- Detailed injuries
- Player importance without grounded role evidence
- Starter identity when not provider-backed
- Weather/wind when not populated
- Unsupported market-specific features

Discovery evidence must remain advisory until a feature builder, validation and no-leakage policy are implemented.
