# NHL: investigación del aporte predictivo de datos manuales a Moneyline

## Estado y pregunta de investigación

Este protocolo estudia si cuatro grupos de variables del panel manual mejoran la probabilidad de victoria local publicada por DRatings. Se evalúan por separado, con cortes temporales verificables y comparación emparejada. La probabilidad activa de Pick continúa siendo la referencia publicada por DRatings; ningún resultado de este informe la reemplaza.

**El estado inicial es evidencia insuficiente.** Hay 14 snapshots manuales de siete partidos, dos versiones por partido con los mismos inputs de equipo. Ninguno de esos siete tiene un resultado final en el corte auditado. H1 está bloqueada por falta de captura primaria de clasificación; H2, H3 y H4 tienen variables disponibles en el anclaje tardío, pero todavía no hay entrenamiento ni evaluación de resultados. Una métrica ausente se representa como `null`, nunca como 0% de acierto o una mejora de cero.

| Dato de control | Valor |
|---|---|
| Versión del informe | `NHL_MANUAL_ML_RESEARCH_V1` |
| Versión de evaluación | `NHL_MANUAL_ML_ASOF_REPLAY_V1` |
| Registro de la política | `2026-11-24T00:13:59.000Z` — 23 nov, 20:13:59 PR |
| Corte de datos de esta entrega | `2026-11-24T00:05:15.236207Z` — 23 nov, 20:05:15 PR |
| Zona de agrupación por jornada | `America/Puerto_Rico` |
| Objetivo | Ganador oficial del partido completo, incluyendo OT y shootout; probabilidad de victoria local |
| Tipo de resultados calculables | Reconstrucción de investigación `ASOF_REPLAY` |
| Pronósticos nuevos emitidos prospectivamente | 0 |
| Llamadas nuevas a proveedores / escrituras en base | 0 / 0 |
| Ajuste de probabilidad activa / promoción / Official Pick | `false` / `false` / `false` |

El registro fija hipótesis y parámetros. **No acredita una emisión prepartido de los candidatos**: las siete decisiones V6 de esta muestra ocurrieron antes de ese registro y el primer partido ya había alcanzado su horario programado. Las probabilidades que el evaluador pueda reconstruir posteriormente deben conservar `issuedAt: null` y `prospectiveForecastIssued: false`. Un nuevo holdout prospectivo requiere pronósticos emitidos y archivados antes de sus partidos bajo una autorización futura para el escritor correspondiente.

La evidencia verificable de esta entrega se conserva en [el directorio del informe](research/nhl-manual-ml-2026-11-23/README.md). Las definiciones de persistencia del input manual están en [el contrato V1](nhl-manual-features-v1.md). La implementación del evaluador es la especificación ejecutable de las fórmulas y exclusiones: [`nhl-manual-ml-evaluation.mjs`](../src/lib/nhl-manual-ml-evaluation.mjs).

## 1. Qué utiliza el sistema activo

| Referencia | Qué determina la probabilidad | Relación con los datos manuales |
|---|---|---|
| DRatings original — `DRATINGS_PUBLIC_V1`, selección `DRATINGS_PUBLIC_ARGMAX_V1` | Probabilidad publicada por el proveedor; se conserva su pronóstico original y se selecciona el lado de mayor probabilidad | El archivo no demuestra cuáles son las variables internas de DRatings. No se puede afirmar que incorporar un campo manual aporte información que el proveedor desconozca. |
| Poisson propio archivado | Goles recientes y promedio previo según localía; mezcla existente de 75% forma y 25% promedio | Es una referencia separada. Su proxy Moneyline reparte la masa de empate 50/50 y conserva la limitación de modelado de OT/SO. |
| V6 experimental archivado | Circa sin margen más residuo previo de localía contra esa referencia, con contracción `n/(n+50)` | Proporciona un anclaje tardío ya existente y un comparador experimental. No es una promoción de los inputs manuales. |
| Datos manuales compartidos | Temporada, L10, goles, tiros, períodos, condición, descanso, PP/PK y porteros reportados | Están disponibles para investigación. El lector del panel no los conecta a la fórmula activa de probabilidad. |

Circa se conserva como la cotización archivada identificada en DRatings; no es FanDuel. La probabilidad sin margen se usa como referencia matemática. No se certifican ejecución, hora de publicación original ni reglas del contrato concreto, y no se deduce EV, ROI, CLV o una ventaja de apuestas de estas comparaciones. El estado probable de un portero de ESPN o DFO no equivale a confirmación de titularidad.

La referencia concreta de este protocolo es **la primera probabilidad DRatings archivada**, usada por el historial y su liquidación. El tablero vivo puede mostrar una observación DRatings posterior de `latestRun.detail.forecasts` o del snapshot de cotización más reciente mediante `mergeNhlQuoteSnapshots`. Por tanto, una futura diferencia favorable en el anclaje tardío se interpretará frente a ese original conservado; no demostraría por sí sola superioridad frente a la última probabilidad DRatings visible exactamente a esa misma hora. El adaptador declara este alcance como `researchBaseline: FIRST_IMMUTABLE_ORIGINAL`.

Las entradas originales y límites de las referencias están documentados en [la auditoría NHL anterior](research/nhl-audit-2026-11-23/README.md). Sus resultados históricos se incluyen como contexto, con sus propios denominadores. No acreditan el efecto incremental de datos manuales, porque esos partidos anteriores carecen de snapshots manuales disponibles en sus decisiones.

