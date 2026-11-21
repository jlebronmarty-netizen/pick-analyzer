# NBA Decision Engine V2 · Informe experimental del 20 de noviembre de 2026

**Decisión de la rama. Mantener SHADOW. El Challenge queda sin apuesta.** Los resultados históricos con precios favorecen al operador frente al modelo basado en errores de proyección. La primera muestra V2 prospectiva comprende tres partidos. El PR no habilita recomendaciones oficiales.

## Datos efectivamente utilizados

| Fuente archivada | Uso y cobertura |
|---|---|
| `sport_events` BDL | 3,710 encuentros en 2022–23, 2023–24 y 2024–25. Diez antecedentes de ambos equipos dentro de la misma temporada. 468 encuentros fuera de la evaluación de proyecciones de equipo por ventana o resultado. |
| `sport_player_stats` BDL | 1,814 filas en un panel fijo de ocho jugadores. Hubo 328 DNP. El holdout de cada estadística comprende 476 actuaciones en 425 partidos. |
| `prediction_history` + `sports_odds_snapshots` | En un conteo amplio había 1,112 juegos con enlace a precio por mercado principal, de los cuales 31 tenían precio posterior al corte. La extracción estricta de certificados FanDuel produjo 3,253 enlaces. Se conciliaron 3,045 contra los dos lados del operador. Otros 208 fallaron el corte o la antigüedad máxima. Tras exigir historial completo, quedaron 891 juegos por mercado en la temporada de prueba. |
| GOAT 2026 | En la investigación compacta había 6,463 filas de 225 partidos. En el panel de ocho jugadores se encontraron 112 actuaciones en 96 juegos. Hoy se pueden formar diez antecedentes para 32 actuaciones. En una sola los diez constaban materializados al menos una hora antes del inicio. Es un límite superior previo a validar calendario, lesiones y contrato. |
| Cuotas GOAT de props | Los dos contratos estrictos Over y Under de partido completo reúnen 74,123 capturas cada uno en 130 juegos cada uno. Sus etiquetas dejan pendiente la prórroga. Q1 estricto cubre 25 juegos. Las capturas repetidas y los hitos con condiciones pendientes quedan separados. |
| SHADOW V1 | 708 proyecciones en 13 partidos. 119 resultados en cuatro juegos. De las 214 proyecciones de props en 11 juegos, ninguna tenía resultado enlazado en esta lectura. La cohorte V2 tiene identidad, versión, instante de congelación y resultados propios. |

Las fuentes de las tres temporadas son retrospectivas. El archivo de estadísticas antiguas se materializó después de los encuentros. Solo entran partidos anteriores, con ocho horas de margen para un final previo, y precios originales anteriores al corte. Las correcciones históricas, ausencias del calendario original y disponibilidad exacta del dato en aquel momento siguen siendo fuentes de incertidumbre. El panel de ocho jugadores no es una muestra aleatoria de la NBA. Su estimación se refiere a actuaciones con minutos positivos. Los DNP son abstenciones de liquidación. El mínimo de diez minutos se aplica a los antecedentes. Un partido objetivo de pocos minutos sí cuenta.

## Diseño y comparación

El modelo de equipo usa las proyecciones de ataque/defensa del Decision Board. Para jugadores, los modelos usan el peso descriptivo existente de L5/L10 para la proyección central. La probabilidad procede de una distribución del error observado en juegos anteriores. Comparamos una distribución logística y una distribución empírica de 201 cuantiles, con igual peso por partido. El modelo separa ganar, perder y devolución en líneas enteras. La temperatura ajusta la probabilidad condicional a una liquidación sin empate.

