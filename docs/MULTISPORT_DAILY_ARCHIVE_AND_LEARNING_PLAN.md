# Pick Analyzer — Archivo diario multideporte y aprendizaje verificable

**Fecha de auditoría:** 17 noviembre 2026. **Estado:** primer diagnóstico read-only y propuesta de arquitectura; NO habilita nuevos crons, cuotas pagas, cambios de modelos, alteraciones de `main` o producción. Independiente del PR #340 (GOAT NBA).

## Objetivo
Conservar los hechos y las decisiones de cada deporte todos los días y convertirlos en variables que puedan evaluarse para pronosticar resultados **futuros**. Un archivo no implica un modelo mejor: requiere validación y cortes de tiempo.

**Flujo universal:** fuente con timestamp → identidad deporte/liga/temporada → crudo inmutable versionado → índices compactos → cuota y predicción congeladas *antes* del inicio → resultado final/settlement verificado → comparación contra baseline → fórmula shadow → holdout futuro → promoción manual.

Guardar por evento: deporte, liga, temporada, IDs de proveedor e internos, participantes, fecha UTC y local, fuente/license, instante de recepción y del hecho, versión, hash, estado de cobertura, raw pointer privado, fechas de actualización/corrección y validación. Por predicción: fórmula y parámetros, cutoff, features que sí estaban disponibles, cuota y book/mercado contractual real, decisión PASS/PLAY, resultado, errores y calibración. No convertir datos descargados después del partido en evidencia disponible antes del partido.

## Evidencia que existe hoy en el repositorio o base

| Deporte/cohorte | Fuente/captura verificada | Riesgo/pendiente |
|---|---|---|
| NBA | `/api/cron/nba-current-era-shadow` cada 30 min; `nba_market_schedules_v1` 1,080 snapshots con último 17 Nov 23:00 UTC; odds, contextos y resultados en otros registros. Investigación GOAT: 192 juegos/5,323 filas hasta Nov 15 | **GOAT archive y tabla compacta NO se alimentan solos**; avance de `nba_game_context_v2` separado de investigación. No duplicar cuota/schedules activos |
| NHL | `/api/cron/nhl-free` 2× por hora. `nhl_free_runs_v1` 638 ejecuciones hasta 17 Nov 23:07 UTC y archivos `nhl_free_source_v1` con raw gzip | Comprobar cobertura por partido y liquidación, no confundir ejecuciones con partidos; enriquecimiento parcial/bounded |
| NCAAB | `/api/cron/ncaab-daily` 4× al día; `ncaab_daily_runs_v1` 58 ejecuciones hasta 17 Nov 22:00 UTC; fuente ESPN en `ncaab_daily_source_v1` | Comprobar juego por juego los finales y datos por jugador antes de ampliar props |
| NFL / BSN | `/api/cron/free-sports` 6× al día, servicio `free_sports_runs_v1`; NFL usa fuente `nflverse`, BSN depende de eventos ya archivados | No atribuir a ambos cobertura plena por tener cron; revisar fuente real y calendario estacional |
| Soccer, tenis y tenis de mesa | Manifest de Vercel incluye `edge-lab-soccer`, `edge-lab-sports`, `tennis-source`, pero faltan evidencias homogéneas en `sports_sync_jobs` | Auditar tablas especializadas y funcionamiento antes de declarar archivo diario operacional |
| NCAAF | Datos históricos/research existen; verificar capturador incremental independiente y calendario | No asumir fuente diaria ni precios FanDuel |
| UFC | Manifest incluye `ufc-free` | Verificar capturas/resultado por evento, no inventar calendario diario si no hay peleas |
| MLB | Archivo y tablas de investigación extensas, pero usuario decidió **pausar la temporada 2026** hasta MLB 2027 | NO reactivar ingest/cron o subscripciones fuera de temporada. Conservar histórico y backups |

Nota: `sport_events`, `prediction_history`, `sports_odds_snapshots` son solamente parte del ecosistema; varias ligas utilizan tablas separadas. No tomar una tabla vacía o antigua como prueba de que una liga no se está capturando. Se requiere un inventario completo de fuentes y observaciones por liga.