## 2. Archivo disponible y trazabilidad

La ruta de investigación lee seis conjuntos archivados a un corte común:

| Archivo lógico | Tabla o fuente archivada | Filas del corte inicial | Uso |
|---|---|---:|---|
| `manual.json` | `nhl_manual_feature_snapshots_v1` | 14 | Inputs originales, reloj de persistencia, versión y procedencia |
| `predictions.json` | `nhl_free_predictions_v1` | 137 | Probabilidades DRatings y decisión original |
| `outcomes.json` | `nhl_free_outcomes_v1` | 130 | Finales oficiales y momento en que se observaron |
| `early.json` | `nhl_challenger_shadow_v1` | 57 | Contexto del Poisson temprano y disponibilidad de inputs |
| `late.json` | `nhl_late_shadow_v6` | 31 | Anclaje V6 y comparadores tardíos ya congelados |
| `directories.json` | Filas referenciadas de `nhl_free_source_v1` | 18 | Correspondencia previa entre ID NHL, abreviatura y nombre de equipo |

El adaptador verifica los bytes gzip/base64 del directorio oficial archivado, su SHA-256, la identidad de equipos y su disponibilidad anterior a la decisión. No adivina IDs a partir de nombres ni usa un boxscore posterior para certificar un cruce prepartido. Los duplicados idénticos se cuentan una vez; los conflictos se excluyen con motivo. Las versiones de resultados se conservan por hora de observación: un conflicto publicado después de una decisión anterior no elimina retrospectivamente una etiqueta que sí estaba disponible para entrenarla. Los cortes, incluidos los del manifest offline, preservan los microsegundos del reloj de PostgreSQL.

El lector pagina con orden estable, conteos exactos y límites por fuente: 20.000 snapshots manuales; 6.000 originales; 6.000 resultados; 4.000 early; 4.000 late. Los directorios se consultan por IDs referenciados, en grupos de hasta 50. Un límite superado, conteo cambiante o lectura incompleta impide publicar métricas parciales. Las páginas usan transacciones separadas: el corte y los conteos son controles de integridad, no una transacción serializable global.

La integridad del export se verifica mediante `manifest.json` y los hashes de sus seis archivos. El `source_snapshot_sha256` del snapshot manual identifica los bytes del dataset completo publicado por el Site. No es un hash de una nueva serialización del subconjunto `feature_payload`; por sí solo no permite reconstruir ni volver a certificar todos los archivos fuente.

### Disponibilidad temporal real

| Anclaje | Partidos manuales coincidentes | Con input manual disponible en su corte | Interpretación |
|---|---:|---:|---|
| Original DRatings | 7 | 0 | Sus capturas originales, cerca de 01:37Z, preceden las capturas manuales. |
| Poisson early | 7 | 0 | Sus congelaciones 11:07Z, 15:07Z o 18:07Z también preceden manual. |
| V6 tardío | 7 | 7 | Congelación común 22:07:27.520Z, unos 51,34 minutos después de la última captura manual. |
| Finales de esos siete | 7 buscados | 0 finales | No hay etiquetas para medir desempeño. |

Los dos runs manuales se generaron a 21:07:51.184Z y 21:15:28.761Z del 23 de noviembre. Sus persistencias ocurrieron a 21:14:57.028375Z–21:14:57.038380Z y 21:16:07.195510Z–21:16:07.202034Z, respectivamente. El trigger de almacenamiento acredita `available_as_of = inserted_at` con reloj del servidor. La generación de la fuente no retrofecha la disponibilidad en Pick.

Se conserva la última versión cuyo `available_as_of` e `inserted_at` sean anteriores o iguales a la decisión, con la misma identidad de evento, equipos e inicio. El evaluador conserva precisión de microsegundos en las fronteras temporales. Dos versiones del mismo partido nunca se convierten en dos observaciones independientes.

Al corte inicial, uno de los siete ya había alcanzado su inicio programado y seis seguían por comenzar. Las 14 capturas se persistieron antes de sus respectivos inicios. Esa disponibilidad histórica no significa que se esté ofreciendo una entrada prepartido en el momento actual.

### Dos anclajes que se mantienen separados

- **`strictOriginal`:** usa la decisión original DRatings. Solo admite inputs manuales ya persistidos en ese instante. En estos siete juegos no hay ninguno.
- **`lateResearchAnchor`:** conserva la probabilidad DRatings original, sin refrescarla, y la sitúa en el corte real de V6. Permite estudiar el aporte de información manual que llegó después del pronóstico original. No convierte el baseline en un nuevo pronóstico DRatings ni atribuye los inputs a su decisión temprana.

La cohorte tardía está condicionada por las reglas existentes de V6, incluida evidencia de probables ESPN y una ventana prepartido. Puede diferir del calendario NHL completo. Las comparaciones y sus denominadores se muestran por anclaje; no se mezclan para fabricar un total mayor.

## 3. Inventario completo de variables

La cobertura de esta tabla utiliza la última captura de cada partido: **7 partidos / 14 equipos únicos**. En el archivo completo hay **28 instancias de equipo** por sus dos versiones. Los valores de `teams` son idénticos entre ambas versiones de cada juego.