1. Ajuste en 2022–23.
2. Calibración de temperatura en el primer tramo de 2023–24, con resultados disponibles bajo el margen temporal antes del 1 de enero.
3. Selección por Brier en el resto de 2023–24. Ningún partido de 2024–25 interviene en el ajuste de estas dos familias.
4. Prueba histórica en 2024–25. Brier, log loss y accuracy excluyen devoluciones. ROI devuelve la unidad en un push. Las curvas de calibración, ECE de diez intervalos, MAE, EV, incertidumbre y denominadores constan en los JSON. Los intervalos del 95% remuestrean partidos 1,000 veces con semilla fija. No ajustan por las múltiples comparaciones ni por dependencia interdiaria de un mismo equipo.
5. Comparación secundaria de precios dentro de 2024–25. Se ajustó un intercepto antes de enero, se eligió el método en enero y se evaluó desde febrero. La temporada ya se había examinado en el análisis principal. Este contraste sigue siendo exploratorio.
6. Primer registro prospectivo V2 publicado en GitHub antes del inicio. Las etiquetas de resultado solo pueden llegar por separado.

El lado canónico de la comparación principal es local en Moneyline/Spread y Over en Total. Para ligar un precio se exigen operador, lados, línea recíproca o total idéntico, timestamp, ambos equipos en el mismo orden y concordancia con la liquidación archivada. Se acepta una diferencia máxima de 15 minutos entre horarios anunciados si el registro es único y el corte precede por una hora a ambos horarios. En 946 de los enlaces de Moneyline certificados y a tiempo, la diferencia observada era diez minutos. La sensibilidad con hora idéntica queda registrada por separado (78 juegos por mercado). Se adjudicó el resultado de nuevo a partir del marcador. Las simulaciones asumen el precio archivado y una unidad por decisión.

| Mercado con precio | Juegos / pushes | Brier V2 | Brier FanDuel sin margen | Log loss | MAE | Acierto | ROI en EV estimado positivo [IC 95%] |
|---|---:|---:|---:|---:|---:|---:|---|
| Moneyline | 891 / 0 | 0.2223 | 0.2021 | 0.6350 | 11.51 pts de margen | 63.08% | −9.74% [−22.66%, +3.67%], 425 juegos |
| Spread | 891 / 14 | 0.2748 | 0.2501 | 0.7513 | 11.51 pts de margen | 50.40% | −4.81% [−13.96%, +3.48%], 428 juegos |
| Total | 891 / 6 | 0.2683 | 0.2500 | 0.7331 | 15.05 pts | 49.83% | +0.78% [−8.46%, +9.77%], 415 juegos |

La comparación secundaria incluyó precio sin margen, mezclas de 15% y 35% de señal residual en escala logit y mezcla de 15% con intercepto. En 420 juegos nuevos respecto de la selección de enero, el método elegido fue mezcla con intercepto para Moneyline y Total, y precio sin margen para Spread. Brier fue 0.1940, 0.2495 y 0.2503 respectivamente. En Total, el ROI del subconjunto con EV positivo fue +3.38% en 338 juegos, IC 95% [−6.52%, +13.79%]. Ninguna variante demostró precio ejecutable y rendimiento positivo con suficiente certidumbre.

### Props y períodos

Para la prueba de props elegimos Jamal Shead, Jalen Brunson, Trae Young, Domantas Sabonis, Stephen Curry, Cade Cunningham, Tyrese Maxey y Derrick White. Los umbrales representan preguntas estadísticas reproducibles. El baseline por jugador usa su frecuencia en entrenamiento con suavizado de diez observaciones hacia la tasa global. Los ocho mercados se probaron sobre el mismo panel.

| Mercado | Umbral de referencia | Brier V2 | Brier por jugador | MAE |
|---|---:|---:|---:|---:|
| Asistencias | 4.5 | 0.1646 | 0.1973 | 2.42 |
| Puntos | 19.5 | 0.1823 | 0.2262 | 6.28 |
| Rebotes | 4.5 | 0.1665 | 0.1959 | 1.97 |
| Triples | 1.5 | 0.1796 | 0.1946 | 1.32 |
| Puntos + asistencias | 24.5 | 0.1457 | 0.2101 | 6.74 |
| Puntos + rebotes | 24.5 | 0.1735 | 0.2359 | 6.80 |
| Rebotes + asistencias | 9.5 | 0.1645 | 0.2168 | 3.32 |
| PRA | 29.5 | 0.1579 | 0.2253 | 7.40 |

