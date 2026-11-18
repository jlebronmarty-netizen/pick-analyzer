# NBA: procedencia de proyecciones y auditoría del motor

Fecha: 18 de noviembre de 2026. Base revisada: `ca205f3556b6b4a0282e7d95a9b1e70664e9a9c2` (`ca205f3`). Alcance: procedencia del comparativo FanDuel, lectura del motor vigente y efectos de la consulta de pesos. No se recalibraron probabilidades ni se promovieron recomendaciones.

## Observación del motor vigente

La respuesta de `GET /api/nba/predictions?limit=20`, generada el **2026-11-18 a las 16:55:16.639 UTC / 12:55:16.639 AST**, contiene 12 partidos y 48 salidas de `nba_prediction_engine_v1`: 12 ML, 12 spread, 12 total y 12 primera mitad. Reporta **0 recomendaciones**, `persisted: false` y una penalización de lesiones/alineaciones de 35. Las 12 probabilidades ML son exactamente **88%**, incluso Golden State con margen proyectado de solo 1.2 puntos. Estos resultados no constituyen ventajas validadas.

Ejemplo observado: Cleveland 116.9, Memphis 119.6. La selección Memphis ML devuelve 88%, cuota +166, EV 134.08% y `recommendedPick: false`. Memphis +4.5 devuelve 37.92% de cobertura. Los valores de probabilidad y EV se conservan como evidencia de la anomalía, no como valoración utilizable.

## Tres procedencias diferentes

| Procedencia | Cálculo real | Interpretación |
| --- | --- | --- |
| Excel exploratorio anterior | Jugadores: `0.40 × L5 + 0.60 × L10`. Equipos: promedio de ataque L5/L10 y defensa rival L5/L10, con +1 local y −1 visitante. Períodos: promedio de ataque y defensa rival de temporada tomado de una fuente externa por período. | Fórmulas elegidas para ese análisis. No son salidas del motor oficial. Los L5 y L10 se solapan. La información externa aportaba estadísticas, no esas proyecciones terminadas. |
| `nba_prediction_engine_v1` | Marcador a partir del promedio de anotación del equipo y puntos permitidos por el rival, ajuste de forma por victorias y +1.6 local; limita cada marcador a 88–142. Primera mitad = 49% del marcador. ML utiliza la cadena V2/V3/V4, que incluye un componente de mercado del 45%. | Motor existente de Pick Analyzer. Su existencia y versión no prueban calibración ni independencia de las cuotas. Las probabilidades presentan los fallos descritos abajo. |
| `NBA_PROPS_PROSPECTIVE_SHADOW_V1` | `0.65 × media últimos 5 elegibles + 0.35 × media hasta 10 elegibles`. Exige al menos cinco partidos previos verificados, con al menos 10 minutos jugados y datos capturados antes de la cuota. | Baseline interno de investigación. No equivale al L5/L10 convencional de todos los partidos jugados. Devuelve probabilidad y EV nulos; no ajusta por lesión, alineación o rival, ni está validado/calibrado. |

Evidencia de implementación: `src/services/nba-prediction-engine.service.ts`, `src/utils/prediction-engine-v2.ts`, `src/utils/prediction-engine-v3.ts`, `src/utils/prediction-engine-v4.ts` y `src/lib/nba/goat-props-shadow-core.mjs`. Cuando `team_stats` procede de `goat-team-stats-core.mjs`, sus desgloses recientes se guardan como no disponibles y el motor utiliza el porcentaje de victorias de temporada como sustituto. No corresponde afirmar que el marcador usa L5/L10 de puntos.

## Fallos que impiden usar probabilidades y EV como ventaja

1. **Signo de la penalización de lesiones.** `buildPredictionsForEvent()` pasa `injuryImpact: -confidence.penalty`. V3 resta ese factor y V4 vuelve a restarlo ponderado. Así, una penalización de 35 aumenta la probabilidad: +35 puntos en V3 y +20.475 adicionales en V4 con el peso predeterminado 1.3, antes de los topes. `getMaxModelProbabilityForOdds()` establece 88 como techo para cuotas inferiores a +300. Una prueba local de las funciones reales, con ratings iguales y datos sintéticos constantes, produjo 43.98% con penalización cero y 88% con el factor −35. La prueba explica el mecanismo; no es una proyección deportiva.

2. **Signo del spread.** La fórmula usa `abs(margen) - abs(hándicap)`. En el ejemplo, `50 + 35 × tanh((2.7 - 4.5) / 5)` reproduce 37.92%. La distancia correcta al umbral para Memphis +4.5 es `2.7 + 4.5 = 7.2` puntos. Esa diferencia aritmética no proporciona, por sí sola, una probabilidad calibrada. Además, `projectedLine` conserva el margen local menos visitante aunque la selección sea visitante.

3. **Precio de Under asociado a Over.** El motor busca siempre la cotización Over y puede etiquetar después la selección como Under sin cambiar `oddsRow`. Su cuota, probabilidad implícita y EV pueden pertenecer al lado opuesto.

4. **Primera mitad derivada.** La supuesta línea es `totalLine × 0.49`; al faltar `oddsRow`, se asigna −110. No es una línea ni una cuota FanDuel capturada.

5. **Referencias ML incompletas.** `opponentAmericanOdds` se fija en −110. El factor llamado `headToHeadAdvantage` recibe el margen proyectado local multiplicado por 0.25, no resultados de enfrentamientos previos; tampoco invierte el signo para un visitante seleccionado.

El marcador proyectado se calcula separadamente de estas probabilidades. Puede identificarse como salida informativa del motor vigente, con fecha y versión, sin presentarlo como marcador calibrado o ajustado por las ausencias concretas. Las diferencias contra líneas reales se expresan en puntos; las probabilidades, EV, stakes y rankings derivados de los valores defectuosos no justifican oportunidades de apuesta.

## Efecto de una consulta sobre los pesos

En la base revisada, `getModelWeights()` llama siempre a `ensureWeights()`, que hace `upsert` de los pesos predeterminados en `model_weights`. Por tanto, `persist: false` evita guardar predicciones, pero no impedía esa escritura indirecta al consultar el motor.

El cambio de esta tarea añade la opción `initialize` y hace que la generación NBA solicite `getModelWeights(NBA_SPORT_KEY, {initialize: false})`. Esa ruta lee los pesos almacenados y utiliza los predeterminados en memoria si falta alguno; no ejecuta el inicializador. La corrección limita este efecto lateral en la ruta NBA sin alterar sus ecuaciones de predicción. No implica que todos los demás consumidores del inicializador hayan sido modificados.

La comprobación de base de datos de esta sesión encontró `sample_size = 0` y ausencia de historial de pesos NBA. Esa evidencia no permite reconstruir pesos anteriores ni afirmar que se haya perdido entrenamiento previo. No se inventó ni restauró un valor histórico.

## Tratamiento del comparativo

Cada fila distingue cotización observada, estadística histórica, fórmula exploratoria y salida del motor por nombre/versión. Las líneas derivadas de primera mitad no se atribuyen a FanDuel. Si falta una proyección aplicable o una probabilidad utilizable, el resultado queda ausente y el motivo se indica explícitamente. Una diferencia de puntos es una discrepancia descriptiva; no se etiqueta como ventaja validada.