L10 contiene 140 referencias a **108 partidos históricos distintos**. Hay **42 filas equipo–período** y **64 apariciones de portero en 55 partidos**, repartidas entre 14 muestras. Esos conteos describen datos de entrada; no son observaciones independientes de rendimiento predictivo.

Las rutas de equipo parten de `feature_payload.teams.away` o `.home`. Un ratio 0–1 se multiplica por 100 solo para mostrarlo como porcentaje. “Declarado” identifica una afirmación del contrato; “consistente” identifica una comprobación posible con sus valores. Los agregados y marcas de cobertura no sustituyen los recibos raw de calendario, standings o boxscores.

| Variable / categoría | Rutas | Unidad | Fuente | Cobertura observada | Certificación y límite | En el contrato |
|---|---|---|---|---|---|---|
| Temporada: resultados y puntos | season.gp,w,l,otl,record,points,points_pct,rw,row | partidos; puntos; ratio 0–1 | Seed conservado; normalizador admite standings oficial o incremento certificado | 14/14 equipos; GP 20–25; puntos % 0.38–0.78 | Aritmética consistente 14/14. PRESERVED_SEED y captura de standings nula en 7/7 eventos. | Sí, salvo ranking y algunas columnas omitidas por la proyección de Pick. |
| Temporada: goles | season.gf,ga,gf_pg,ga_pg | goles; goles/partido | Marcador final acumulado del seed/standings | 14/14; GF/partido 2.5–3.826087; GA/partido 2.24–3.833333 | No incluye bitácora de todos los juegos de temporada ni sus capturas. | Sí; incluye marcador final, no una suma de solo 60 min. |
| Temporada: local/visitante | season.home_record,away_record | récord W–L–OTL; n derivable de cada récord | Condición oficial del juego en standings/seed | 14/14 | Suma de ambas condiciones concuerda con el récord total; sin medias GF/GA o tiros específicas por condición. | Sí en payload; no se muestra en el panel mínimo de Pick. |
| L10: identidad y secuencia | recent_event_ids; last10.gp,expected_event_ids,complete,sequence_verified,coverage,calendar_verified_through | IDs ordenados; conteo; booleanos; fecha | Historial oficial normalizado + calendario independiente, o secuencia del seed previamente verificada | 14/14 con 10 IDs; 140 referencias / 108 partidos distintos; todos hasta 22 nov | Los 10 IDs esperados coinciden en orden con los observados. Certificación declarada y consistente; el calendario raw no está en este export. | Sí; raw recent_games no está. |
| L10: récord | last10.w,l,otl,record | conteos y W–L–OTL | Resultados oficiales del historial reciente | 14/14; GP=10 | W+L+OTL=10 y récord consistente. El porcentaje de puntos L10 es derivable, no un campo persistido. | Sí. |
| L10: goles finales | last10.gf,ga,gf_pg,ga_pg | goles; goles/partido | Marcadores finales incluyendo OT/SO | 14/14; GF/partido 2.2–4.5; GA/partido 2.1–3.9 | Las medias concuerdan con sumas/10. La liquidación de un mercado requiere reglas propias. | Sí. |
| L10: goles físicos | last10.real_goals_for,real_goals_against,real_goals_for_pg,real_goals_against_pg | goles; goles/partido sin bono decisivo SO | Suma de períodos oficiales, incluyendo OT y excluyendo bonus de shootout | 14/14 | Suma P1–P3 <= goles físicos <= marcador final en todos. No confundir con GF/GA finales. | Sí en payload; no en proyección mínima de Pick. |
| L10: tiros | last10.shots_for_pg,shots_against_pg | SOG/partido | Tiros a puerta del boxscore oficial | 14/14; a favor 24.4–33.8; en contra 23.8–30.8 | No son intentos de tiro, Corsi o xG. Se conservan promedios, no conteos por partido en este contrato. | Sí; no tiros de temporada completa. |
| L10: período P1/P2/P3 | last10.periods[].period,gp,gf,ga,gf_pg,ga_pg,shots_for_pg,shots_against_pg,goals_coverage,shots_coverage | n; goles/partido en ese período; SOG/partido en ese período | Desglose oficial por período del historial reciente | 42/42 filas; n=10; cobertura de goles y tiros 10/10 en todas | Cobertura declarada completa y aritmética de goles consistente. No períodos de temporada, OT o SO. | Sí. |
| L10: local/visitante | last10.home_games,away_games,home_record,away_record | partidos y W–L–OTL | Condición oficial en la secuencia reciente | 14/14; local n=3–8; visita n=2–7 | Ambos subconjuntos suman 10; muestras desiguales, sin ajuste por fuerza de rivales. | Sí en payload; no en proyección mínima de Pick. |
| L10: fechas de ventana | last10.oldest_date,newest_date,calendar_verified_through | fecha ISO, sin hora | Fechas de los juegos seleccionados y corte de calendario | 14/14; último juego 21 nov; calendario declarado hasta 22 nov | Solo IDs y agregados: no se recertifica cada fecha/horario de los 108 juegos desde este payload. | Sí. |
| Descanso | rest.last_game_date,days_off,back_to_back,as_of_date,verified | días completos sin partido; booleanos; fecha | Diferencia de fechas de calendario menos 1, condicionada a secuencia verificada | 14/14; todos days_off=1, back_to_back=false, último juego 21 nov | Aritmética y estado consistentes; cero variación en esta tanda. No horas transcurridas, viaje ni fatiga. | Sí. |
| Power play | special_teams.pp_pct | ratio 0–1 (display ×100) | Snapshot oficial de equipos especiales | 14/14; 0.134831–0.341772 | Captura 23 nov 18:07:30.392Z; GP coincide; through_date=null. Sin oportunidades PP ni sus conteos. | Sí. |
| Penalty kill | special_teams.pk_pct | ratio 0–1 (display ×100) | Snapshot oficial de equipos especiales | 14/14; 0.607143–0.850747 | Mismo corte/limitación PP. Coincidir en GP no acredita por sí solo todo el rango de fechas. | Sí. |
| PP/PK: procedencia | special_teams.games_played,captured_at,through_date,is_current_gp_match,note | n; timestamp; fecha nullable; booleano | Metadata de snapshot oficial y comparación contra season.gp | GP/captura/flag 14/14; through_date 0/14 no nulo | Coinciden GP 20–25. El conteo de oportunidades y la fecha exacta de cierre no se conservan. | Sí; parte de metadata omitida en proyección. |
| Portero reportado | reported_goalie.name,status,provider_status,source_id,source_url,checked_at,source_time,notes | nombre; enum; URL; timestamp | Daily Faceoff 13 equipos; reporte Seattle 1 | Nombre/estado/consulta 14/14; hora original 4/14; 1 CONFIRMADO, 4 PROBABLE, 9 NO_CONFIRMADO | Ningún juego con ambos confirmados. El único CONFIRMADO es según DFO; official_announcement_verified=false. | Sí. |
| Portero: identidad | reported_goalie.player_id; recent_sample.appearances[].name | ID NHL opcional; nombre | ID explícito si existe; de lo contrario coincidencia exacta de nombre normalizado | player_id 0/14; nombres presentes en 14/14 | Las muestras actuales dependen del nombre; las apariciones no incluyen player_id. No equivalencia ESPN↔NHL implícita. | Nombre sí; ID ausente en la muestra real. |
| Portero: muestra y conteos | reported_goalie.recent_sample.scope,gp,ga,sa,saves,toi,oldest_date,newest_date,appearances[] | apariciones; goles; SOG; atajadas; minutos:segundos | Hasta 5 apariciones válidas dentro del L10 del equipo | 14/14; 10 muestras de 5, 2 de 4, 2 de 3; 64 apariciones / 55 juegos | Sumas, TOI, pertenencia a L10 y fechas consistentes. Incluye relevos con TOI>0; no necesariamente últimos 5 inicios ni toda la temporada. | Sí en payload; la proyección mínima de Pick lo omite. |
| Portero: SV% | reported_goalie.recent_sample.save_pct | ratio 0–1 = sum(saves)/sum(sa) | Agregado ponderado por tiros enfrentados | 14/14 | No promedio simple de porcentajes; titular incierto en 13/14. | Sí en payload. |
| Portero: GA/60 | reported_goalie.recent_sample.gaa_60 | goles/60 minutos = sum(GA)×3600/sum(TOI segundos) | Apariciones históricas válidas, sin bonus SO ni goles a red vacía imputados al portero | 14/14 | No GAA de temporada; denominador de tiempo y ventana distintos entre porteros. | Sí en payload. |
| H2H / serie actual | matchup.season_series | n, resultados, cobertura de serie | Visible en Site a partir de calendario/historial y reporte | 0/7 eventos: categoría no exportada | No inferir ausencia de enfrentamientos de una lista inexistente. Requiere archivo fuente separado con fecha/cobertura. | NO en feature_payload. |
| Lesiones / bajas | matchup.injuries,injuries_coverage | estados, fecha, cobertura | Reportes visibles en Site | 0/7 eventos: categoría no exportada | Lista ausente no significa equipo sano. | NO en feature_payload. |
| Ranking | team.rank,conference_rank,division_rank | posición | Clasificación del Site | 0/14 equipos: fuera de season | Puntos/GP/rw/row sí están; ranking exacto, liga completa y desempates H2H no. | NO en feature_payload. |
| Mercados y reglas | matchup.markets,prices,lines,book,contract flags | cuotas; goles; lado; reglas; timestamp | Capturas de referencia mostradas en Site | 0/7 eventos: no hay cuotas/lineas | provenance.markets_captured_at existe pero no contiene cotización; no permite calcular EV/ROI o liquidar. | NO; requiere unión temporal a snapshots de mercado. |
| Historial detallado | recent_games; games; raw PBP/boxscore; skaters | filas de partido/jugador | Archivos oficiales normalizados visibles en historial Site | 0 filas de equipo por juego en contrato; sí IDs L10 y submuestra de portero | No se recalculan tiros/períodos ni se recertifica calendario completo solo con los agregados. | NO; excepción: apariciones de portero incluidas. |
| Lecturas de análisis del Site | analysis-dashboard selection/factors/reasons | regla descriptiva y texto | Coincidencia de líderes en puntos temporada, puntos L10 y balance de goles L10 | 0 selecciones/probabilidades persistidas; forecast_probability=null en 14/14 snapshots | Puede derivarse la regla central; no reproducir elegibilidad íntegra sin recent_games/contexto. No es modelo probabilístico validado. | NO se exportan las lecturas; inputs centrales sí. |