Cada período tuvo 1,082 juegos con diez antecedentes de ambos equipos. A umbrales de 54.5 para cuartos y 109.5 para mitades, Brier fue 0.2376 (Q1), 0.2344 (Q2), 0.2202 (Q3), 0.2526 (Q4), 0.2229 (H1) y 0.2315 (H2 incluyendo prórroga). Q4 quedó peor que la frecuencia del período en entrenamiento (0.2497). Faltan precios históricos verificables alineados con esos contratos para calcular ROI de estas series. Moneyline y Spread de períodos, totales de equipo y props a otros umbrales requieren experimentos específicos.

## Challenge de $100 a $1,000

El modo de investigación devuelve como máximo un candidato por criterio. La salida ejecutable siempre es vacía. La clasificación exige historial, identidad, precio vigente, versión y alcance revisados, contexto confirmado, ejecución regional, contrato y cota inferior de EV positiva. El rango preferente es −110 a −200. La excepción hasta −300 necesita habilitarse expresamente y solo entra cuando el rango preferente carece de candidatos.

En una simulación adicional se compararon ambos lados de los tres mercados de partido completo a las 6:00 p. m. PR, una selección por jornada, sin reinversión. Solo se aceptaron precios originales disponibles en ese instante con antigüedad máxima de tres horas, juegos a más de diez minutos del inicio y estadísticas previas ya utilizables bajo el margen de ocho horas. Este análisis retrospectivo está condicionado a que el par de precios exista en el archivo certificado. De 149 jornadas con muestra evaluable, hubo 136 con candidato para cada criterio. Mayor probabilidad obtuvo ROI +3.03% [−12.94%, +17.48%]. Mayor EV obtuvo +3.66% [−12.45%, +18.96%]. Los intervalos incluyen pérdidas. El Challenge real permanece sin selección V2.

## Congelación, recuperación y estado operativo

