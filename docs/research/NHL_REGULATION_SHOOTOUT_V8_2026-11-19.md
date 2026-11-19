# NHL V8 — Regulation/OT/Shootout goal reconstruction (19 Nov 2026)

**Research only:** Current `main` NHL V1, V6, DRatings, paid provider credits, official picks and scheduled jobs remain unchanged. This is an isolated experimental branch, not a model promotion or a source of betting recommendations.

## What the official saved archive actually contains

Read-only query `sql/research/nhl_regulation_shootout_v8_source_audit_20261119.sql` was fetched from this branch and executed against Pick Analyzer Supabase:

| Official outcome period | Games | Final goals total | Reconstructed regulation goals total |
|---|---:|---:|---:|
| REG | 88 | 558 | 558 |
| OT | 15 | 93 | 78 |
| SO | 8 | 46 | 38 |
| **All** | **111** | **697** | **674** |

All 111 official NHL 2026-27 regular-season boxscores passed event/period/date/score validity gates in the archive snapshot. REG has a decisive regulation winner, while OT/SO teams were tied at the end of regulation. For OT/SO, subtract one decisive final goal from the winning side to reconstruct regulation scoring (e.g., 4–3 OT or SO -> 3–3 after regulation). The source already records `gameOutcome.lastPeriodType` and matching `periodDescriptor`. The regular-season overtime is a single decisive goal, and NHL shootout winners receive one goal added to the official final game score. Public league explanation: https://www.nhl.com/kraken/news/nhl-overtime-shootouts-row-310366008.

## Research challenger V8

- `src/lib/nhl-regulation-shootout-v8-research.mjs`: pure strict source parser (`REG`/`OT`/`SO`), validates season, regular-season game type, official team IDs, final scores, period number and source capture AFTER the game.
- Historical features are filtered by `boxscore_captured_at <= frozen_at` and match start + 4 hours strictly earlier than the decision. Duplicate/conflicting game captures and unknown source identity fail closed. No retrospective future boxes can become past forecasts.
- A fixed research-only rolling five-game Poisson uses regulation goals (including regulation ties) instead of full-game scores. When simulating the final, each modeled regulation tie gives the winning side +1 goal with an explicit **unvalidated** 50/50 OT/SO winner assumption, preserving correct final-score mass for integer totals/pushes. This does not certify book market rules or an overtime winning model.
- `gradeNhlRegulationV8Retrospective` scores strictly the *same frozen original games* against the V8 candidate on identical real final results; returns paired denominators and never promotes either model.

## First read-only historical comparison

With 20 already settled NHL Poisson V1 frozen records, 18 had enough as-of prior regulation games for the research V8 estimate. Two were excluded for insufficient qualifying earlier team history. Calculations used archived source facts available before each frozen decision.

| Same 18 games | Original V1 | Regulation-only V8 |
|---|---:|---:|
| Winner directional calls | 10/18 | 10/18 |
| Moneyline Brier | **0.26804** | 0.26928 |
| Over 5.5 Brier | **0.24593** | 0.26026 |

**No improvement was observed in this small retrospective cohort.** Do not enable a V8 production adjustment, assert statistical confidence, optimize a coefficient to this group, or relabel an unconfirmed goalie as confirmed. The experiment may be valuable for future hypothesis testing, but is not ready for an official model or ROI claim.

## Exact next gate

1. Keep official NHL/early V1/V6 frozen prediction pipelines unchanged; verify the normally scheduled ESPN V5 capture and late V6 attempt after 22:07 UTC.
2. If exploring V8 further, pre-register formulas and store completely independent **future** shadow predictions as separate records, then compare on same games, lines and period rules; no historical rewrites.
3. Target 30+ genuinely new matched games only as an initial screening and preferably 100+ across diverse opponents before drawing robust conclusions. Measure ML Brier/logloss and exact Puck Line/Total on true book lines with proper integer pushes.
4. Keep unconfirmed goalie source status and verified as-of historical goalie-form evidence separate, and add a genuine pregame confirmation feed only with source rights and independent evidence.

**All operations in this audit were read-only SQL plus isolated GitHub branch code and tests. No provider calls, no cron triggers, no database migration or official-pick changes.**