### Disponibilidad no equivale a uso o validación

La proyección mínima de Pick omite récords según condición, goles físicos y la muestra estadística del portero, aunque esos campos están en el payload original. No es necesario volver a capturarlos para saber que existen. H2, H3 y H4 usan solo los campos especificados más abajo; tener períodos, H2H en el Site o estadísticas de un portero no los introduce automáticamente en una probabilidad.

H2H, lesiones, rankings, mercados y el historial completo de equipo por partido sí quedan fuera del contrato. Una lista ausente de H2H no prueba cero enfrentamientos; ausencia de lesiones no prueba una plantilla sana; `markets_captured_at` no es una cuota, línea ni regla de liquidación. Cualquier incorporación posterior necesita un contrato y reloj de disponibilidad propios.

### Procedencia de temporada: bloqueo H1

**Las 14 capturas de los siete juegos tienen `standings_method=PRESERVED_SEED` y `standings_captured_at=null`.** Todos declaran corte al 22 de noviembre y `standings_current=true`. Sus valores cuadran aritméticamente, pero el flag `current` solo compara la fecha declarada con la esperada. No demuestra una captura primaria fechada de los standings.

H1 exige `standings_method=OFFICIAL_STANDINGS` y captura primaria explícita anterior a la generación del snapshot. Rechaza `PRESERVED_SEED`, `SEED_PLUS_VERIFIED_OFFICIAL_FINALS` y métodos no reconocidos. Por tanto, su cobertura observada de números es 14/14 equipos y su disponibilidad certificada para el ajuste es **0/7 partidos**. No se rellena el reloj faltante con la fecha de generación ni con la disponibilidad de otra fuente.

