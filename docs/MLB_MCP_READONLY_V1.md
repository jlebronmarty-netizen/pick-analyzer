# MLB MCP Read-Only V1

## Purpose

Expose the certified Pick Analyzer MLB Statcast foundation and validated shadow research models through one remote MCP endpoint so a new ChatGPT conversation can query the same permanent database without re-uploading CSV/Excel files.

Production endpoint after merge:

`https://pick-analyzer.vercel.app/mcp`

## Security / scope

V1 is intentionally read-only and contains no MCP tools that mutate Pick Analyzer state.

It does **not** expose:

- Statcast raw pitch rows or raw payloads;
- Supabase credentials or environment variables;
- odds/provider sync actions;
- model registry writes or promotion;
- Official Pick writes;
- bet placement;
- bankroll mutation;
- EV/recommendation generation.

Every registered MCP tool declares read-only, non-destructive and idempotent annotations.

## Tools

1. `mlb_find_player` — resolve a player name to MLBAM person ID.
2. `mlb_games_for_date` — list native games and gamePk identifiers for a date.
3. `mlb_statcast_coverage` — certified coverage counts.
4. `mlb_pitcher_profile` — pitcher season/pitch-mix/recent-window Statcast profile.
5. `mlb_batter_profile` — batter Statcast profile and recent games.
6. `mlb_team_profile` — team batting/pitching summaries.
7. `mlb_matchup` — descriptive pitcher-vs-team/lineup Statcast matchup evidence.
8. `mlb_project_pitcher_strikeouts` — `MLB_PITCHER_K_V1` shadow projection; probability only on certified K lines.
9. `mlb_project_pitcher_walks` — `MLB_PITCHER_BB_V1` shadow projection; probability only on certified BB lines.

## Model restrictions

`mlb_project_pitcher_strikeouts` and `mlb_project_pitcher_walks` remain research-only shadow models. They return no sportsbook price, no expected value, no recommendation and perform zero Official Pick writes.

Certified K probability lines: `2.5, 3.5, 4.5, 5.5`.

Certified BB probability lines: `0.5, 1.5, 2.5, 3.5`.

## Intended chat workflow

A client can:

1. call `mlb_games_for_date`;
2. resolve missing IDs with `mlb_find_player`;
3. inspect pitcher/team/matchup evidence;
4. call a shadow K or BB projection where the required frozen pregame feature row exists.

This MCP interface must not weaken any research or market-activation gate already certified in Pick Analyzer.
