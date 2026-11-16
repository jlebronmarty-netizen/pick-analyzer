# NBA GOAT — Flujo de datos útil para proyecciones (investigación, 2026–27)

**Estado:** propuesta de integración por etapas en PR #340. No modifica los modelos oficiales, cuotas congeladas, predicciones, evaluaciones ni crons de producción. Esta nota no autoriza una promoción a `main`.

## Diagnóstico verificado — 15 de noviembre de 2026

- `nba_goat_season_archive_v1`: 192 juegos finales con `player_stats` (5,323 filas jugador-partido); 190 `advanced_v2` validados; 2 `advanced_v2_unverified` sin registros. Los datos crudos están comprimidos en Storage privado y se indexan con SHA-256.
- `nba_game_context_v2`: solamente 30 juegos con `player_stats` en la tabla operativa y 22 juegos con alineaciones reales.
- `getNbaPropsProspectiveShadowReadiness` **lee `nba_game_context_v2`**, no los 192 juegos comprimidos. El modelo principal `nba-prediction-engine.service.ts` utiliza `team_stats`, precios, eventos y contexto de lesiones/alineaciones; **no incorpora automáticamente los archivos GOAT privados**. No atribuir a los modelos un uso que no consta.
- El cron actual `/api/cron/nba-current-era-shadow` cada media hora ya ejecuta extracción y procesos NBA (cuotas/contexto, históricos opt-in, diagnósticos, sombra). No duplicar estas funciones indiscriminadamente.

## Objetivo técnico

**Ingerir -> verificar -> archivar -> derivar variables cuantitativas -> comparar en SHADOW -> validar con holdout -> promover selectivamente.**

### Captura incremental por día (archivo separado)

Para automatización diaria en `goat-research`, se evaluaron dos tareas separadas (todavía **NO activadas**):

1. `nba-goat-core-daily-research`: 09:35 Puerto Rico, ventana de 10 días; solo juegos finales, boxscores y avanzado, máximo 10 juegos y 50 llamadas por ejecución.
2. `nba-goat-advanced-retry-research`: 16:45 Puerto Rico, solo respuestas `advanced_v2_unverified`, máximo 10 juegos y 50 llamadas por ejecución, con bloqueo único por día. Jamás etiquetar registros vacíos como completos.

**El manifiesto `vercel.json` se restauró exactamente a `main` después de que la suite de regresión detectó la modificación:** NO hay una nueva tarea GOAT diaria configurada por este PR. La lógica protegida puede ser invocada manualmente en `goat-research`, pero no se debe afirmar automatización futura hasta diseñar, activar y comprobar una vía autorizada y compatible con la protección de cron del repositorio. No asociar dominios públicos ni fusionar la rama solamente para activar la tarea.

### Incorporación correcta a proyecciones

El archivo crudo **no** debe consultarse completo para cada predicción: demasiadas lecturas de Storage y latencia. Crear una **tabla compacta de variables por jugador y partido**, derivada exclusivamente de archivos GOAT verificados (no de `advanced_v2_unverified`), con índice por (jugador, fecha de juego), sin JSON crudo ni cifras duplicadas.

Variables mínimas: identificadores de jugador, equipo, oponente y partido; hora real del juego, fecha y `captured_at`; minutos jugados; puntos, rebotes, asistencias, triples, robos, bloqueos, pérdidas; checksum de origen y versión de extracción.

Derivar bajo `decision_cutoff`: L5/L10/L20, minutos/uso, frecuencia de superar líneas, desviación típica, DNP/participación, desempeño local/visitante y contexto del oponente. Rechazar cualquier estadística de un juego aún no finalizado o con datos recibidos después del corte de decisión. Distinguir una simulación retrospectiva (datos reconstruidos después) de evidencia realmente disponible en tiempo real.

`projected_lineups` y lesiones capturadas **antes** del inicio son variables pregame. Los titulares reales, advanced del mismo partido y resultados finales solo pueden usarse para evaluar una proyección posterior al juego; nunca para predecir ese mismo partido.

### Experimento de modelos

- Player props: puntos, rebotes, asistencias, triples, PRA y combinados *solo después* de verificar su contrato FanDuel; score por jugador a partir de tendencia, rol, minutos, rival, lesiones pregame y línea/odds disponible.
- Mercados ML/spread/total: usar perfiles de ritmo, eficiencia ajustada y rotaciones solamente como variables candidatas en un modelo experimental separado, sin sobrescribir pesos/parametros actuales.
- Guardar predicción prepartido con fecha/hora, versión, entradas y cuotas reales; compararla con resultados después del encuentro.
- Medir error absoluto, calibración de probabilidades, acierto, rendimiento por línea/cuota, ROI con intervalos de confianza, cobertura y cambios contra baseline usando evaluación temporal y holdout nunca usado para seleccionar parámetros.
- No asumir que más estadísticas automáticamente mejora accuracy; descartar variables sin mejora replicable.
- Solo tras validación y **aprobación humana explícita** activar entradas nuevas del modelo de producción con feature flag, logging, monitoreo y rollback.

## Límites y seguridad

- Distinguir Storage privado (archivo histórico duradero) y disco de Postgres (tabla operativa compacta).
- Mantener Spend Cap, revisar costes GOAT/Vercel/Supabase y cotas de llamadas. No crear cron adicional de producción sin revisión de los crons existentes.
- Preservar evidencia de Opening/Closing odds, cuotas y decisiones congeladas, modelos antiguos y resultados para permitir backtests.
- Supabase Database Backups no respalda el contenido binario de Storage; organizar copia separada/restaurable de estos .json.gz.
- La rama PR #340 aún no implica ni tarea activa confirmada ni modelo oficial actualizado.

**Criterios para considerar completa la conexión:**
(1) schedule activo y observado al menos dos días con registro de cobertura; (2) tabla compacta actualizada y con validación de SHA/filas; (3) experimentos shadow usando esa tabla, no simplemente indicando Storage; (4) prueba de corte pregame sin leakage; (5) comparativa contra baseline y reporte de mejora/retroceso; (6) promoción deliberada tras autorización, nunca implícita.

## Avance de integración compacta
- Nueva tabla privada `nba_goat_player_game_research_v1` para filas de hechos de jugador, sin JSON original, RLS habilitado y solamente service-role. Aplicada como migración aditiva; permanece vacía hasta ejecutar la importación protegida.
- `src/lib/nba/goat-research-compact-core.mjs` valida identidad, fechas, minutos, DNP y checksum de origen.
- La página de investigación `/api/nba/goat/materialize-props-research` importa secuencialmente hasta 10 juegos verificados por solicitud, sin escribir en Official Picks, modelos ni tablas operativas. Los datos se conservan en Storage y solamente métricas compactas se escriben en la nueva tabla.
- La preparación de props de rama `goat-research` usa esa tabla y conserva los gates de `source_captured_at <= quote.source_received_at` y juego anterior al cutoff. L5/L10/L20 son descriptivos; no implican probabilidades calibradas ni producción.
- La importación no se realiza mediante `GET` y requiere acción autenticada del dueño en la página protegida. No afirmar que los 5,323 registros estén materializados hasta verificar la tabla real.
