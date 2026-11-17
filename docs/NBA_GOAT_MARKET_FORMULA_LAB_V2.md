# NBA GOAT Formula Lab V2 — Resultados iniciales de experimentación

**Estado: implementado en la rama de investigación, no habilitado en modelos oficiales.** Fecha 2026-11-16.

## Implementación
- `src/lib/nba/goat-formula-lab-v2.mjs`: motor puro sin bases de datos, sin outputs de apuestas, sin EV, sin cambios a modelos ni recomendaciones.
- `scripts/nba-goat-prop-formula-lab-v2.mjs`: CLI de solo lectura, dry-run predeterminado; `--execute` explícito usa únicamente `nba_goat_player_game_research_v1`. No llama a GOAT ni modifica Supabase.
- `tests/nba-goat-formula-lab-v2.test.mjs`: valida identidad, no usar estadística/minutos del mismo partido, aislamiento de capture timestamp, deduplicación y separación temporal.
- Fórmulas (8): `L10`, `L5`, `EWMA_0_2`, `EWMA_0_4`, `EWMA_0_6`, `RATE_L5_MIN_L5`, `RATE_L10_MIN_L10`, `RATE_L10_MIN_L5`. `RATE_L10_MIN_L10` es una comprobación de equivalencia matemática con L10; el desempate favorece fórmulas simples.

## Primera comparación observada (SQL read-only)

Datos compactos verificados, solo jugadores con diez juegos previos, partido objetivo nunca es un feature. Cuatro mercados, TRAIN 8–12 noviembre de 2026 (183 registros jugador-partido por mercado, 26 partidos); fecha de evaluación 13–15 noviembre de 2026 (256 registros por mercado, 22 partidos). 8 fórmulas × 4 mercados = **32 combinaciones**, aparte de los 44 de V1. Se comparan en el mismo conjunto elegible para no favorecer muestras diferentes.

| Mercado | Fórmula seleccionada por TRAIN | MAE TRAIN | MAE 13–15 nov | MAE baseline L10 | Mejora |
|---|---|---:|---:|---:|---:|
| Puntos | RATE_L10_MIN_L10 (equivalente matemático a L10) | 4.5115 | 5.4250 | 5.4250 | 0.0000 |
| Rebotes | L10 | 1.9284 | 2.0805 | 2.0805 | 0.0000 |
| Asistencias | L10 | 1.4350 | 1.5707 | 1.5707 | 0.0000 |
| Triples | L10 | 0.9475 | 1.0738 | 1.0738 | 0.0000 |

**Interpretación:** V2 no mostró mejora sobre L10. La fórmula RATE_L10_MIN_L10 de puntos equivale algebraicamente a L10 y su selección inicial reflejó diferencias insignificantes de coma flotante. El código V2 ya tiene desempate que favorece la forma más simple de una fórmula equivalente.

**Límites:** fechas de evaluación ya estudiadas en V1; NO es un nuevo holdout independiente. 22 partidos de NBA con múltiples registros de jugadores correlacionados; 256 no equivalen a 256 juegos ni apuestas independientes. Archivo GOAT recuperado retrospectivamente: etiqueta `RETROSPECTIVE_RECONSTRUCTED`, no evidencia de que los datos hubieran estado disponibles cuando las cuotas históricas se tomaron. No calcular ROI ni probabilidades calibradas a partir del MAE.

## Próxima fase de mayor utilidad

1. Capturar y congelar nuevas predicciones futuras con datos realmente disponibles en el cutoff (PROSPECTIVE_ASOF_VERIFIED).
2. Ampliar de forma medida nuevos **features pregame**: descanso, rival, ritmo, eficiencia y rotación/minutos proyectados; no usar los minutos reales del juego objetivo.
3. Incorporar solo estadísticas avanzadas **validadas**, sin los dos juegos con advanced vacíos.
4. Comparar simultáneamente por mercado contra L10 y la fórmula oficial, usando nuevos juegos nunca inspeccionados para seleccionar parámetros.
5. Reportar cobertura, MAE, bias, calibración, splits por equipos/jugadores, intervalos por bloques de juegos y después ROI solo cuando se confirmen líneas FanDuel/contratos/settlement.
6. Mantener estado PASS si ninguna ventaja se sostiene; prohibido alterar Official Picks, modelos o crons automáticamente.

Este documento no constituye autorización para fusionar PR #340 ni habilitar captura diaria nueva; todas las rutas permanecen en investigación.
