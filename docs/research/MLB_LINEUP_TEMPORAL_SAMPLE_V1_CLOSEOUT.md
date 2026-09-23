# Lineup temporal lineage: stratified sample V1

Status: **BLOCKED_LINEUP_FEATURE_LINEAGE**. Audit baseline PR187/a37fe5a7; canonical Supabase ynuocvexviorgdjrfthw. No lineup training, certified input contract, external opening, provider acquisition, Odds credits or production writes.

## Sample and admission result

A deterministic first-stage sample contains **8 games and144 projected batter records**. Only this sample was evaluated for temporal admission. Existing compressed exports from the completed numerical reconciliation supplied contribution IDs and ingestion bounds; no new full-season raw scan was made.

| Stratum | Game PKs | Dates |
|---|---|---|
| Early stored coverage |778485,778486|2025-04-01|
| Mid-season |777491,777492|2025-06-15|
| Late stored coverage |776521,776522|2025-08-31|
| Extreme PA30d |776669|2025-08-20; maximum138|
| Extreme HR30d |777356|2025-06-26; maximum15|

Early/mid/late each select two games deterministically by date/gamePK. Extremes select the highest stored PA/HR, breaking ties by gamePK/batter. These are input stress cases, **not claims of predictive feature importance**. August31 is the end of the stored projected coverage, not the end of the MLB season.

**0/144 records pass A, B or C.** Every contributing stored raw input in the sample has ingestion bounds later than the target game. Recorded raw source version is baseball-savant-statcast-2025-original; original projected builder SHA and feature_version are unknown and explicitly null. The numerical equivalence found previously does not fill those fields.

Late-lineup-change sampling is **uncovered**, not fabricated: no timestamped2025 revision sequence identifies announcements and late replacements. The only27 MLB sport_lineups rows found are2026 SportsDataIO probable/expected records sharing one timestamp. Retrosheet substitutions and observed target batting order are postgame evidence; they cannot identify a verified late pregame change. No target-game order was used as a feature.

Every sample row in `artifacts/research/mlb_lineup_lineage_sample_v1.result.json` includes gamePK/date, team/batter, archived scheduled_at, T-60 and T-30 diagnostic cutoffs, source ingestion timestamps and contribution digests, source version, unknown original builder/feature versions, reconstruction SHA, A/B/C flags and failure reasons. Source timestamp fields are explicitly ingestion bounds; upstream publication timestamps are absent. Actual first pitch is unknown, not substituted with scheduled_at.

## Search in requested order

1. **Git.** Complete local reachable history is not shallow. Root26a4493a is dated2026-06-21; first matching projected-table code is the September2026 audit, not the population implementation. Projected DDL migration20260917230325 is the only stored migration referencing that table. Authoritative upstream helper migration20260915203807 was preserved by the prior audit. Schema/source lineage does not recover an original2025 builder SHA. Retrosheet feature-store commit2663e4f8 dates2026-07-23; source code lines598–602 constructs source_timestamps from targetGameDate/cutoffTimestamp/maximumAllowedSourceDate. Those fields describe a replay rule, not provider publication.
2. **Actions/artifacts/logs/caches.** API returns0 runs before2025-09-01. All91 runs in the September17–18 builder investigation window were inventoried. Selected adjacent runs35287568950,35300352645,35344086990 have0 retained uploaded artifacts. Run35287568950 job105423190567 logs show a2026-09-17 execution generating sportsbook V17 SQL/summary into Git commit7aadc1f; this is not a lineup capture. Global artifact/cache listing endpoints are unavailable through the connected API wrapper; no gh executable was found. These inaccessible surfaces are **unknown**, not empty. Checked local workflows have no explicit cache actions storing lineup snapshots. Later uploads could contain imported archives, but no qualifying original archive was recovered; execution timestamps alone would not certify imported inputs.
3. **Supabase.** Snapshot, raw, staging/history/audit schemas and stored source/version/timestamp columns were inspected. historical_feature_snapshots has131,426 rows first created2026-07-14;59,624 pre-September2025 as-of rows are Retrosheet historical replay version1 first created2026-07-24. Their source_timestamps hold cutoff rules, not original capture timestamps. pick2_feature_snapshots has127,208 rows first created2026-08-30; the2025 domains use MLB_DATA_01D_2025_PREGAME_FEATURE_DRY_RUN_V1 with retrospectively assigned as_of values. These current snapshots do not satisfy A/C. Ten mlb_context_snapshots begin August2026. Historical baseball lineup76,135 rows were imported July2026 and sampled lineage labels them postgameKnown/pregameEligible=false. Retrosheet raw records imported July2026 similarly do not establish historical publication timing; unrelated market rows are not lineup evidence. Storage has219 objects, earliest creation September2026, with no names matching lineup/statcast/2025/snapshot in the bounded catalog query. Raw table has no custom immutability trigger; this alone does not prove historical updates occurred. No suitable forgotten staging/version archive was found in the inspected schema.
4. **Vercel.** Deployment query before2025-09-01 returns0. Historical runtime requests fail: broad query400, narrowed April1 query specifically ExceedsBillingLimitError. This is a service-access/billing boundary, **not evidence of absent cron logs**. No plan change or spending attempted. Later deployment SHAs cannot establish code execution before2025 games. This access limit is retained separately from the input-lineage failure.
5. **Raw upstream.** Existing source data was imported August2026. A bounded1000-row prior-April2025 raw sample contains0 populated sv_id/tfs_zulu_deprecated and0 captured_at/published_at/source_timestamp keys. No immutable historical publication receipts or revision series were recovered. Event dates alone are not timestamps proving field-version availability. No external upstream calls were made; no license or spending boundary crossed.