### L10, tiros y la corrección previa

Los 14 equipos declaran diez eventos únicos, `complete=true`, `sequence_verified=true` y calendario hasta el 22 de noviembre. Los diez IDs esperados coinciden en orden con los observados y no incluyen el evento objetivo. Las 42 filas P1/P2/P3 declaran cobertura 10/10 en goles y tiros. La auditoría local comprobó aritmética y coherencia de los datos presentes; no rehízo desde el export manual el calendario independiente ni todas las estadísticas raw.

La discrepancia de tiros documentada en PR #399 ya fue corregida: en `nhl:2026020342`, los 27 tiros de Vegas son 26 de patinadores más un tiro ofensivo del portero Adin Hill. La evidencia tirador–portero ya archivada conserva su hora original; no se suma `shotsAgainst` ni se vuelve a sumar un gol ya incluido en `shots`. La corrección y sus límites están en [la auditoría anterior](research/nhl-audit-2026-11-23/README.md) y [su evidencia específica](research/nhl-audit-2026-11-23/goalie-shot-correction.json). No se presenta aquel falso positivo como una brecha todavía abierta. H2 conserva sus propias exigencias de cobertura y tiempo del contrato manual.

### Porteros y descanso en esta tanda

En la última captura hay **1 portero CONFIRMADO según DFO, 4 PROBABLE y 9 NO_CONFIRMADO**. Trece reportes provienen de DFO y uno del sitio de Seattle. El único confirmado conserva `official_announcement_verified=false`; ninguno de los siete juegos tiene ambos porteros confirmados. Solo cuatro de los 14 reportes incluyen la hora original del anuncio, aunque los 14 conservan hora de consulta.

Los 14 tienen muestra numérica reciente: diez muestras de cinco apariciones, dos de cuatro y dos de tres. Los 14 carecen de `player_id`; las apariciones tampoco incorporan ese ID. La identidad depende del nombre normalizado y no acredita por sí sola un titular. **Los porteros se incluyen en el inventario, pero no entran en H1–H4.** No se sustituye el nombre reportado por el titular observado después del partido.

Los 14 equipos tienen `days_off=1` y `back_to_back=false`; la diferencia local–visitante es exactamente cero en los siete encuentros. H4 está observada y es consistente con las fechas, pero esta tanda no contiene variación para identificar un efecto del descanso. Un cero observado se conserva; un descanso desconocido no se imputa como cero.

## 4. Hipótesis registradas

Todas las orientaciones son **local menos visitante**. `GD` significa goles a favor menos goles en contra por partido; `SOGD` significa tiros a puerta a favor menos tiros a puerta en contra por partido. Las cuatro hipótesis se ajustan y reportan separadas. H1 tiene dos columnas de una misma hipótesis; no combina H2, H3 o H4.

