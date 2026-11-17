# NBA GOAT MARKET FORMULA LAB V1 — investigación separada de producción

**Fecha de análisis:** 2026-11-16. **Estado:** diseño de experimentación / auditoría de cobertura. NO es un modelo calibrado, NO genera picks y NO modifica `main`, modelos oficiales, crons ni liquidaciones.

## Pregunta de investigación

¿Se puede encontrar para cada mercado una fórmula replicable que mejore proyección, cobertura, calibración y valor económico frente a un baseline, usando solo datos que eran legítimamente conocibles en el corte previo a cada partido?

Sí se buscarán candidatos como en MLB, pero **con selección separada de validación y holdout temporal** y corrección por múltiples pruebas. No lanzar búsqueda sin cobertura temporal, ni buscar maximizar aciertos sobre la misma muestra usada para descubrir fórmulas.

## Cobertura de arranque medida con SQL read-only

- `nba_goat_player_game_research_v1`: 192 partidos, 5,323 filas jugador-partido, 531 jugadores, 3,577 filas con elegibilidad de proyección. L5 disponible en 315 jugadores, L10 en 234, **L20 todavía en cero** (máximo 14 juegos elegibles por jugador).
- En `nba_market_quotes_v1`, cuotas **PREGAME** y resultados individuales correspondientes hasta el corte de la consulta: 67 juegos; rows capturados por stat: 12,358 puntos, 10,270 rebotes, 7,283 asistencias, 10,060 triples. Son **snapshots repetidos, NO observaciones independientes** y NO implican que un histórico L5/L10 estuviera realmente disponible a la hora de cada cuota.
- PREGAME ML/spread/total: 101 juegos cotizados, de los cuales 88 empatan con juegos que tienen estadísticas finales en el archivo GOAT. Aún hay que deduplicar snapshots y verificar contratos.
- `prediction_history` NBA desde 2026-10-20: 19 moneylines liquidadas, 13 spreads y 8 totals (muestra oficial demasiado pequeña para inferir rentabilidad). No son 40 resultados probatorios de una fórmula nueva.
- **Advertencia temporal fundamental**: las cuotas pregame de los juegos emparejados fueron capturadas **antes** de capturar sus datos finales, como corresponde; esos datos finales sirven para **etiquetas de resultados**, nunca como features de la misma decisión. Los archivos GOAT de octubre y principios de noviembre pueden haberse descargado retrospectivamente, así que en un backtest prospectivo estricto `source_captured_at` debe ser anterior a la cuota para cada juego que se use como **historial previo**. Backtests retrospectivos de datasets reconstruidos deben identificarse por separado y nunca presentarse como evidencia real-time original.

## Mercados y familias de fórmulas candidatas (hipótesis, no jugadas)

| Mercado | Fórmulas y variantes a comparar | Labels, métricas |
|---|---|---|
| Player points | L5, L10, ventanas ponderadas, EWMA, minutos × puntos/minuto, rango/volatilidad, tendencia de uso, ajuste pregame por compañeros | MAE/RMSE de puntos, bias, error por rango de línea, hit rate condicionado al contrato, Brier/log loss al calibrar |
| Player rebounds | L5/L10, minutos, rebotes/minuto, rol, ritmo y lanzamientos fallidos esperados | MAE/RMSE, calibration, no-DNP y tratamiento de minutos |
| Player assists | L5/L10, ast/minuto, minutos, rol e historia de jugadores titulares ausentes conocidas antes del inicio | MAE, Brier, calidad temporal de lesión/lineup |
| Player 3PM | L5/L10, 3PA recientes, promedio de 3PM, tasas de acierto regularizadas, minutos, oponente | MAE, probabilidad discreta Over/Under, score y calibración |
| Player PRA/combinados | Suma proyectada de puntos+rebotes+asistencias, covarianzas por jugador; no asumir independencia | MAE, calibración y verificación del contrato y prórroga |
| ML | Net rating, ritmo, ELO/EWMA, descanso, viaje, localía, lesiones pregame, bayesian shrinkage, mercado como baseline | Brier, log loss, calibración, accuracy y CLV/ROI por cuota |
| Spread | Margen esperado, eficiencia ajustada, pace, descanso/localía/lesiones, residual frente al spread del mercado | Error absoluto del margen, tasa ATS y ROI según cuota |
| Game total | Ritmo × posesiones × eficiencia ofensiva/defensiva, modelos de suma de posesiones, lesiones/rotación pregame y error relativo frente a línea | MAE/RMSE del total, O/U hit rate, ROI/CLV |
| Otros props | Bloqueos, robos, turnovers y props alternos solo cuando existan cuota, score y contratos verificables | Cobertura, sample, validación |

