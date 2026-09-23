# Projected lineup integrity reconciliation V1

Research-only closeout, 2026-09-22 UTC. Baseline PR187 commit dd802191; main verified separately at c8aac466. No production, tracker, Official Picks, APOSTAR, provider or database writes. External remains closed.

## Finding and classification

The original 372 PA / 334 hits / 259 walks / 175 HR discrepancies overlap across **372 unique records**. All are explained by **team scope**: the original replay summed a player's prior games across all teams; the stored projection sums only games with the target team. The independent raw replay reproduces both the all-team totals and same-team totals. This is evidence of a different aggregation definition, not evidence of leakage or a reason to alter stored data. No rows were dropped, windows retuned or values corrected.

Every projected record has a preserved audit row with stored values, canonical reconstruction, independent raw reconstruction, original mismatched features, cause, exact contributing game IDs, min/max source dates and lineage digests. See `artifacts/research/mlb_lineup_integrity_v1.records.json.gz`. All 372 affected records are classified TEAM_SCOPE_OTHER_TEAM_HISTORY. No unresolved integer inconsistencies remain. The classifier does not label a specific transaction a trade without a transaction source; it establishes only observed history under a different team code.

## Three-way reconciliation and coverage

- Projected table: **35,802 records, 1,989 games, April1–August31 2025**.
- Independent source: **597,796 stored raw regular-season pitches**, aggregated into **40,890 batter-game-team records**, March2–August30 2025.
- All **14 canonical batter-game fields** match raw exactly in **40,890/40,890** records each.
- Projected PA, AB, hits, singles, doubles, triples, HR, walks, strikeouts, batted balls, hard hits, barrels and EV count: **35,802/35,802 exact matches per field (100%)**, both against canonical and raw reconstruction.
- Projected EV sum: canonical SQL exact **35,801/35,802**; independently ordered JavaScript summation exact **16,776/35,802 (46.858%)**. Maximum raw absolute difference **7.275957614183426e-12**. All **35,802/35,802** pass explicitly reported absolute tolerance 1e-8. This is floating-point summation order; exact and tolerance-based rates are kept separate. No rounding repair is applied to stored data.
- Raw checks: zero missing canonical/raw games, duplicate terminal PA event rows, empty event strings, invalid inning halves or disagreement between populated source and mapped batter IDs.
- Prior observed batting order independently rebuilt from raw: **36,738/36,738**, no missing/extra records or order discrepancies.
- All projected starts21d, average order21d and last-start dates reproduce using same-team prior21-day history. Full candidate membership and projected rank also reproduce: zero missing/extra/order discrepancies across35,802 rows. Average-order comparison used1e-9 tolerance.

Numerical reconciliation does not certify an official statistical definition. In particular PA counts non-null terminal event rows; walks include intentional walks; AB follows the recovered exclusion list; launch-speed fields count every pitch carrying launch speed. The similarly named batter_game_logs materialized view has a different PA denominator and splits walks/IBB, so it is not interchangeable.

## Builder, sources and temporal lineage

The authoritative upstream builder is recovered in Supabase migration **20260915203807** (`mlb_ml_crossyear_player_helpers_v1`). It creates `mlb_ml_xyear_batter_game_v1` and `mlb_ml_xyear_lineup_v1` from `pick2_raw_mlb_statcast_pitches`. Exact numeric identity is coalesced MLBAM/source ID; batting team follows inning half. Source is `statcast`, version `baseball-savant-statcast-2025-original`; all597,796 pitches have raw digests.

The projected table's DDL is migration **20260917230325**. Its original population implementation, builder version and input snapshot were not recovered from migrations, functions, triggers, repository history, temporary files, default-branch search or statement history. We recovered an **equivalent algorithm**, not the missing original script. Detailed formulas and projection SQL are in `MLB_LINEUP_ORIGINAL_BUILDER_TRACE_20260922.md`.

Reconstructed cutoffs are strict calendar dates: statistics use [target date−30,target date), observed prior-order features use [target date−21,target date). All target-day games, including earlier doubleheaders, are excluded. Projection selects the first nine under starts DESC, last_start DESC, average_order ASC, batter ASC. **projected_order is selection rank, not expected batting slot.** Target-game postgame orders are never used to choose target players.

The raw source was ingested **2026-08-28 01:42:50.750447–02:25:36.201920 UTC**, after all2025 target cutoffs. No inspected source supplies a verified per-cutoff publication/revision history that would establish these exact corrected values were available pregame in2025. A historical event date earlier than the target is necessary but does not prove historical as-published availability. We cannot attribute this missing evidence to specific stat corrections, nor claim corrections actually occurred.

## Admission decision

**BLOCKED_LINEUP_FEATURE_LINEAGE** remains for pregame-certified lineup features. The numerical integrity blocker is resolved; the historical snapshot/provenance gate is not. No new lineup input contract was frozen and no lineup architecture trained. This is not a finding of leakage. Required next evidence: original population/source snapshot or independently archived, timestamped historical source revisions sufficient to certify each contributing value at its cutoff. No missing credential was guessed or external terms accepted.

The user-authorized continuation without lineup data was executed: a materially new nonparametric empirical period-run convolution was frozen in commit292dc45d and evaluated on the already-certified outcome export. It failed all eight development gates; see `MLB_PERIOD_EMPIRICAL_CONVOLUTION_V1_CLOSEOUT.md`. It is closed without rescue or parameter changes. This does not claim all possible architectures are exhausted.

## Reproduction and retained evidence

Read-only source queries: `audit_mlb_lineup_same_team_v1.sql`, `audit_mlb_lineup_raw_v1.sql`, `audit_mlb_lineup_prior_order_raw_v1.sql`. Do not run the large raw scan as routine CI. Compressed immutable exports `mlb_lineup_integrity_v1.projected.json.gz` and `.raw.json.gz` allow complete local replay without Supabase or provider access. Decompress and run `node scripts/research/reconcile_mlb_lineup_v1.mjs projected.json raw.json output-prefix`. SHA256 input/result checks and replay are enforced by the offline test. Raw-lineage MD5 values are audit identifiers, not security signatures.

Old failed replay and docs are retained as prior evidence; this document supersedes their unresolved-cause interpretation, not their counts. Queries were read-only, no exporter was opened, Odds API calls/credits0. No new public-line corpus was acquired during this integrity-focused block.

The full35,802-row selection/21-day comparison is also retained in `mlb_lineup_integrity_v1.selection.json.gz`, generated by `audit_mlb_lineup_selection_v1.sql`; it includes both stored and reconstructed fields plus exact contributing prior game IDs. Offline tests verify every membership/rank/date/stat comparison.

Validation:24 offline tests PASS in total; `npm.cmd run build` PASS, exit0,400 static pages with CI placeholder configuration. No production runtime endpoints were invoked for this audit.