| Hipótesis | Definición fija | Unidad y requisito | Estado en los siete anclajes tardíos |
|---|---|---|---|
| H1 — temporada y cambio L10 | `x1 = GD_home,season − GD_away,season`; `x2 = (GD_home,L10 − GD_away,L10) − x1` | Dos columnas en goles oficiales por partido. Captura primaria de standings, temporada vigente y secuencia L10 completa verificable. | 0 disponibles; `SEASON_PRIMARY_CAPTURE_UNVERIFIED` por semilla preservada sin captura. |
| H2 — tiros netos L10 | `x1 = SOGD_home,L10 − SOGD_away,L10` | SOG/partido. Diez eventos verificados, captura del historial anterior y cobertura de tiros 10/10 en P1, P2 y P3. | 7 disponibles; cero finales/entrenamiento elegible. |
| H3 — emparejamiento PP/PK | `x1 = (PP_home + 1 − PK_away)/2 − (PP_away + 1 − PK_home)/2` | Diferencia de proporciones. PP/PK entre 0 y 1, captura explícita anterior y GP coincidente con temporada. | 7 disponibles; cero finales/entrenamiento elegible. |
| H4 — descanso | `x1 = days_off_home − days_off_away` | Días naturales completos sin jugar. Calendario y fechas verificados, B2B coherente. | 7 disponibles, todos con `x1=0`; cero finales/entrenamiento elegible. |

H1 usa goles del marcador final tanto en temporada como en L10, incluyendo el punto decisivo de shootout. Los campos `real_goals_*` excluyen ese bono y sirven para otro objetivo; no se sustituyen silenciosamente. Los promedios P1–P3 no representan la temporada ni el partido con OT/SO completo.

H3 es un contraste descriptivo de tasas: sus componentes están en [0,1] y la diferencia puede ser negativa, dentro de [−1,1]. No es una probabilidad de anotar en el próximo power play: el contrato no incluye los números de oportunidades PP/PK, y `games_played` no es ese denominador. Las capturas actuales tienen GP coincidente, pero `through_date=null` en 14/14 equipos. El ajuste deja ese límite explícito.

No se crean variantes combinadas, rejillas de parámetros, ventanas alternativas ni una hipótesis ganadora escogida por el resultado. Cualquier cambio a estas definiciones necesita una nueva versión y una separación clara respecto de los resultados ya examinados.

## 5. Modelo y control

Sea `p_i` la probabilidad DRatings original de victoria local y `y_i` el resultado final, 1 si gana el local y 0 si gana el visitante. Para cada hipótesis:

```text
Control:   q0_i = sigmoid(logit(p_i) + alpha0)
Candidato: qH_i = sigmoid(logit(p_i) + alphaH + betaH · zH_i)
```

El coeficiente del offset `logit(p_i)` queda fijo en uno. Ambos interceptos se estiman sin penalización, cada uno sobre exactamente los mismos partidos de entrenamiento de esa hipótesis. Así, la comparación candidato contra control separa el aporte de la variable del simple ajuste global de calibración. El candidato también se compara con DRatings sin ajustar.

La función objetivo es la **suma** de pérdidas logarítmicas Bernoulli más `10/2 × sum(beta_feature²)`. El valor ridge es **10**, fijo. No se penaliza el intercepto y no se elige el ridge mirando resultados. El signo de cada coeficiente lo aprende el entrenamiento; no se asigna a mano una ventaja a quien tenga mayor valor de una estadística.

Cada columna se estandariza con media y desviación estándar poblacional calculadas **solo en el entrenamiento anterior**. Si una columna carece de variación, queda inactiva; si todas las columnas de la hipótesis son constantes, no se ajusta ese candidato y se registra `NO_TRAINING_FEATURE_VARIATION`. Las estadísticas de estandarización y los coeficientes quedan en el informe. No se recalculan incluyendo al partido evaluado.

El ajuste exige al menos **40 partidos anteriores elegibles de esa misma hipótesis** y resultados de ambas clases: victorias locales y visitantes. Cuarenta es un mínimo técnico para intentar el ajuste; no es evidencia de mejora ni un criterio de aprobación. Si faltan historia, clases, variación o convergencia numérica, la probabilidad candidata queda nula con un motivo explícito.

## 6. Evaluación temporal por partido y jornada

Para cada decisión objetivo, el evaluador construye su entrenamiento sin usar su resultado ni otro posterior:

1. Selecciona el snapshot manual disponible al corte y valida contrato, identidad, horarios, cobertura y unidades de las variables usadas.
2. Excluye el partido objetivo y cualquier decisión futura. Usa únicamente partidos de **fechas Puerto Rico anteriores a la fecha de la decisión**, sin entrenar con otros juegos de esa misma jornada.
3. Vuelve a resolver cada resultado al corte de la decisión. El final debe haberse observado y estar disponible **estrictamente antes** del anclaje; no basta con que el partido ya figure final en el export más reciente.
4. Agrupa por jornada PR. Si una fecha previa contiene un evento elegible de la cohorte archivada aún sin final disponible, excluye toda esa fecha del entrenamiento de la hipótesis. Esa completitud se refiere al archivo de la variante, no al calendario de toda la NHL.
5. Con las fechas completas anteriores, comprueba mínimo de 40 partidos, ambas clases y variación; calcula estandarización y ajusta control/candidato. Evalúa el objetivo solo cuando tenga un final válido al corte del informe.

Este avance temporal evita divisiones aleatorias que mezclen un mismo día o versiones de un mismo evento entre entrenamiento y evaluación. Los IDs, fechas de entrenamiento, máximos tiempos de observación y disponibilidad, fechas incompletas excluidas, hash y clave manual permiten revisar cada intento.

Los subconjuntos de H1–H4 pueden diferir por cobertura. Dentro de cada hipótesis, el baseline, control y candidato se comparan sobre **los mismos partidos puntuables**. No se usa la exactitud de un grupo amplio contra la de otro grupo distinto como prueba de aporte de una variable.

