# Lineup-conditioned transition architecture: admission audit

State: `BLOCKED_CONFIRMED_PREGAME_LINEUP_FEATURE_ADMISSION`; no model fitted and no performance claim.

After the QDA and joint-NRFI-analog failures, the next materially different mechanism considered was a batter-order-conditioned base/out transition model, with opponent pitcher and observed lineup as inputs. The admission check must precede fitting; the existing certified team/pitcher aggregate outcome exports alone do not contain these inputs.

## Read-only evidence from canonical Supabase

On 2026-09-22 UTC, inspected `ynuocvexviorgdjrfthw` via schema and bounded historical queries, with cutoff 2026-09-18. No DDL/DML or acquisition occurred.

- `mlb_ml_xyear_lineup_v1`: exactly six columns — season, game_pk, game_date, team, batter, batting_order. It has no announcement, capture, as-of or availability timestamp.
- Historical inventory: 2025 has43,740 rows over2,430 games (March18–September28); 2026 through cutoff has41,562 rows over2,309 games (March25–September18). Counts establish availability of retrospectively observed batting orders, not pregame knowledge.
- Repository construction evidence: `supabase/migrations/20260920161000_mlb_ml_xyear_prior_starts_reconcile_v5.sql`, lines258 onward, derives each batter's first `at_bat_number` from the **target game's** Statcast pitches, ranks those appearances, then keeps the first nine batters. This is not a pregame announcement snapshot. Substitutions/appearance ordering can also differ from an official starting lineup. Using it as a target-game known lineup would introduce post-start information.
- Raw historical transitions are not claimed absent: a bounded500-row March2025 first-inning sample from `pick2_raw_mlb_statcast_pitches` had `on_1b`, `on_2b`, `on_3b` keys in500/500 raw payloads. Field presence alone does not certify event ordering, missing pitches, after-state construction or batter/pitcher transition coverage. No raw rows were imported into the new models.
- `mlb_totals_v11e_projected_lineup_players_2025_v1` exists with prior-start/rate fields and projected_order. A **projection** is a different input from a confirmed lineup; this audit does not relabel it as confirmed or inherit a new transition-model certificate. It remains a possible separately specified future design, not proof the requested confirmed-lineup model can run.

## Concrete boundary and next evidence

The contemplated architecture cannot be trained as specified using a certified confirmed-pregame lineup feature. Required missing evidence is a timestamped pre-start lineup source, with exact MLBAM identities and original availability records, plus a separately verified historical transition construction. No inference from FULL/postgame batting orders is permitted. No fuzzy identities or current-game sequence masquerading as pregame features.

This is a specific data-admission blocker, not a theorem that every possible architecture has been exhausted. QDA and NRFI analog failures do not justify changing their fixed parameters. A projected-lineup transition architecture would require its own source/cutoff audit, frozen model and tests; this blocked confirmed-lineup design provides no results for it. No external window is opened.

The parallel new-source search also reached concrete access/provenance gates: OddsPapi has no local credential/verified entitlement and original timestamp semantics remain unresolved; Betfair needs account entitlement and a target-market manifest. See `MLB_NEW_PUBLIC_SOURCES_AUDIT_20260922.md`. Seven new metadata sources were checked without importing rows or repeating discarded sources. No odds-priced market corpus was certified.

Follow-up: the projected-lineup alternative was also audited (35,802 rows, 1,989 games, zero invalid/missing prior-start dates). See MLB_PROJECTED_LINEUP_ADMISSION_20260922.md for missing aggregate provenance and transition event categories; a prior last_start_date alone is not a certificate of all 30-day fields.

The projected alternative was followed through a full replay, not deferred after the small sample. All35,802 rows checked;372 PA,334 hits,259 walks,175 HR discrepancies remain under the stated strict-prior30-day definition. Counts overlap. This unresolved source/replay discrepancy blocks using the table as certified; it does not prove leakage. See the preserved SQL and reconciliation JSON.