El lote `forward-20261120.json` contiene 15 probabilidades del lado Over para Q1–Q4 y H1 en tres partidos. El tablero de origen marcaba 9:57:07 p. m. PR, la congelación 9:58:16 p. m. y el commit de publicación 10:00:07 p. m. El primer inicio era 10:30 p. m. El hash del modelo, la fecha de selección, los IDs de los partidos históricos, el hash del recibo, el precio original, la prórroga y los instantes de corte y vencimiento viajan con cada fila. El registro proviene de contratos estadísticos de HoopsAPI disponibles en el tablero almacenado. La ejecución regional sigue sin verificar. Las tres observaciones independientes de cada período están pendientes de resultado al corte del informe. [Commit anterior al inicio](https://github.com/jlebronmarty-netizen/pick-analyzer/commit/d3f1a9a49d44a0f7dc57eebfea77c1c8c0cade21)

`freeze.mjs` lee un tablero archivado de hasta diez minutos de antigüedad, usa el reloj real y publica el lote completo de forma atómica en un archivo nuevo. El ID es estable por versión, juego, mercado, período, jugador y lado. La liquidación lee snapshots originales y concilia el marcador por período. Los props necesitan coincidencia entre original y compacto. Un empate devuelve la unidad. Una corrección conflictiva queda en disputa. `forward-metrics.mjs` usa la primera congelación por hipótesis, descarta duplicados y bloquea discrepancias. Exige al menos 100 juegos históricos y 100 prospectivos binarios por alcance para pasar a revisión independiente. También hacen falta calibración, comparación contra el operador, evidencia de ejecución regional y de contexto, un límite inferior de EV defendible y autorización humana.

El adaptador de vista añade el detalle SHADOW al recibo exacto de la fila. Mantiene proyección, contexto, L5/L10 y ranking existente. Muestra probabilidad condicional, implícita del operador, EV estimado, devolución, intervalo histórico central del resultado y versión. La vista experimental aplica el evaluador al mismo recibo y devuelve la razón V2 y el estado del Challenge. Al aplicar el evaluador al tablero del primer lote, siete filas quedaron VIGILAR y ocho PASAR por EV estimado igual o menor que cero. La salida del Challenge fue SIN APUESTA. La API oficial no entrega el anexo experimental. Las seis vistas y el Top 25 se probaron en Chromium móvil y escritorio.

Para operar diariamente se propone usar la lectura del tablero que ya realiza la congelación de 11:35 a. m. y 7:35 p. m. PR, y los resultados archivados que ya lee la liquidación de 8:15 a. m. PR. La futura persistencia debe ser separada y de solo inserción, con clave única por hipótesis, primera captura inmutable, resultado con recibo versionado y publicación transaccional. El PR aporta el adaptador offline y la prueba manual. Conectar un escritor en producción y certificar sus reintentos requiere autorización. La rama no modifica rutas de cron, la configuración de Vercel, modelos oficiales ni filas de Supabase.

## Reproducción y evidencia

1. Ejecutar los SELECT de `scripts/research/nba-v2` sobre una copia o conexión de solo lectura. Exportar cada columna `r` como array JSON, manteniendo el orden SQL, a `/tmp/pick-v2-{games,players,prices,pairs}.json`. Para la ampliación de props exportar una fila JSON por línea a `/tmp/pick-v2-player-markets.ndjson`. `goat-asof.sql` y `goat-coverage.sql` incluyen el corte de la consulta operativa.
2. Ejecutar los comandos siguientes en la raíz del repositorio con un directorio de salida nuevo. Comparar los hashes de los arrays de origen, los resultados y el modelo generado con los archivos versionados.
3. Para consultar el detalle de cada mercado, revisar `replay.json` y `player-markets.json`. Los intervalos de probabilidad por selección necesitan validación adicional. La banda de la interfaz mide dispersión histórica del resultado en unidades deportivas.

```bash
mkdir -p /tmp/v2-replay
node scripts/research/nba-v2/replay.mjs /tmp/pick-v2- /tmp/v2-replay
node scripts/research/nba-v2/player-markets.mjs /tmp/pick-v2-games.json /tmp/pick-v2-player-markets.ndjson /tmp/v2-replay/player-markets.json
node --test tests/nba-decision-probability-v2.test.mjs tests/nba-probability-research.test.mjs
```

Comandos operativos offline: `freeze.mjs board.json model.json nuevo-lote.json`, `preview.mjs board.json lote.json nueva-vista.json`, `settle.mjs lote.json recibos.json nuevos-resultados.json`, `forward-metrics.mjs model.json manifiesto.json`. El archivo de recibos usa claves de game ID con `scheduleReceipts`, `contexts` y `compact`. El manifiesto contiene `batches` y `settlements` como listas de rutas y los ISO timestamps `holdoutFrom` y `asOf`. El holdout de esta primera versión empieza el 20 de noviembre de 2026 a las 9:57 p. m. PR. V1 conserva sus pronósticos originales.

Los seis tests originales pasaron por ejecución directa. En la revisión final pasaron 195 pruebas NBA, 103 del dashboard multideporte y seis de navegador. Next.js y TypeScript compilaron con 400 páginas. La suite general de primer nivel pasó 694/696. Las dos comparaciones contra el commit fijo `0629d647` en `sport-recommendation-ui.test.mjs` también fallan en el `main` integrado `9275118c`. Se reprodujeron ambas en ese checkout y se conservó su resultado. No hay diferencias del PR en NHL, las rutas de API, los servicios oficiales ni `vercel.json`.