### Métricas y confianza

Se conservan número de juegos, aciertos, accuracy, Brier, log loss, probabilidad media y tasa observada de victoria local. Accuracy usa victoria local a `p >= 0.5` y registra empates exactos del umbral. Los intervalos de accuracy son Wilson al 95%. Brier y log loss menores indican mejor puntuación probabilística; accuracy mayor indica más lados acertados.

Las diferencias pareadas son **candidato menos referencia**: negativo favorece al candidato en Brier/log loss; positivo en accuracy. Se remuestrean los eventos emparejados con 2.000 réplicas, semilla fija registrada, y se muestra además una sensibilidad por bloques de fecha PR. No son dos muestras independientes ni dos validaciones distintas. Con menos de dos eventos o fechas, el intervalo correspondiente queda nulo; pocas fechas, solapamiento de L10 y equipos repetidos limitan la inferencia aun cuando exista un intervalo numérico.

La calibración se presenta en intervalos fijos `[0,0.4)`, `[0.4,0.5)`, `[0.5,0.6)`, `[0.6,0.7)` y `[0.7,1]`. Un intervalo vacío mantiene `games=0`, probabilidades y tasa observada nulas. No se eligen cortes después de mirar resultados.

Las cuatro hipótesis, las dos referencias de cada una y las métricas relacionadas generan comparaciones múltiples. Los intervalos descriptivos al 95% no controlan automáticamente esa multiplicidad ni prueban una ventaja. Una revisión confirmatoria posterior debe especificar la familia de comparaciones y cómo ajustará su confianza, o usar un nuevo holdout temporal con una hipótesis congelada. Este protocolo no añade un umbral rígido de significancia que convierta un resultado aislado en promoción.

## 7. Resultados iniciales y exclusiones esperadas

| Componente | Resultado del corte |
|---|---|
| Disponibilidad original estricta | 0/7 juegos manuales en el corte original |
| Disponibilidad al anclaje tardío | 7/7 juegos; una última versión por evento |
| Finales para juegos manuales | 0/7 |
| H1 | Variables numéricas observadas, pero 0 elegibles por procedencia primaria ausente |
| H2 / H3 / H4 | 7 inputs elegibles por hipótesis; 0 finales, 0 partidos previos elegibles de entrenamiento |
| Variación H4 en los siete juegos | Ninguna: local y visitante tienen un día de descanso |
| Candidatos ajustados, emitidos o puntuados | 0 |
| Acierto / Brier / log loss / diferencias de candidatos | `null`, con denominadores 0 y razones explícitas |
| Mejora validada / promoción | `false` / `false` |

Estos siete inputs no alcanzan las 40 observaciones anteriores requeridas, incluso cuando sus siete resultados se conozcan. La disponibilidad numérica y la ausencia de inconsistencias aritméticas no permiten inferir aporte predictivo.

Las exclusiones se conservan por evento y ámbito, con código y descripción. Los principales motivos son ausencia de snapshot al corte, identidad o directorio sin acreditar, duplicados en conflicto, fuente futura, historia incompleta, temporada sin captura primaria, unidades PP/PK inválidas, descanso inconsistente, final ausente y entrenamiento insuficiente. No se sustituye una versión posterior inválida por una historia reconstruida para mejorar la muestra.

El lector manual de presentación valida sobre todo estructura y disponibilidad. El evaluador añade comprobaciones semánticas de las variables que usa: ventanas, fechas, unidades, tasas y procedencia. El inventario comprobó con mutaciones sintéticas en memoria que aceptación estructural no basta para certificar aritmética de temporada, escala PP/PK o coherencia de descanso. Esas mutaciones no se escribieron y no son defectos observados en las capturas reales. Las estadísticas de portero no se modelan, de modo que su aceptación descriptiva tampoco equivale a un gate de identidad o titularidad aprobado.

## 8. Reproducción, API y artefactos

El adaptador [`nhl-manual-ml-archive.mjs`](../src/lib/nhl-manual-ml-archive.mjs) normaliza y une el archivo. El evaluador puro calcula los informes sin consultar proveedores. El CLI [`nhl-manual-ml-research.mjs`](../scripts/nhl-manual-ml-research.mjs) usa modo offline por defecto y verifica arrays, cantidades y SHA-256 contra el manifest. Los flags siguientes corresponden a ese archivo; no hay un flag de entrenamiento, publicación o promoción.

### Reproducir el corte inmutable

Desde la raíz del repositorio, con el export de seis archivos de esta sesión disponible:

```sh
node scripts/nhl-manual-ml-research.mjs \
  --input /workspace/scratch/77aca471d40b/nhl-manual-evidence \
  --cutoff 2026-11-24T00:05:15.236207Z \
  --output docs/research/nhl-manual-ml-2026-11-23/report.json \
  --exclusions-output docs/research/nhl-manual-ml-2026-11-23/exclusions.json
```

En otro entorno, `--input` debe apuntar a una copia íntegra del mismo export, que contenga `manifest.json` y `manual.json`, `predictions.json`, `outcomes.json`, `early.json`, `late.json`, `directories.json`. Si se proporciona `--cutoff`, debe coincidir exactamente con el del manifest. Un hash, conteo o corte discordante aborta sin producir un informe parcial.

### Nueva lectura de tablas existentes