## Diseño cuantitativo obligatorio

**Unidad de observación:** 1 decisión y mercado contractual por partido-jugador-línea-side con timestamp congelado, NO 20 snapshots del mismo contrato. Para mercados team-level: 1 evento-mercado-book-snapshot predefinido. Elegir preventivamente un cutoff reproducible (por ejemplo 30 min antes del inicio, tolerancia de frescura) y descartar contratos fuera de alcance.

**Target:** estadística final real + outcome del contrato. Tratar push, DNP, prórroga, líneas enteras y mercados bloqueados conforme a reglas verificadas; no tratarlos automáticamente como victorias.

**Features:** solo datos finalizados de partidos anteriores, recibidos antes del cutoff; local/visitante, descanso, rol, oponente y lesiones deben tener timestamp propio o se excluyen. Los campos `advanced_v2_unverified` nunca alimentan fórmulas.

**Baselines:** media L5, media L10 (solo con 10 juegos), baseline de cuotas implícitas sin vigorish cuando hay ambos lados, y modelo oficial existente capturado en la misma hora. Si no hay suficientes ejemplos, mantener estado `INSUFFICIENT_SAMPLE`.

**Etapas:**
1. Auditoría determinista por mercado de juegos, jugador, fecha, cuotas, resultados y features realmente disponibles antes del corte.
2. Fórmulas simples interpretables como baseline. Luego búsqueda acotada y preregistrada de pesos, ventanas, transformaciones, regularización y combinaciones.
3. Entrenamiento walk-forward por bloques temporales; selección de hiperparámetros únicamente en training/validation anterior.
4. **Holdout temporal final** sin inspección durante búsqueda, con agrupación por juego/día/jugador para no tener fuga por snapshots y correlated parlays.
5. Solo propuestas con suficientes eventos independientes y mejora replicable; intervalos de confianza por bootstrap en juegos/días, no por filas de odds duplicadas. Corregir falsos descubrimientos por probar muchas fórmulas. Reportar ROI simulado **solo** si cada cuota congelada es real y la liquidez/settlement resulta verificable.
6. Registrar `FORMULA_CANDIDATE` o `PASS`, no `VALIDATED_CANDIDATE` hasta contar con holdout y evidencia de costo; nunca escribir Official Picks ni cambiar pesos en producción sin revisión y aprobación explícita.

**Umbral inicial exploratorio:** mínimo 50 decisiones independientes para siquiera comparar tendencias; no certificar rentabilidad ni afirmar mejora en producción hasta ≥200 resultados con cuotas y validación temporal adecuada (cifra de trabajo, no garantía estadística). Depende también del mercado, varianza y amplitud de IC. El uso de miles de snapshots repetidos no sustituye el número de partidos/contratos independientes.

## Implementación concreta — siguiente entregable

- Construir extractor de **dataset congelado** desde `nba_goat_player_game_research_v1`, `nba_market_quotes_v1` y resultados verificados, con filtros `game_datetime < decision_time` y `source_captured_at <= decision_time` por feature.
- Congelar selección de cuotas y documentar mercado/periodo/OT. Identificar contract ambiguity (FanDuel no es automáticamente equivalente a balldontlie).
- Construir informe por mercado: universo, elegibles, excluidos por causa, n independiente, líneas, baselines y rangos de fechas.
- Añadir test de anti-leakage y deduplicación con ejemplos de quotes capturados antes/después del dato.
- Implementar motor de búsqueda offline en rama shadow, con parámetros versionados, top-candidates, prueba temporal, placebo/control y umbral de no-promoción.

## Política de costos/producción

No descargar nuevamente los 192 juegos, no ampliar tablas con payload JSON crudo y no modificar crons existentes. La nueva tabla compacta de 1.67 MB basta para empezar props; las familias de tracking/defensa/PBP son una fase posterior con prueba de cobertura. Los actuales schedules de captura diaria adicional no se deben asumir activos: `vercel.json` se restauró a `main` por política de seguridad.
