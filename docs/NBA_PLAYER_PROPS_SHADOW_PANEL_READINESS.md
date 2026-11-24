# NBA Player Props — panel descriptivo SHADOW

**17 Nov 2026 · PR #351 · draft / no producción**.

## Diagnóstico
La ruta `/nba` redirige a `/nba-market-data`. El tablero de cuotas ya permite elegir puntos/rebotes/asistencias/triples, pero `model-report.jsx` solo muestra pronósticos GOAT de moneyline/spread/total. Las cuotas de props NO constituyen proyecciones ni apuestas calificadas.

## Implementación de investigación
- Botones de acceso rápido a props en `src/app/nba-market-data/board.jsx`.
- `props-shadow-panel.jsx` muestra columnas de jugador, línea y precio **archivados**, medias L5/L10 (si realmente completas), proyección descriptiva y diferencia contra la línea, muestra y hora de captura.
- `/api/market-data/nba/props-shadow?game_id=...`: solo GET privado de la misma instancia autenticada de Vercel; **no llama a GOAT**; reutiliza calendario GOAT guardado, `nba_market_quotes_v1` y `nba_goat_player_game_research_v1`. No escribe tablas.
- `nba-props-panel-core.mjs`: filas con cinco partidos capturados antes de la cuota usan media L5, con diez o más media L10. Histórico inferior a cinco = `INSUFFICIENT_CAPTURED_PRIOR_GAMES`, sin proyección inventada. No aplica las hipótesis V3 a producción ni declara que las fórmulas estén certificadas.
- Rechaza partido no programado o iniciado/menos de diez minutos antes; cuota de más de treinta minutos, posterior al inicio o recibida después del reloj actual; contrato sin período full-game esperado o sin alcance aceptado. Aun así la cobertura exacta de OT/DNP y región FanDuel queda explícitamente **sin certificar**.
- Se limita a 1,000 quotes por juego en los 30 min más recientes; historial compacto consultado en lotes pequeños para no truncar silenciosamente resultados.
- No entrega probabilidades, EV, picks, confidence, sugerencia Over/Under ni clasificación de fórmulas. Las diferencias numéricas no son una ventaja estadística.
- Cada error de consulta despeja los datos anteriores del componente, sin mostrar un precio/proyección vencidos.

## Cobertura inicial observada con SQL solo lectura
Consulta diagnóstica a 17 Nov 2026 (juegos futuros según `sport_events`, cuotas archivadas últimos 30 min): dos partidos con 668 contratos individuales por lado/línea (199 de puntos, 172 de rebotes, 132 de asistencias, 165 de triples). Los 668 tenían al menos cinco estadísticas previas capturadas antes de la cuota y 642 tenían al menos diez. Los contratos pueden compartir jugador, partido y línea en ambos lados; **NO son 668 apuestas independientes ni prueba de ROI**.

Estas cifras son un diagnóstico de disponibilidad cambiante, no una garantía de que la interfaz muestre todos los contratos. El backend aplica además calendario GOAT, frescura del reloj y validaciones de contrato. Sin ningún juego elegible muestra un estado explícito de falta de datos.

## Pruebas y seguridad
`tests/nba-props-shadow-panel.test.mjs` cubre muestreo L5/L10, tiempo de captura, ausencia de fuga de datos del partido objetivo, duplicados de quotes, alcance temporal y bloqueo de apuestas. CI `nba-props-visibility-safety.yml` ejecuta pruebas, `tsc --noEmit` y verifica que no se modificaron `vercel.json` ni servicios del modelo.

**No fusionar ni habilitar como pick oficial** sin revisión de la privacidad, prueba de UI en entorno protegido y comprobación de cuotas/proyecciones reales. Como el gate actual `nba-production-feed.enabled` restringe las ramas preview que pueden acceder al feed, el PR no habilita por sí mismo el tablero en una Preview alternativa; no afirmar que se probó visualmente ahí. No se han modificado accesos ni activado nuevos servicios.

## Evaluación direccional de investigación (V1, sin picks)

El usuario necesita una fila única por jugador/mercado/línea que no duplique la presentación Over/Under. La nueva función pura `buildDirectionalResearchRows` toma los props descriptivos, comprueba ambos lados de una misma línea y cotización dentro de 5 minutos, **10 partidos previos completos**, cuota fresca y momento de captura anterior al precio. Su salida por jugador/línea es exclusivamente `OVER_TENDENCY`, `UNDER_TENDENCY` o `PASS`.

- Los umbrales de distancia frente a la línea (puntos 2, rebotes 1, asistencias 1, triples 0.6) son **heurísticos exploratorios no entrenados**, no probabilidad, edge, índice de confianza, EV ni recomendaciones. No promueven fórmula ni activan Official Picks.
- PASS si la diferencia es inferior al umbral, hay menos de 10 juegos, falta una contraparte de cuota, o los lados no son temporalmente comparables.
- Las dos cuotas completas quedan disponibles solamente en el detalle diagnóstico; el panel de investigación muestra la dirección y la cuota correspondiente **solo como observación**.
- El panel de evaluación está antes de la tabla de cuotas para evitar que el usuario confunda dos cotizaciones con dos recomendaciones.
- Una vez acumulados datos prospectivos, comparar resultados reales y precios contratables por mercado; **no** convertir esta dirección heurística en una apuesta con probabilidad/ROI sin calibración walk-forward y holdout nuevo.

## 18 noviembre 2026 — Eliminación de truncación y ampliación de mercado

- `props-shadow` ahora requiere `game_id` y `market` estrictamente válido. Busca el último snapshot pregame **solo para ese mercado** y lee el lote de 90 segundos anterior. No intenta procesar los miles de quotes repetidos del partido: si un lote aun excede 1,000, se detiene explícitamente con revisión, sin truncar un ranking y llamarlo completo.
- Se añadieron 4 mercados combinados: PRA, puntos+rebotes, puntos+asistencias y rebotes+asistencias. Cada observación del historial se calcula a partir de **la suma por partido anterior**, sin independencia artificial entre componentes. Solo muestran tendencia experimental PASS/OVER/UNDER no calibrada.
- `nba_game_context_v2` ya conserva boxscores nuevos automáticamente dentro de producción. Se añadió fallback read-only `nba-props-context-fallback.mjs` para convertir SOLO datos finales que ya estaban capturados, respetando `player_stats_captured_at`, identidad jugador/partido y cero minutos DNP. Deduplica por juego-jugador con la captura más temprana verificada; nunca usa un dato con captura posterior a la cuota.
- Una revisión read-only en Supabase confirmó **18 contextos con boxscores fuera del archivo compacto**; 32 contextos capturados desde 15 Nov comprenden 1,093 filas jugador, cero IDs de partido incorrectos, cero no-finales, cero jugadores sin ID y cero fechas del partido posteriores a la captura. Esto es evidencia de cobertura, no validación de probabilidad.
- Como la consulta de fallback es temporal y read-only, **no equivale al respaldo diario permanente de GOAT en Storage**. Ese trabajo debe cerrarse en PR #340 o un proceso de archivo aprobado; no introducir crons duplicados ni modificar producción.
- La API conserva filtros de precios pregame recientes, contrato, dos lados comparables, muestras L10 y separación entre información descriptiva y apuesta oficial.
- No certificar FanDuel regional, ROI, EV, probabilidad modelo, injury/lineup adjustment o accuracy de props antes de la validación prospectiva.