El modo explícito `--live` necesita las credenciales de servidor ya configuradas en `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; no imprime sus valores. Hace solo SELECT sobre el archivo existente, sin llamar a NHL, DRatings, ESPN o DFO. Ejemplo con destinos locales elegidos para esa nueva lectura:

```sh
node scripts/nhl-manual-ml-research.mjs \
  --live \
  --export-input /ruta/nueva/export-nhl-manual \
  --output /ruta/local/nhl-manual-ml/report.json \
  --exclusions-output /ruta/local/nhl-manual-ml/exclusions.json
```

`--live` y `--input` son excluyentes. `--export-input` es opcional y sus archivos se crean exclusivamente, sin sobrescribir exports existentes. Las salidas `--output` y `--exclusions-output` son archivos locales; ninguna modalidad escribe predicciones, resultados o snapshots en base. Sin `--cutoff`, live fija el corte antes de leer.

### Consulta del informe

`GET /api/nhl/manual-ml-research` usa el mismo adaptador y evaluador sobre seis conjuntos. No acepta un payload de entrenamiento ni publica probabilidades en el sistema activo. Devuelve `readOnly: true`, `providerCalls: 0`, `databaseWrites: 0`, `predictionAdjustment: false`, `modelPromoted: false` y los dos anclajes separados.

El servicio limita la lectura a 40 segundos y reutiliza durante tres minutos un informe ya leído, con su corte explícito; solicitudes concurrentes comparten la lectura en curso. La respuesta HTTP usa `Cache-Control: private, no-store`. Ante error o límite de fuente devuelve HTTP 503, estado `READ_UNAVAILABLE` o `SOURCE_SCAN_CAPPED` y explicación, sin cohortes parciales. Los estados del evaluador distinguen entrada no verificable, archivo vacío, variable no acreditada, historia final insuficiente, entrenamiento insuficiente y reconstrucción descriptiva disponible.

### Evidencia de esta entrega

| Archivo | Contenido |
|---|---|
| [report.json](research/nhl-manual-ml-2026-11-23/report.json) | Cortes, inventario de joins, ambos anclajes, hipótesis, intentos, métricas, motivos y límites |
| [input-manifest.json](research/nhl-manual-ml-2026-11-23/input-manifest.json) | Cantidades y hashes del export inmutable de seis fuentes |
| [exclusions.json](research/nhl-manual-ml-2026-11-23/exclusions.json) | Exclusiones del adaptador y del evaluador por anclaje/evento |
| [README.md](research/nhl-manual-ml-2026-11-23/README.md) | Lectura de los resultados y contexto de la entrega |
| [validation.json](research/nhl-manual-ml-2026-11-23/validation.json) | Evidencia de pruebas y verificaciones efectivamente ejecutadas |

La documentación del protocolo no declara aprobadas pruebas, build o una vista previa por sí sola. Los resultados ejecutados y su código de referencia pertenecen a `validation.json`. Tampoco crea cron, tareas recurrentes, escritores, promociones o cambios al Site.

## 9. Qué evidencia permitiría continuar

**Primero, historia válida.** Cada hipótesis necesita al menos 40 eventos anteriores elegibles, finales disponibles antes de cada decisión, ambas clases y variación de la señal. H1 necesita además un nuevo snapshot con captura primaria de standings acreditada; no basta con esperar resultados de los siete actuales. Los datos viejos no se retrofechan ni se completa una captura perdida con valores posteriores.

**Después, una revisión inicial fuera del entrenamiento.** Se propone revisar por primera vez cuando exista al menos una tanda de **30 juegos puntuables fuera de entrenamiento**, distribuida en varias fechas PR y con conteos visibles por fecha. Ese número es una condición práctica de revisión, no una demostración de potencia, estabilidad o superioridad. Se revisan conjuntamente Brier, log loss, calibración, accuracy, tamaño del efecto, intervalos, exclusiones, denominadores y sensibilidad a jornadas/equipos. Cada hipótesis conserva su propio conjunto emparejado.

**Una señal favorable debe sobrevivir a la selección.** No elegir la mejor de cuatro curvas y presentar su intervalo nominal como confirmación. La revisión debe distinguir hallazgos exploratorios de una prueba confirmatoria, tratar las comparaciones múltiples y explicar la dependencia entre ventanas solapadas, jornadas y equipos. Una mejora media muy pequeña, inestable entre fechas o explicada solo por el intercepto no acredita aporte de la variable.

**El nuevo holdout prospectivo será otra etapa.** Requiere fijar antes de sus resultados una hipótesis, fórmula, versión, cortes y calendario de evaluación; emitir y guardar una probabilidad candidata real antes de cada evento; conservar registro inmutable y revisar luego sin reajustar sobre ese holdout. La autorización futura necesaria sería para ese escritor de candidatos. Este trabajo no instala ni solicita un cron y no realiza esas escrituras.

Ningún mínimo de muestra, intervalo favorable o estado `DESCRIPTIVE_REPLAY_AVAILABLE` promueve automáticamente una variante. La decisión futura debe apoyarse en evidencia independiente, cobertura suficiente, estabilidad temporal y revisión explícita. Mientras tanto, el resultado operativo de esta investigación es un informe reproducible de lectura con límites claros, y la probabilidad activa conserva su contrato original.
