# Pick Analyzer multideporte — auditoría de solo lectura (17 noviembre 2026)

**No reemplaza los modelos ni constituye certificación de operación completa.** Consultas observacionales en el proyecto Supabase Pick Analyzer. `main`, NBA/GOAT, MLB pausado, NHL y cronjobs permanecen intactos. No alteramos resultados, predicciones, esquemas, fuentes de datos ni despliegues.

## NCAAB: evaluación operativa
- `ncaab_daily_runs_v1`: **58** ejecuciones y **58 PASS**; la última inició 2026-11-17 22:00 UTC.
- `ncaab_daily_predictions_v1`: **729** pronósticos únicos (cero eventos duplicados), todos con `created_at < scheduled_at`.
- `ncaab_daily_outcomes_v1`: **616** resultados únicos, todos emparejados con una predicción dentro del conjunto inspeccionado.
- En **616 pronósticos NCAAB_PRESEASON_V1 liquidados**: 484 selecciones ML acertadas (**78.57%**), Brier home probability **0.1922**, error absoluto medio de margen **13.069** puntos, de total **14.446** puntos. Esta cohorte operacional no equivale a un backtest histórico ni establece ROI/edge. No comparar sin controles con otras temporadas/modelos.
- `ncaab_causal_diagnostics_v1`: 616 diagnósticos de hipótesis; **60 HIGH** y **556 LOW** en calidad de evidencia; esto NO implica efecto causal probado.
- `ncaab_game_context_v2`: **60** partidos; `ncaab_opponent_matchups_v3`: **1,855** observaciones, **60** partidos.
- **5 casos con ausencia de final >8h tras el horario original** identificados. Fuentes primarias documentan eventos cancelados o aplazados/reprogramados, así que NO son cinco resultados FINAL extraviados:
  1. `espn:401924720`, Cornell–UNC Greensboro (Nov 14): aplazado sin fecha confirmada. [Cornell Athletics](https://cornellbigred.com/news/2026/11/13/cornell-unc-greensboro-mens-basketball-game-postponed.aspx).
  2. `espn:401917529`, Pacific–Air Force (Nov 14): aplazado/reprogramado al 15 de noviembre; nuevo partido Pacific 93–Air Force 69. **No reutilizar el final sobre la identidad vieja sin reconciliación segura.** [Air Force reschedule](https://goairforcefalcons.com/news/2026/11/14/mens-basketball-air-force-pacific-mbb-game-rescheduled-for-sunday) y [resultado nuevo](https://goairforcefalcons.com/game-center/27068).
  3. `espn:401921760`, Utah–Washington (Nov 14): aplazado al 5 de diciembre, horario por definir. [Utah Athletics](https://utahutes.com/news/2026/11/14/utah-mens-basketball-versus-washington-postponed-to-dec-5).
  4. `espn:401926073`, Oregon–Pepperdine (Nov 15): aplazado, por reprogramar. [Oregon Athletics](https://goducks.com/news/2026/11/14/mens-basketball-game-against-pepperdine-postponed).
  5. `espn:401926143`, North Dakota–SIU Edwardsville (Nov 16): reprogramado al 17 de noviembre, 7 pm CT. [North Dakota Athletics](https://fightinghawks.com/news/2026/11/14/mens-basketball-und-siue-mens-basketball-game-moved-to-tuesday.aspx).
- **Acción pendiente**: auditar explícitamente ciclo de vida (POSTPONED/RESCHEDULED/CANCELLED/FINAL), detectar cambios de ID o fecha, separar de `overdue_final`, preservar las decisiones congeladas y sus fuentes, no copiar resultados entre IDs ni computar un aplazamiento como L, no inventar scores. Reconciliar solo con identidad, equipo, liga, horario y fuente oficial confirmada; revalidar en Preview y pruebas antes de producción. No se ha implementado esta corrección.

## Siguientes deportes: inventario inicial, aún no certificados

| Deporte | Evidencia observable en base | Limitaciones |
| --- | --- | --- |
| NCAAF | 324 diagnósticos: 103 ML con resultado W/L (65 W, 38 L), 103 registros de margen, 103 de total; 5 casos DISPUTE representados en cada mercado. 108 juegos de contexto, 8,949 observaciones jugador-rival. | **No equiparar los 65/103 de diagnósticos al accuracy del modelo completo.** Resolver 5 disputas y auditar colecciones originales. |
| Soccer | 18 diagnósticos: 9 1X2 (5 W/4 L) y 9 totals 2.5 (5 W/4 L). 9 juegos de contexto, 410 jugador-rival. | Muestra demasiado pequeña; auditar ligas, resultados y cron. |
| Table Tennis | 66 diagnósticos: 22 ML (12 W/10 L), 22 odd/even sets (12 W/10 L), 22 total points numérico. 22 enfrentamientos H2H. | Datos insuficientes para validar, comprobar disponibilidad de fuente y settlement, no equiparar métricas. |
| NFL (separado de NCAAF) | `free_sports_runs_v1`: 43/43 OK; 32 forecasts, 14 resultados asociados, última ejecución observada 2026-11-17. | Requiere auditoría propia de pendientes, identidad y schedule. |
| ATP | 8 runs históricos: 6 OK, 2 ERROR; no forecasts en `free_sports_forecasts_v1` de ATP. | Revisar fuente/eventos y calendario; no asumir operación completa. |
| BSN | 8 runs: 4 OK, 4 ERROR; sin forecasts en tabla `free_sports_forecasts_v1`. | Revisar fuera de temporada y no correr colecciones pagas. |

### Advertencia sobre fuentes antiguas
`prediction_history` conserva filas legadas con fechas viejas; por ejemplo NCAAF 122 `pending` con última creación en julio 2026 y EPL 20 `pending` con última creación en junio 2026. No tomarlas como predicciones de la jornada ni compararlas con nuevos diagnósticos.

## Criterios para continuar
1. NCAAB: clasificar cinco aplazamientos y diferenciar `PENDING_FINAL` de `POSTPONED/RESCHEDULED`; no modificar evidencia inmutable ni marcar pérdidas o aciertos sin juego definitivo.
2. NCAAB: evaluar estabilidad temporal del 78.57%, Brier/calibración, extremos de probabilidad, intervalos de confianza y fuentes gratuitas, y estudiar candidatos por mercado en SHADOW.
3. NCAAF: inspeccionar cinco casos `DISPUTE`, verificar el origen del score, mercados ML/spread/total y las predicciones congeladas; validar exactitud en la muestra emparejada correcta.
4. Soccer y TT: inspeccionar salud de los crons, fuentes, mercados, cuotas disponibles, exactitud y reglas de settlement. Optar por PASS cuando la integridad no está acreditada.
5. Conservar NBA/GOAT y NHL en sus flujos existentes y MLB cerrado. Sin suscripciones adicionales ni cambios a `main` sin pruebas y autorización de release.

**Estado:** auditoría de datos y fuentes completada parcialmente; toda mutación correctiva o deployment permanece pendiente de implementación y verificación.

## Existing reconciliation guard found in code history

The Nov 10 NCAAB settlement repair (`c8fd2748396457f1ffb74015a412b925b84b2dcd`) explicitly allows only exact ESPN event identity, equal unordered pair of teams and scheduling drift <=2h (with home-away normalization). Longer postponements cannot be automatically settled by that rule. That is a **correct safety guard** against mismatched games, not evidence of broken ordinary FINAL reconciliation. Proposed status-handling repair must retain it and add separate explicit POSTPONED/RESCHEDULED classification; never silently raise the time-shift tolerance, overwrite locked forecasts or attribute a rescheduled game's final to an older event.

Further checks should prove exact event status and canonical mapping before introducing a new terminal status, with dedicated tests for no-score and schedule-drift cases.

## Follow-up: strict NCAAB scoring and NCAAF disputes

The SQL audit committed at `sql/research/ncaab_verified_accuracy_audit_20261117.sql` was fetched back from GitHub and executed in read-only mode against the Pick Analyzer database. It returned 611 verified paired matches, 480 winner calls correct (78.560%), Brier 0.1912, margin MAE 13.031, total MAE 14.482. On those 611, average forecast home probability 0.5876 versus observed home win frequency 0.7578. This is an **observed calibration discrepancy** deserving time-split and cohort audit; it must not trigger automatic correction, as selection and coverage may be nonrandom.

All 616 initial NCAAB matched rows: 606 identical home/away orientation, 9 home-away swapped, one conflict in at least one participating team ID. Five fixtures had scheduled start drift >2 hours: four otherwise same team orientation, one an identity conflict. Exclude the latter five from the verified metrics, retain immutable source evidence, and do not silently settle or fix source data. The prior naive score (484/616) should not be used as the verified headline despite its numerically similar percentage.

NCAAF has 5 distinct `DISPUTE` game IDs (15 market-level diagnostic rows: ML, margin, total). Stored ESPN summaries list these games as FINAL, with these scoreboards:
- `espn:401856886` Mississippi State 9–Auburn 41
- `espn:401858521` Michigan State 14–Washington 21
- `espn:401860917` Washington State 73–Colorado State 7
- `espn:401862826` Tulsa 38–Florida Atlantic 21
- `espn:401862828` Rice 17–Tulane 20

**Important:** A final scoreboard in `ncaaf_game_context_v2` is not sufficient evidence to override `DISPUTE`: need to verify forecast ID, participants, orientation, schedule, source versions, and contradictory captured finals before computing settlement. All five still require reconciliation; no rows were edited or backfilled.

Status: SQL audit verified; GitHub documentation only in isolated research branch. No changes to production, prediction engines, cron, frozen decisions, or model promotions.

## 17 Nov follow-up: implementation prepared in isolated research branch, **not deployed**

### NCAAB postponed/rescheduled review

- `src/lib/ncaab-unsettled-lifecycle-research.mjs`: pure, read-only classification. Explicit `REVIEW_POSTPONED`, `REVIEW_RESCHEDULED`, `REVIEW_CANCELLED`, `REVIEW_SOURCE_CONFLICT`, `PENDING_FINAL`, `REVIEW_FINAL_EXISTING_RECONCILER` statuses. Never grades, never changes probabilities, and never overwrites a frozen forecast.
- `sql/research/ncaab_unsettled_lifecycle_triage_v0.sql` fetched back from GitHub and executed as read-only in Supabase. Its **five** overdue historical cases were classified: 3 POSTPONED (Cornell–UNC Greensboro, Pacific–Air Force, Oregon–Pepperdine) and 2 RESCHEDULED (Utah–Washington; North Dakota–SIU Edwardsville). These are provider-snapshot classifications of original event IDs, **not** claims about whether separate newly scheduled event IDs were played. The existing two-hour immutable settlement guard is not weakened.

### NCAAF dispute root cause and safe triage

- All five disputed event IDs retained frozen team identities and neutral-site flags in the stored final evidence, with two captured schedule variants per event. Original `ncaafOutcome` in `src/lib/edge-lab/ncaaf-ppg.mjs` requires exact kickoff equality; all five stored `DISPUTE` reasons are `EVENT_CONTRACT_CHANGED`.
- Read-only `sql/research/ncaaf_disputed_finals_triage_v0.sql` fetched back and executed. All five have 5–6 final captures with one score and venue; **two are RESEARCH REVIEW_CANDIDATE** for a 15-minute and a 75-minute kickoff shift (`espn:401860917`, `espn:401858521`), and **three MANUAL_REVIEW** for 150–255-minute shifts. Repeated ESPN captures do not count as independent news providers or certify sportsbook settlement.
- `src/lib/edge-lab/ncaaf-dispute-review-research.mjs` isolates same ID/team/venue/season/timestamp and contradictory-FINAL guards. Its result is `gradeAllowed:false`, `databaseWriteAllowed:false`, `officialPick:false` even for review candidates. **No existing `DISPUTE` row was changed**. A later dedicated, tested production reconciliation path is required if approved.

### NCAAB calibration research: clear tradeoff, no automatic model promotion

- The exact SQL `sql/research/ncaab_asof_calibration_candidate_v0.sql` was fetched back and executed (538 as-of-eligible, identity-verified games). Baseline home-probability Brier **0.19383**, log loss **0.57662**, 416/538 correct ML sides. Blindly shifting all probabilities by historical home bias reduced Brier to **0.16915**, log loss to **0.51520**, but lost eight directional wins (408/538). **Reject all-sides correction** for a selection-accuracy-focused model.
- After analyzing that overlap, tested *post-hoc* constrained adjustment keeping model's selected side: Brier **0.16570**, log loss **0.50810**, 416/538 directional wins. It still worsened later-cohort away-favorite probabilities.
- New additional post-hoc candidate adjusts **only original home favorites**, leaving away-favorite probabilities and the actual winner selection unchanged: exact reproducible `sql/research/ncaab_home_favorite_calibration_v1.sql`, verified against Supabase: **Brier 0.16525**, **log loss 0.50715**, still **416/538** directional hits. It uses previously observed official finals before each forecast and fixed research shrinkage of `n/(n+100)`, minimum 50 prior games; it does not use same-game result as a feature. This is NOT preregistered or an untouched holdout, and there is no proved ROI or sportsbook quote edge. Do not claim validated accuracy uplift (directional accuracy is unchanged).
- A simple naive independent-observations CI on the paired Brier improvement is not a certified interval (matches are temporally clustered and multiple candidate formulas were investigated). Fix the candidate now, then evaluate its **future** frozen forecasts on a separated untouched cohort with properly timed evidence, directional wins, Brier, log loss, calibration and real-quote EV before any promotion. Do not write calibrated probabilities back to official tables.

### Tests and verification

- `tests/multisport-ncaab-ncaaf-lifecycle-research.test.mjs`: **nine local Node.js tests passed**, exercising postponed, rescheduled, status review, identity conflict, score conflict and time cutoffs. Local tested source files and committed files have identical Git blob hashes (NCAAB `883d67a20d26a60f73903ac7da7750d166e3b5b9`, NCAAF `12cf34c31ed51e7edf2fcd39a57d8749c887418f`, tests `13d0bbb1e4ff9661d6d5582f80a395e0529f8a6a`). This is a **module test**, not a full TypeScript build, integration test, or production deployment.
- Main branch, database, crons, provider billing and existing model outputs untouched. Do not merge until integrated against full NCAAB/NCAAF services, CI checked and appropriate deployment validation completed.

## TT follow-up: proven code-scope defect, draft fix only (17 Nov 2026)

Read-only database audit of `edge_lab_multi_runs_v1` found Table Tennis with 23 FAILED, 17 PARTIAL and 1 BLOCKED recorded runs; latest at 2026-11-18 00:20 UTC shows FAILED despite `forecasts_inserted=54`, `outcomes_inserted=12`, `prematch_coverage.verified=true`, and populated `status_counts` plus `summary.skipped`. Across forecasts, 267 overdue market rows had no result associated at the time of the audit (NOT necessarily 267 distinct events). Failure error was sanitized as `MULTISPORT_OPERATION_FAILED`.

**Root-cause from code** in `src/services/edge-lab-multi.service.mjs`: within `collectTt`, `const forecasts=ttForecasts(...)` was declared inside the `try` for pre-match, but after that `try/catch` the code evaluated `if(forecasts.skipped.length)`, where `forecasts` is out of scope. After a successful prematch capture that reaches status_counts and exits the block, this raises ReferenceError, which matches the observed repeated post-capture FAILED stage. The fix is **one line in the research branch only**, replacing the reference with the already saved `summary.skipped?.length`. It changes no formulas, supplier calls, budgets, database schema or other sports; `main` is untouched.

A source-level comparison against the committed GitHub blob verified that the invalid reference was absent, the safe reference present, and `summary.skipped=forecasts.skipped` still assigned in the capture `try`. `tests/tt-prematch-scope-regression.test.mjs` contains targeted regression assertions; it has NOT been run in a full CI workspace here. Do not claim TT fixed live until these and existing sport regressions pass and the authorized deployment's next provider-free health checks plus normal scheduled cycle show a valid `SUCCESS` or justified `PARTIAL` run and overdue settlements decrease. Never trigger paid retrieval just to verify this fix.

No production deployment or database mutation occurred in this investigation.

## Final additional read-only check: Soccer (18 Nov UTC)

The separate `edge_lab_runs_v1` collector is active: 625 `SUCCESS`, 4 `PARTIAL`; latest `SUCCESS` 2026-11-18 01:15 UTC. Soccer has 40 forecast-market rows, 18 associated results (10 W / 8 L across its 1X2 and Total 2.5 markets), and **0 overdue (>12h) non-ABSTAIN forecast-market rows**. These correspond to only nine settled games in the causal diagnostic tables, so not enough data to validate performance or profitability. Soccer remains **operational for observed ingestion/settlement, limited historical coverage**; no production changes.

Priority across remaining sports after these checks:
1. Restore Table Tennis collector from verified one-line scope fix on isolated branch, subject to full regression/preview/release approval. Audit 267 market-level overdue rows, and review provider allowance before any live fetch.
2. NCAAB/NCAAF classification integration and validation gates; avoid changing frozen official results on uncertain identities and changed schedules.
3. Soccer: widen source coverage/competition support only with verified free sources and timestamped contracts; do not treat nine games as enough to refit.
4. MLB remains paused; NBA and NHL unchanged.

No new source-provider calls or deployed changes were made to collect these findings.
