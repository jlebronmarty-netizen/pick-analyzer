# Projected lineup builder trace — 2026-09-22

Research-only, read-only investigation on canonical Supabase `ynuocvexviorgdjrfthw`. This trace separates recovered authoritative source definitions from empirically reconstructed output semantics. No database writes or model evaluation were performed by this investigation.

## Original population implementation

The exact original population script of `mlb_totals_v11e_projected_lineup_players_2025_v1` remains unavailable. Migration `20260917230325`, `create_mlb_totals_v11e_projected_lineup_tables`, creates the player and team tables only. Searching migration statements for the exact table, `starts_21d`, and `pa_30d` finds that DDL, not its population query. Searching current public function bodies finds the downstream V11e ridge solver, not the population implementation. There are no custom triggers on the player table. Local `git log --all -G 'mlb_totals_v11e_projected_lineup|starts_21d'` across SQL/MJS/Python/Markdown found only the prior audit commit `dd802191`; local temporary-file searches and GitHub default-branch code search found no original builder.

The player table has no builder version, source version, source cutoff timestamp, build timestamp or raw snapshot digest. Its `research_only` default and `last_start_date` are insufficient to recover those missing provenance fields. A matching reconstruction does not retrospectively create an original builder certificate.

## Authoritative canonical source definitions recovered

Supabase migration **`20260915203807`, `mlb_ml_crossyear_player_helpers_v1`**, contains the actual creation SQL for `mlb_ml_xyear_batter_game_v1` and `mlb_ml_xyear_lineup_v1`. Both read `pick2_raw_mlb_statcast_pitches`, require `game_year in (2025,2026)` and `game_type='R'`, use `coalesce(mlbam_batter_id,source_batter_id)` for exact player identity, and derive batting team as away for `Top`, home otherwise.

`mlb_ml_xyear_batter_game_v1` groups by season, game PK, date, batter and team:

| Column | Authoritative expression |
| --- | --- |
| `pa` | Count pitches with non-null `events` |
| `ab` | Same, excluding walk, intent_walk, hit_by_pitch, sac_fly, sac_bunt, catcher_interf, truncated_pa |
| `hits` | Events single/double/triple/home_run |
| `singles`, `doubles`, `triples`, `hr` | Corresponding exact event |
| `walks` | Events walk **or intent_walk** |
| `strikeouts` | Events strikeout or strikeout_double_play |
| `batted_balls` | Non-null launch_speed |
| `hard_hits` | launch_speed >= 95 |
| `barrels` | launch_speed_angle = 6 |
| `ev_sum`, `ev_n` | Sum/count non-null launch_speed |

These are research aggregation definitions; `ab` is not independently asserted to match every official scoring convention. The migration counts event rows without a terminal-PA deduplication clause; uniqueness must be audited in raw data independently. All-pitch EV fields include any pitch carrying launch_speed, not only terminal events.

`mlb_ml_xyear_lineup_v1` first groups each game's batter/team and takes `min(at_bat_number)`. It ranks by that value then batter ID within season/game/team, keeping the first nine. This is an observed postgame participation-order proxy, not a confirmed pregame lineup feed. It is eligible only as history for strictly later target dates. It does not certify players' current roster or availability.

Migration `20260920143725`, `mlb_ml_xyear_base_incremental_v2`, also contains these definitions for refreshing a **2026** target date. It is not evidence that the projected 2025 table was built by that later refresh function.

The similarly named `mlb_statcast_batter_game_logs` is a different semantic surface: its live materialized-view definition counts distinct `(game_pk,at_bat_number)` over all pitches as PA, splits walks and intentional walks, and has no regular-season filter. It must not silently replace the xyear helper in this reconciliation.

## Reconstructed selection semantics

For all **35,802 stored projected rows**, joining prior `mlb_ml_xyear_lineup_v1` on exact team and batter within **[target date minus 21 days, target date)** gives zero mismatches for `starts_21d`, `avg_order_21d` (absolute tolerance 1e-9), and `last_start_date`.

The following independently rerunnable query reconstructed every projected member and order: **35,802 joined rows, zero expected-only, zero actual-only, zero order mismatches**.

```sql
with g as (
  select distinct game_pk,game_date,team
  from mlb_totals_v11e_projected_lineup_players_2025_v1
), h as (
  select g.game_pk,g.team,l.batter,count(*) as starts,
         avg(l.batting_order) as avg_order,max(l.game_date) as last_start
  from g join mlb_ml_xyear_lineup_v1 l
    on l.season=2025 and l.team=g.team
   and l.game_date>=g.game_date-21 and l.game_date<g.game_date
  group by g.game_pk,g.team,l.batter
), r as (
  select *,row_number() over (
    partition by game_pk,team
    order by starts desc,last_start desc,avg_order,batter
  ) as projected_order from h
), s as (
  select * from r where projected_order<=9
), j as (
  select t.batter actual_batter,s.batter expected_batter,
         t.projected_order actual_order,s.projected_order expected_order
  from mlb_totals_v11e_projected_lineup_players_2025_v1 t
  full join s using(game_pk,team,batter)
)
select count(*) joined_rows,
       count(*) filter(where actual_batter is null) expected_only,
       count(*) filter(where expected_batter is null) actual_only,
       count(*) filter(where actual_order<>expected_order) order_mismatch
from j;
```

**`projected_order` is selection rank by prior start frequency/recency; it is not batting-slot order.** A first diagnostic used average order ahead of recency to choose nine, then sorted chosen players by average order. That failed with 379 members missing and 379 extra, plus 27,998 order mismatches among matched members. Inspecting a deterministic stored sample showed frequency ordering; the exact reconstruction above then matched all rows. This was builder-semantics diagnosis, not model/threshold tuning. Both attempts are retained here.

## Certification boundary

These checks recover historical event-time semantics, not an immutable as-published pregame snapshot. The original upstream snapshot/version, ingestion availability at each historical cutoff and potential later stat corrections remain unproven by the table itself. Target-date game PK/team/date are treated as the research universe, not a certified pregame schedule feed. Raw reconstruction, per-feature comparisons, duplicate/key checks and source-version evidence are handled in the companion reconciliation audit before any admission decision. No present-game observed lineup may become a pregame feature.