## Contrato del archivo diario (diseño)

Para cada liga habilitada:
1. **Pregame:** calendario, participantes, cuotas con líneas reales, estado de lesiones/lineups y tiempo de captura (si las fuentes libres o GOAT lo ofrecen); almacenar snapshots con versionado y deduplicación por fuente/evento/contrato/hora, sin sobrescribir la primera cotización.
2. **Postgame:** resultado final oficial, boxscore/statlines, goalie/pitcher/starters reales, event/PBP si existe licencia, correcciones tardías; verificar ID, final y consistencia.
3. **Research compacto:** filas por evento-equipo o evento-jugador para cálculo de L5/L10/L20, ritmo, eficiencia, descanso, tendencias, oponentes y splits. El corte de predicción usa `source_captured_at<=decision_at` y juego anterior a la decisión.
4. **Evaluación:** MAE, RMSE, Brier/calibración, acertados, cobertura y ROI únicamente cuando el contrato, la cuota y settlement son verificables. Agrupar intervalos por partido/fecha; distinguir backtest reconstruido versus predicción emitida antes del partido.
5. **Retención:** conservar raws comprimidos y hashes en Storage privado cuando sea razonable, índices/facts compactos en PostgreSQL, evidencias originales de decisiones para replicación, backup separado de Storage, alertas por falta de captura y cotas por fuente. No borrar histórico ni activar servicios pagos sin aprobación.

## Rollout sin riesgo y sin duplicación

- **Fase 0 / ahora:** read-only inventory de estado de fuentes, latencia y cobertura, sin llamadas externas nuevas. Script `scripts/research/multisport-daily-archive-health.mjs`; default dry-run, `--execute` lee Supabase únicamente.
- **Fase 1 / NBA:** conectar la captura GOAT diaria al archivo/investigación y corregir reconciliación incremental, con cuotas de llamadas, sin afectar cron oficial ni predicciones. Prioridad porque el archivo GOAT está estancado el 15 Nov. Reutilizar el collector activo en lo posible; no re-descargar 192 partidos.
- **Fase 2 / NHL:** certificar archivo raw final, estadísticas de porteros/equipos, market snapshot, congelación y settlement; ampliar únicamente lagunas.
- **Fase 3 / NCAAB + NFL + NCAAF:** fuente por liga, crudos, reconciliación y coherencia temporal; mantener restricciones de gasto.
- **Fase 4 / Soccer, tenis, tenis de mesa, BSN, UFC:** rastrear fuentes gratis realmente operativas antes de alimentar modelos.
- **MLB:** mantener estado pausa hasta el inicio oficial 2027; entonces reactivar según la tarea/plan aprobada.

**No crear un segundo cron** para una fuente que ya captura. Reutilizar cron actual/servicio y añadir un archivador privado idempotente, después de revisar timeouts. Captura daily puede ser hora por evento (en vivo o 1-2 días después de final) según deporte, no necesariamente 1 petición por liga al día.

### Definition of done por liga
1. Lista completa de juegos/participantes de la jornada con timestamps, fuente y estado.
2. Datos previos al inicio congelados (cuando disponibles); raw e índice con hash/tamaño.
3. Final verificado con cobertura por juego y ausencia de casos pendientes de settlement sin seguimiento.
4. Features compactas actualizadas sin leakage.
5. Última ejecución exitosa y primer juego nuevo revisados durante al menos dos días reales.
6. Resultados y exactitud separados por mercado con volumen de muestra, cohortes y decisiones originales.
7. Alertas por falta de captura y backup/restauración comprobada.
8. Habilitación de modelo oficial solo tras validación futura y autorización explícita.

**Coste:** mantener Spend Cap ON; usar fuentes gratis para otros deportes, NBA GOAT existente; excluir nuevas suscripciones; controles de requests, Storage y PostgreSQL. No reactivar MLB ahora.

**Limitación de este PR:** agrega únicamente diagnóstico de lectura y diseño; no habilita la captura diaria de nuevas fuentes ni modifica ninguna fuente o modelo existente.
