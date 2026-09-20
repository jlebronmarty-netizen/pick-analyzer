# MLB Moneyline XYear Leakage-Safe Daily Recovery V3 — 2026-09-20

Status: `RESEARCH WAREHOUSE RECOVERED / FORWARD FREEZE UNCHANGED`

## Incident

The MLB Research Daily sync had complete base history through 2026-09-19, but the derived Moneyline xyear layer stopped advancing after 2026-09-17:

- `mlb_ml_xyear_features_v1`
- `mlb_ml_xyear_feature_values_v1` PREGAME
- `mlb_ml_xyear_component_scores_v1` PREGAME

The base warehouse was not the blocker. The missing piece was an incremental, versioned, leakage-safe materializer.

## Forensic findings

The canonical cross-year SQL survives in Supabase migration history, but the daily population of feature values and component scores had never been versioned as a reusable incremental builder.

The last fully populated PREGAME day was 2026-09-14. Sep15-16 already had partial hand/arsenal coverage; Sep17 degraded further and encoded several zero-population components as score 0.

This was unsafe for selective rules because a missing component encoded as zero can accidentally satisfy a threshold.

## Frozen formula parity

Using Sep14 as the gold-standard day:

- Recent Form: 10/10 games exact.
- History: 10/10 games exact.
- Starter L5: 40/40 feature cells exact.
- Starter cumulative metrics: strict-prior all appearances.
- Starter L5 RA9/WHIP: strict-prior last five starts.
- Team Pythagorean win percentage exponent: exactly 1.83.
- Offense OPS proxy: `(H+BB)/(AB+BB) + TB/AB`.
- Component raw score: sum of frozen directed z-features divided by total mapped feature count.
- Component z-score: frozen 2025 component normalization.

No formula, threshold, selected route, or model parameter was retuned.

## Pregame evidence contract

New table:

`public.mlb_ml_pregame_starter_evidence_v1`

A starter identity is accepted only if its evidence timestamp is strictly before first pitch.

Sources:
- `pick2_mlb_first_inning_daily_features`
- `pick2_mlb_games` probable-pitcher evidence
- bounded pregame PA12 pilot evidence for Sep18 recovery only

Missing pregame evidence remains NULL.

Observed postgame lineups are never promoted to pregame lineup evidence.

## Sep18 recovery

Base:
- 15/15 games
- 4,541 Statcast pitches
- 30 team-game rows
- 30 batting rows
- 135 pitcher rows

Derived:
- 15 xyear feature rows
- 1,350 PREGAME feature-value rows
- 150 PREGAME component rows
- Recent Form: 15/15 scored
- History: 15/15 scored
- Starter: 12/15 scored
- Lineup/Matchup: 0/15, correctly NULL

Pregame starter evidence:
- 26 sides
- 14 games represented
- 12 games with both sides

## Sep19 recovery

Base:
- 15/15 games
- 4,572 Statcast pitches
- 30 team-game rows
- 30 batting rows
- 140 pitcher rows

Derived:
- 15 xyear feature rows
- 1,350 PREGAME feature-value rows
- 150 PREGAME component rows
- Recent Form: 15/15 scored
- History: 15/15 scored
- Starter: 13/15 scored
- Lineup/Matchup: 0/15, correctly NULL

Pregame starter evidence:
- 28 sides
- 15 games represented
- 13 games with both sides

## Idempotency

Repeated V3 materialization produced identical component digests:

- Sep18: `762b705e3e3e2ed9c150706ee243877c13918909393352a74e6b0faa5e0c4837`
- Sep19: `2131ecc2decda2a5ae13fe95d807d69b4d5e8009161ca9e7616e68fc3adb1292`

## Base refresh parity

The new base incremental refresh was replayed against already-certified Sep14 pitcher history.

Before and after:
- rows: 88 / 88
- digest: `055715d8234b6c059f3f40f2cfb12818975070bd523faf409ec7b5df87b44797`

This proves the incremental base updater reproduces the frozen cross-year Statcast aggregation contract.

MLB Official pitcher run attribution can differ from this historical Statcast-derived contract. The xyear research warehouse intentionally preserves the frozen training semantics instead of silently switching sources mid-season.

## Sep18 frozen forward anomaly

Two Sep18 Moneyline forward rows contain starter scores that do not reproduce the certified component formula:

- game 823005: frozen -7.78066474468184 vs canonical rebuilt -0.458465973954961
- game 823252: frozen -6.17636690667647 vs canonical rebuilt 1.08327641945049

The pitcher identities match the preserved pregame evidence. HOME/AWAY inversion also does not reproduce the frozen values.

Those frozen rows remain immutable historical evidence and are not rewritten. The V3 warehouse uses the formula certified by historical parity.

Sep19 frozen overlap does reproduce exactly:
- game 823003: diff ~2.2e-15
- game 823249: diff ~4.6e-16

Team prior 2025 scores reproduce at machine precision across Sep18-19.

## Daily automation

The existing `/api/cron/mlb-statcast-daily` route is reused.

1. capture today's pregame starter evidence;
2. preserve existing market/prop/research stages;
3. ingest/certify previous-day Statcast and analytics;
4. refresh previous-day xyear base/history;
5. materialize previous-day leakage-safe PREGAME xyear layer;
6. allow Moneyline freeze only if the xyear sync succeeded;
7. independent shadow-only markets continue even if Moneyline fails closed.

No parallel scheduler is introduced.

## 2026-09-20 pregame proof

Manual capture before deployment:
- 28 starter sides
- 15 games represented
- 13 games with both starters
- 28/28 evidence timestamps before first pitch
- earliest first pitch: 2026-09-20T17:10:00Z

## Boundaries

- Official Picks modified: NO
- APOSTAR activated: NO
- retroactive forward picks: NO
- frozen forward rows rewritten: NO
- Moneyline retuned: NO
- historical Odds API credits used: 0
- research/shadow boundary unchanged


## Forward runtime parity bug found during recovery

The active forward service had a separate implementation defect:

- it queried `mlb_ml_xyear_pitcher_game_v1` with `starter=true` before constructing the Starter component;
- therefore cumulative RA9/WHIP/K%/BB%/hard-hit/whiff were being computed from starts only;
- the frozen historical contract uses **all strict-prior pitcher appearances** for cumulative metrics and **last five strict-prior starts** only for L5 RA9/WHIP.

This was corrected without changing any coefficient, normalization statistic, route threshold or selected market rule.

The corrected runtime now:
1. loads all prior pitcher appearances;
2. computes cumulative Starter metrics from all appearances;
3. filters to starts only for L5 RA9/WHIP.

This explains why the Sep18 frozen starter-score values failed historical parity while Sep19 happened to match in the limited overlapping cases.

## Sep20 timing anomaly

The existing Sep20 Moneyline tracker rows were already frozen at:

`2026-09-20T04:39:02.003993Z` = **00:39:02 Puerto Rico**

This is earlier than the runtime's 10:45 Puerto Rico freeze gate.

All 15 rows are NO_PICK, but they are not accepted as valid fixed-window prospective evidence.

The rows remain immutable and are not deleted or rewritten.

Runtime hardening now requires any existing frozen row reused by `REUSE_NO_OP` to satisfy:

- frozen local date equals target date;
- frozen local time is at or after 10:45 Puerto Rico;
- frozen timestamp precedes that game's first pitch.

An existing tracker state that fails this timing validation is blocked rather than reused.

The first clean prospective Moneyline observation after this repair must therefore be a future date with a valid runtime freeze.
