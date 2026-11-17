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