## Schedule and cutoff limitation

The eight exact gamePKs resolve to stored `mlb_totals_v11d_schedule_2025_v1`. It is explicitly **MLB_STATS_API_SCHEDULE_FINAL_RECORD**, fetched2026-09-17. T-60/T-30 values are therefore diagnostic calculations from a retrospectively stored schedule, **not certified original schedule snapshots or actual first pitch**. Both timing gaps remain visible. All sampled raw ingestion timestamps occur in2026, so choosing T-30 instead of T-60 cannot cure the failure; no cutoff fishing was done.

## Gates and continuation

- A: no timestamp-verified original pregame feature snapshot.
- B: no immutable per-input historical publication/revision timestamp at or before the cutoff.
- C: no original builder/source snapshot proving its accessible row versions at the historical cutoff. Date-filter logic proves event-time exclusion, not historical availability.

Do not infer leakage or silent correction from this failure. Preserve the prior arithmetic result:13 integer features100% and EV rounding <=7.28e-12. **Do not expand certification to full2025 or historical2026 after this sample failure.** No lineup-feature contract was certified.

The permitted nonlineup continuation was executed: sequential Bayesian expert mixture, frozen07728a35 before evaluation, updates mixture weights using only prior-day historical development labels of frozen Poisson/QDA/empirical forecasts. All8 ML/3way gates failed; details in `MLB_PERIOD_BAYESIAN_MIXTURE_V1_CLOSEOUT.md`. Source models were not refit, thresholds unchanged, external closed.

Next input needed is an original immutable archive with independently verifiable pregame timestamps and exact source/builder version, or equivalent versioned raw publication receipts. Missing Vercel paid log access is not a reason to spend: it would still need to contain actual qualifying evidence. No claim that every possible architecture has been exhausted.

## Reproduce

Run `node scripts/research/audit_mlb_lineup_temporal_sample_v1.mjs` using committed schedule evidence and prior compressed exports. The test verifies exact sample output, all144 temporal failures, missing strata and no full-season expansion. Separate evidence JSON preserves query readbacks; the old numerical artifacts remain immutable. No secret or raw runtime log dump is committed.

Follow-through on remote history: fetched the exact historical Actions head49ee84a8 into FETCH_HEAD without checking it out. Its tree and reachable code history also have zero projected-table/starts_21d builder hits. Adjacent V11-A/V11-B commits and the V17 builder all date September2026. The91-run inventory and sanitized job observations are preserved in `mlb_lineup_lineage_sample_v1.github.json`; no external-result artifacts were opened.

Validation:29 offline tests PASS; `npm.cmd run build` exit0,400 static pages with CI placeholder configuration. Source production modules, tracker and prior frozen artifacts are unchanged.
