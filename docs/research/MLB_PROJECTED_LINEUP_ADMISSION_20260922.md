# Projected-lineup feature admission review

Status: RESEARCH ONLY; bounded read-only audit, no model fit and no external outcomes opened.

A projected-lineup NRFI absorbing base/out model is a materially different possible mechanism. It does not require the target game's confirmed lineup. Therefore failure to certify a confirmed-lineup design does **not** establish that a projected-lineup design is impossible.

## Verified stored coverage

Read-only queries on canonical Supabase `ynuocvexviorgdjrfthw` verified `mlb_totals_v11e_projected_lineup_players_2025_v1` contains **35,802 rows, 1,989 games, 2025-04-01 through 2025-08-31**. All rows are research-only. Zero rows have null `last_start_date` or `last_start_date >= game_date`. Zero rows violate the checked basic identities: nonnegative PA, singles+doubles+triples+HR=hits, hits<=AB<=PA, projected order within 1–9. These checks establish limited structural consistency, not complete feature certification.

Available columns include exact numeric batter ID, team, projected order, starts and average order over 21 days, last start date, 30-day PA/AB/hits/singles/doubles/triples/HR/walks/strikeouts and batted-ball aggregates. No target outcomes were imported for this review.

## Concrete unresolved admission issues

Migration `20260917230325`, `create_mlb_totals_v11e_projected_lineup_tables`, supplies table DDL and research-only defaults. It does not supply the population query. Searching stored public function definitions for this exact table found none, and migration statements referencing it returned only that creation migration. The repository text search also did not locate its historical population implementation. Thus the inspected artifacts do **not yet** prove the exact input window, event mapping, terminal-PA deduplication or population version for the `*_30d` aggregates and projected-order selection. This is an unresolved provenance check, not a claim that those aggregates are wrong.

`last_start_date < game_date` verifies one lineup-selection field. It does not establish that all PA counts exclude current-day/future games. The table does not store an aggregate max-source-date, contributing game IDs, input digest, builder version or field-level source lineage. Those could be recovered by finding the original builder or reconciling the values against strictly prior stored events.

A base/out transition model additionally needs a certified exhaustive event taxonomy and runner-advancement transition definition. These lineup aggregates do not contain HBP, errors, double plays, sacrifices or base occupancy/next-state counts as separately certified inputs. Such events cannot silently be treated as ordinary outs; one may freeze an explicitly simplified transition model, but must document the approximation rather than present estimated transitions as observed truth.

## Viable next admission path

The stored `mlb_statcast_batter_game_logs` schema exposes game date, exact batter ID, batting team, PA, walks, intentional walks, HBP, hits and HR. The stored raw Statcast schema exposes dates, game/at-bat/pitch identifiers, exact player IDs, outs, events, inning and pre/post scores, plus raw payload/source/version/digest metadata. This review inspected schemas only; it did not certify raw runner-state availability, source coverage, rights or all derived game logs. Existing raw data is not automatically admitted merely because it exists.

A permitted continuation is a bounded read-only reconciliation: locate original projection builder or reconstruct documented prior-date windows from existing admitted historical events; verify exact batter/team mappings, nine unique orders per team, denominator semantics, component max dates and agreement with saved aggregates. Then certify the precise transition inputs or clearly freeze a simplified mechanics model with its approximation limits **before** joining target outcomes and evaluating. No paid odds or new provider calls are needed for that admission work. Never use target-game FULL payload to choose projected players or batting order.

Conclusion: the currently inspected certificate is insufficient to run this proposed architecture immediately using **only already-certified features**. There is a concrete feature-provenance admission task still available; this finding is not a universal data/architecture exhaustion claim. No threshold, candidate or gate was changed. Database writes, provider calls, Odds API credits, production changes and tracker changes: zero.

## Completed reconciliation follow-up

The next permitted read-only action was executed: five deterministic April1 player rows matched PA/hits/walks/HR, then all35,802 projected records were compared with exact-identity regular-season terminal-PA aggregates from the strictly earlier30-day window. The full result has372 PA mismatches,334 hit mismatches,259 walk mismatches and175 HR mismatches (overlapping counts). Query and result are preserved in scripts/research/audit_mlb_projected_lineup_reconciliation_20260922.sql and artifacts/research/mlb_projected_lineup_reconciliation_20260922.json. No alternative window, fuzzy mapping or row exclusion was tried. This is a concrete failed certification check, not proof of leakage or a diagnosis of the original builder's cause. The projected table is NOT ADMITTED for the proposed new model until authoritative builder/source-version semantics or a separately certified reconstruction resolves these discrepancies. No further expensive scan was launched.
