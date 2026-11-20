# Pick Analyzer · Auditoría de datos del 20 de noviembre de 2026

## Dictamen

El Decision Board NBA de producción permitió congelar un prop de Jamal Shead con diez observaciones que omitían tres partidos más recientes. La cuota y la línea tenían recibo. La tabla compacta aún no había materializado los tres originales. La rama reproduce el incidente, bloquea esa selección, muestra los encuentros responsables y conserva el pronóstico histórico. Encontramos además un partido completo ausente, dos rebotes contradictorios y contratos cuyo alcance de prórroga sigue sin verificarse.

El control NBA está implementado en esta rama. La certificación integral sigue abierta. En otros deportes comprobamos tablas, capturas, identidades, liquidación y registros prospectivos con distintos niveles de detalle. El componente compartido exige evidencia antes de destacar una oportunidad. Faltan adaptadores de origen y validación prospectiva para certificar cada deporte y cada pantalla heredada. Producción sigue bajo su versión anterior.

## Método y alcance

- Base Git `61ed75d8145f41bb8a2e116a91c31491513fce6f`. Proyecto Supabase `ynuocvexviorgdjrfthw`. Vercel `pick-analyzer`, despliegue de producción observado `dpl_4mjsCRqDjp9ZWqMtgMGGd4saCt7C` en READY. Se revisaron los 13 crons configurados y su separación por rama. Una muestra de una hora registró ejecuciones de Edge Lab, Soccer, NBA y NHL. Dos entradas de error iniciales de dashboard carecen de diagnóstico causal. Una consulta posterior entre 18:43 y 19:43 PR no devolvió errores. La retención disponible limita las conclusiones.
- 463 tablas, 21 vistas, 26 vistas materializadas y 85 funciones públicas, dos buckets y 48 Edge Functions registradas. El inventario de aplicación incluye 608 entradas de página/API y 88 archivos de workflows. La presencia de una ruta o función no demuestra ejecución. Los catálogos asociados enumeran los nombres individualmente.
- Los cortes del incidente son las 19:00 y las 19:15 de Puerto Rico (UTC−4). Las consultas del inventario se ejecutaron mientras los crons habituales continuaban trabajando. La cohorte con corte explícito a las 19:15 tiene 474 registros congelados en 13 partidos. Un segundo control operativo, después del cron de las 19:35, tiene 708 en esos 13 partidos. Los dos conteos llevan su contexto en la evidencia.
- Se consultaron metadatos, JSON y registros originales ya guardados, filas derivadas, definiciones y logs mediante lecturas. Las verificaciones externas usaron páginas públicas. El ensayo local usa una instalación de Next con datos del incidente y credenciales de prueba. Los efectos de escritura se prueban en funciones puras y dobles locales. La consulta final de la fila congelada reprodujo su huella inicial.

[Catálogo de la base](database-catalog.md) · [Rutas, crons y lectores de features](routes-and-features.md) · [SQL de evidencia](evidence.sql) · [Resultados observados y dos replays](observations.json) · [Consultas de salud](health.sql)

## Trazabilidad del incidente

| Corte PR | L5 AST | L10 AST | Proyección | Efecto |
|---|---:|---:|---:|---|
| Freeze real 11:35:09 | 8.8 | 7.1 | 8.21 | V1 registró Over 4.5 a −160 |
| Replay anterior 19:00, algoritmo previo | 8.8 | 7.1 | 8.21 | Las filas antiguas ocupaban el lugar de tres partidos ausentes |
| Replay 19:00 con protección | — | — | — | INCOMPLETE_HISTORY, PASAR, excluido del Top y del plan de freeze |
| Replay 19:15 con protección | 5.4 | 7.2 | 6.03 | Descriptivo, PARTIAL, PASAR. La cuota de esta muestra era −158 |

| Partido anterior de Toronto | ID GOAT | AST | Incorporación a la tabla el 20 nov, hora PR |
|---|---:|---:|---|
| 15 nov | 21718114 | 4 | 19:03:04 |
| 17 nov | 21718126 | 6 | 19:03:08 |
| 18 nov | 21718136 | 6 | 19:03:10 |

Orden descendente de los diez partidos elegibles: **6, 6, 4, 5, 6, 11, 16, 6, 6, 6**. L5 = 27/5. L10 = 72/10. Para asistencias, la fórmula existente da 0.65 × 5.4 + 0.35 × 7.2 = 6.03. Las diez cifras coinciden con fuentes NBA públicas. El replay del motor cotejó cuatro de diez con box scores operacionales y seis mediante recibo y manifiesto. La comprobación manual independiente no se inyecta como permiso de publicación en el motor. El contrato guardado indica `FULL_GAME_LABEL_OT_UNVERIFIED`. El replay de este caso no añadió un recibo de disponibilidad confirmada.

La orden de investigación congelada es `687c202e313d6ca8f9beffe660d1d645f16df1af53e910c08501441d1fe78c79`. El MD5 de la serialización JSONB de la fila fue `55eb0c114238577d4e8023f29b3968af` en ambas consultas. Se preservan los valores de V1 y la hora a la que realmente estaban disponibles. Luka Dončić (triples) pasó de 4.8/5.8 a 4.0/5.1 y Quentin Grimes (PRA) de 14.2/13.2 a 27.0/20.8. Estos dos recálculos provienen del archivo interno.

[Últimos cinco de Shead, NBA](https://cdn-uat.nba.com/player/1642347/jamal-shead/profile) · Actas oficiales de [9 nov](https://statsdmz.nba.com/pdfs/20261109/20261109_MEMTOR.pdf), [6 nov](https://statsdmz.nba.com/pdfs/20261106/20261106_TORMIL.pdf), [4 nov](https://statsdmz.nba.com/pdfs/20261104/20261104_TORDEN.pdf), [2 nov](https://statsdmz.nba.com/pdfs/20261102/20261102_TORLAC_book.pdf) y [1 nov](https://statsdmz.nba.com/pdfs/20261101/20261101_TORLAL.pdf).

## Flujo real y puntos de pérdida

| Etapa | NBA | Otras implementaciones y riesgos |
|---|---|---|
| Proveedor → captura | BALLDONTLIE/GOAT (historial, FanDuel, calendario y contexto), HoopsAPI (mercados por período) | ESPN, NHL, DRatings, football-data.co.uk, nflverse, PulseScore/Tipsport, NetBet, SportsAPI.app, RapidAPI Tennis, API-Sports y los proveedores de archivo MLB tienen contratos distintos. Se verificó presencia de configuración de The Odds API y SportsDataIO. Las credenciales no acreditan suscripción activa ni costo por llamada. |
| Captura → almacenamiento | JSON de calendario, mercados y contexto; bucket privado de temporada y manifiesto con hash | Tablas de fuentes por liga o por Edge Lab, archivos Git e históricos MLB. Una página parcial, un cursor omitido, límites globales o una captura repetida pueden ocultar partidos. |
| Validación → transformación | Temporada, ID del evento y equipos, fecha PR y UTC, fecha del partido y del recibo, manifiesto, hash y datos de box score → tabla por jugador/partido | Identidades intercambiadas, traspasos, cambios de horario y finales corregidos requieren reglas propias del deporte. Un DNP o una columna nula cambian el denominador. |
| Modelo → predicción | Ventanas del jugador, puntuaciones de ambos equipos y por período, pesos existentes, precio archivado → proyección descriptiva SHADOW | NCAAB usa perfil de temporadas anteriores identificado en el modelo. NHL, NFL, UFC y Edge Lab tienen cohortes y reglas de elegibilidad distintas. Se documentan modelos por rol y versión en los resultados. |
| Predicción → Decision Board | Contrato, timestamp y ventana al corte → clasificación, razón, pestañas y Top 25. Endpoint de lectura con no-store | El Top compartido requiere evidencia explícita. Otros paneles especializados y métricas heredadas no quedan certificados por este cambio. |
| Liquidación → accuracy → aprendizaje | Forecast inmutable + final posterior → recibo de resultado estadístico → métricas por versión, mercado y partidos independientes → investigación | Indicadores por contrato pueden sobreponderar un partido. Un recibo, una cuota y un resultado estadístico tienen significados distintos. Modelos y liquidaciones oficiales permanecen fuera de las escrituras de esta auditoría. |

## Matriz por deporte

Horas PR del último proceso observado el 20 de noviembre, salvo fecha indicada. Las columnas de pronósticos y recibos cuentan el universo específico de cada fila. Las abstenciones, resultados disputados y partidos futuros limitan el uso de esos conteos como medidas de desempeño.

| Deporte y fuente | Cobertura e integridad observadas | Captura/proceso, pronóstico y liquidación | Protección de la rama y pendiente |
|---|---|---|---|
| NBA · GOAT, HoopsAPI | 6,463 claves únicas jugador/partido/temporada, 225 juegos del 20 oct al 19 nov PR; 225 manifiestos con objeto y conteo concordante. En la muestra 2–19 nov, 108 de 109 finales tuvieron archivo de jugadores. | Props completado 19:30; proceso histórico 18 nov. 474 freezes/13 juegos antes de 19:15; 169 props/11 juegos, 0 recibos de props, 119 recibos de otros mercados. | Adaptador de calendario, originales, precio, disponibilidad, ranking, UI y nuevo freeze. Quedan cobertura de originales, reglas OT, recepción de alineaciones y certificación del resto de motores NBA. |
| NHL · NHL oficial, DRatings | 125 pronósticos/125 juegos, 111 con recibo; 0 desacuerdos de lados y 0 recibos imposibles en esa unión. | PASS 19:37; Poisson SHADOW 45 juegos, V6 11. Muestra pública Dallas 4–Vegas 3 en shootout. | Top compartido conservador. Faltan validación por portero confirmado y contrato con/sin shootout, cobertura independiente y holdout V6. |
| NCAAB · ESPN, perfil versionado | 863 pronósticos/863 juegos, 763 recibos. 11 inversiones exactas local/visitante, 1 cambio de participante y 1 recibo anterior al inicio congelado. | PASS 18:00; cuatro pronósticos antiguos sin recibo en el control de 48 h. SHADOW adicional de 52 juegos. Muestra Virginia Tech 87–Northwestern 70. | Reconciliador existente normaliza inversiones, revisa identidades y tiempos corregidos; faltan resolución individual y auditoría de líneas universitarias y disponibilidad. |
| NCAAF · ESPN FBS | 594 registros de la cohorte PPG, 198 partidos, 342 recibos/114 juegos, 18 registros en disputa/6 juegos. | PARTIAL 12:33; las 51 filas antiguas sin recibo en la muestra eran abstenciones. Rice 31–Temple 27 coincide. | Top compartido; coeficientes PPG exploratorios, cobertura QB/clima y validación de mercados pendientes. |
| Soccer · football-data.co.uk y ESPN | 42 pronósticos/21 partidos de LaLiga, 20 recibos de pronóstico. Alcance de 90 minutos + descuento en el código. | SUCCESS 19:15. Última fila del libro de la fuente CSV, 9 nov; la fecha del proceso por sí sola no establece cobertura del CSV. Athletic 0–Espanyol 1 coincide. | Top compartido; cotejo exhaustivo calendario por competición, última jornada y contrato pendiente. |
| Table Tennis · PulseScore/Tipsport, NetBet; SportsAPI.app para resultados | 4,368 filas/1,456 eventos, 849 resultados de mercado/283 eventos. 110 eventos accionables con >48 h sin final, 330 filas en tres mercados. | PARTIAL 13:00; último FAILED observado el 18 nov. | Top compartido. Pendientes emparejamiento de participantes, formato de los sets y recibos de finales dentro del presupuesto existente. |
| UFC · ESPN | 47 filas/26 combates, 20 filas asociadas a 10 finales; 0 ganadores ajenos y 0 fallas temporales en esta unión. | PARTIAL 17:49. El resultado público Gane–Hokit respalda la muestra consultada. | Investigación; confirmar cobertura completa del cartel y contrato específico antes de destacar resultados. |
| ATP/WTA · Tennis RapidAPI | Captura del 20 nov con 2 ATP y 0 WTA, sin historial suficiente ni predicciones con precio en el libro gratuito inspeccionado. | Recibo OK 19 nov 20:13 PR; sin cohorte prospectiva liquidable demostrada. | Identidad de fixture y horario probados en regresión. Pendientes cobertura histórica y contratos, independientes para ATP y WTA. |
| NFL · nflverse, libro free-sports | 42 pronósticos/42 juegos, 15 con recibo. La tabla deportiva heredada y el libro dedicado cubren intervalos diferentes. | OK 17:39; Houston 26–Indianapolis 3 coincide con la fuente del equipo. | Faltan validación por mercado, disponibilidad, localía y muestra prospectiva independiente. |
| MLB · Retrosheet, StatsAPI, Statcast y archivos BDL/SDIO | Libro maestro 2026: 919 decisiones/201 juegos del 15 sep al 28 oct, 917 con fecha de liquidación. Retrosheet histórico se identifica por temporada. | Pausado para la temporada; último proceso Edge Lab observado el 4 nov. El libro contiene múltiples motores, campeones y candidatos. | Regresiones MLB ejecutadas. Pendiente reconciliación por contrato y revisión previa a la próxima temporada. |
| BSN · API-Sports | Archivo por temporadas 2022–25; cuatro recibos OK y cuatro ERROR en el libro inspeccionado. | Último recibo 11 nov. Hay datos heredados y no se acreditó un motor prospectivo vigente. | Archivo en desarrollo. Cobertura de calendario y revalidación de errores pendientes. |

Muestras externas: [NHL](https://www.nhl.com/news/dallas-stars-vegas-golden-knights-game-recap-november-19-2026), [Rice](https://riceowls.com/sports/football/stats/2026/temple/boxscore/28823), [LaLiga](https://www.laliga.com/en-CA/clubs/athletic-club/results), [NFL](https://www.houstontexans.com/team/players-roster/c-j-stroud/logs/2026/reg/), [UFC](https://www.ufc.com/news/polymarket-ufc-334-gane-vs-hokit-results), [Reuters NCAAB](https://www.reuters.com/sports/basketball/virginia-tech-takes-down-northwestern-with-3-point-accuracy--flm-2026-11-20/).

## Contrastes adicionales de fuentes y métricas prospectivas

Se enlazó cada predicción con su recibo de entrada en NHL (125), NCAAF (594), NFL (42), Table Tennis (4,368) y UFC (47 actuales + sus 47 recibos de historial). Todos los enlaces existían. Ningún recibo de esas poblaciones fue posterior a la emisión ni al inicio del evento. Para las liquidaciones, las 111 NHL, 763 NCAAB, 10 UFC y 15 NFL conectaban con fuentes registradas antes o en el momento de observar el resultado.

En NCAAB, 73 de 863 recibos locales de origen se crearon después de los juegos. Se investigó la excepción directamente. Los 73 pronósticos originales están en un commit del 15 de octubre a las 12:58 PR, anterior a sus partidos; Supabase los importó el 3 de noviembre. Comparados todos los campos de cada objeto JSON (orden de claves normalizado), **73/73 coincidieron** con el archivo Git y los IDs eran únicos. La fecha de importación y la de publicación original son datos distintos. [Checkpoint anterior a los partidos](https://github.com/jlebronmarty-netizen/sports-edge-hub/blob/c451d9fc9767bbeff751e26e631fe0b48579fe75/research/ncaab-preseason-v1/results/authentic-preseason-initial-status.json)

En Soccer, se recalcularon los 20 recibos (10 por mercado) desde goles, IDs y estado del partido. Los 42 pronósticos tenían historial de fechas anteriores a la jornada del encuentro. En NCAAF, las 324 liquidaciones sin disputa coincidieron al recalcular ganador, margen, total y error absoluto desde el marcador (108 juegos). Las 18 disputas estaban identificadas como cambio del contrato del evento. En Table Tennis, los puntos y sets de 265 partidos reprodujeron las cifras y el moneyline con identidades conciliadas. Otros 18 tenían reconciliación pública manual con totales, sets y enlace de origen. Sus tres mercados concordaron con el resumen archivado. Falta el desglose punto por punto o por set para auditar esos 18 al mismo nivel.

### Desempeño observado

Primera emisión evaluable por modelo y evento, resultado recibido antes de las 19:15 PR. Se excluyen empates sin lado seleccionado, participantes desconocidos y tiempos incompatibles según las condiciones de la consulta. Estas cohortes documentan desempeño prospectivo observado; quedan pendientes una validación formal del modelo, el impacto de disponibilidad y las condiciones de ejecución del operador. La frecuencia de un lado y la media de la probabilidad declarada se refieren al local en baloncesto universitario/NHL y al participante A en NFL/UFC.

| Modelo | Aciertos / juegos evaluados | Brier | Probabilidad media del lado | Frecuencia observada del lado |
|---|---:|---:|---:|---:|
| NCAAB preseason | 587/757 | 0.1940 | 58.43% | 74.11% |
| NHL DRatings | 63/111 | 0.2421 | 53.64% | 43.24% |
| NFL free | 11/15 | 0.2133 | 47.61% | 33.33% |
| UFC Elo, primera emisión | 6/9 | 0.2580 | 50.43% | 33.33% |

Por tramos, en NCAAB el lado local promedió 65.8% de probabilidad en 318 juegos del tramo 60–80%, y ganó en 91.2% de ese grupo. La selección de calendarios, rivales y sedes puede influir; este hallazgo por sí solo no especifica una recalibración. MAE de NCAAF (108 juegos por mercado): 13.654 puntos de margen y 13.188 del total. MAE de Table Tennis (283 juegos): 14.334 puntos en el total. El archivo de resultados contiene el desglose por tramos y los conteos para cada operación. [Consultas de contraste entre deportes](cross-sport.sql) · [Resultados](observations.json)

## Hallazgos, corrección y riesgo residual

| Severidad y fuente | Evidencia y efecto | Corrección, verificación y riesgo residual |
|---|---|---|
| Crítica · ventana NBA | Tres capturas de Toronto llegaron a la tabla derivada el día 20. El método previo aceptó diez filas atrasadas y congeló 8.21. 6,225/6,463 filas de la muestra se materializaron >24 h después del recibo original. | El calendario independiente exige justificar cada posición antes del corte. Regresión reproduce la omisión y su recuperación. Un calendario original incompleto que nunca declare un partido sigue siendo una limitación externa. |
| Alta · ausencia de archivo | 29 de 2,362 filas del archivo operacional carecen de derivado. Todas corresponden a GSW–Dallas del 18 nov, ID 21718140. | El control bloquea la ventana afectada. La consulta de salud señala ese ID. La reposición o backfill requiere aprobación. |
| Alta · originales divergentes | Entre 1,337 pares cotejados con ≥10 minutos, el compacto tenía Vassell 5 y Wembanyama 11 rebotes; el otro original tenía 6 y 10. El box score oficial confirma 6 y 10. | La rama bloquea el componente en disputa y exige un box score conciliado para la nueva liquidación de props pendientes. Regresión específica para rebotes/PRA. Un historial derivado corregido requiere reconciliación posterior autorizada. [NBA Spurs–Jazz](https://www.nba.com/spurs/game/0022600239-spurs-vs-jazz-salt-lake-city-ut-11-15-2026/box-score) |
| Alta · alcance y límites de capturas | Día de calendario con historial marcado completo sólo hasta 17 nov; 336 filas de mercados principales en una ventana con límite global previo de 300. Nueve snapshots de props coincidieron en sus conteos de lados. | Se une calendario bruto + días posteriores por hora PR. Límites por juego, paginación determinista o cuarentena. Los 336 registros prueban saturación potencial; la pérdida de una cuota específica no quedó demostrada. |
| Alta · contrato y alineación | GOAT registró alcance de prórroga sin verificar. 88/92 capturas de contexto declaraban cobertura de lesiones y 72/92 de alineaciones. 242,539 filas de precio en la consulta de muestra tenían marca de actualización y edad ≤3 h al recibirlas. | Límites del reloj del operador, cotejo con payload de cuota, contrato/OT, disponibilidad y equipo. Todavía pueden quedar numerosas selecciones en PASAR. Archivo privado opcional por defecto con presupuesto de lectura cero. |
| Alta · falsa confianza prospectiva | En 119 recibos, cada mercado principal abarcaba sólo cuatro juegos independientes; 169 contratos de props congelados sin liquidación al primer corte. La evidencia V1 no enumeraba los juegos usados en la ventana. | Nuevo identificador de board para futuros freezes, desglose por partido y evidencia por juego. MAE por contrato de V1 está en los resultados. Calibración, EV y ventaja monetaria no establecidos. |
| Alta · TT y NCAAF | 110 partidos accionables TT pendientes; seis partidos en disputa NCAAF. | Consultas de salud separan abstenciones, filas y eventos. Las muestras de seguimiento excluyen disputas. Resolver identidades/recibos con las fuentes ya autorizadas. |
| Media · NCAAB | En 763 uniones, doce discordancias de lados; once eran permutas. Revisar espn:401920567 (participante) y espn:401920750 (hora). | El reconciliador existente contempla inversión, cambio de participante, corrección de horario y final imposible. Una unión por ID sola no prueba que el sistema haya calificado mal. |
| Media · volumen y observabilidad | En jornadas completas 18 y 19 nov, filas de precio por juego superaron el doble de la mediana de las jornadas anteriores. Cero discrepancias de la fórmula de props frente a sus propios L5/L10 en el control ejecutado. | Señal diagnóstica, no prueba de duplicación. La consola existente recibe conteos por estado NBA. Ocho consultas de salud verificadas cubren volumen, consistencia, estado de procesos y retrasos. Sin trabajo programado adicional. |

## Contrato de protección

| Estado | Criterio determinista |
|---|---|
| VALIDATED | Secuencia y muestra elegibles completas, evidencia de cada original y verificaciones del mercado/contexto aprobadas. |
| INCOMPLETE_HISTORY | Falta una fila elegible o un final esperado antes del corte. Consume posición y se informa el ID. |
| DUPLICATE_DATA | Identidad duplicada o precios simultáneos incompatibles. Un calendario ambiguo también invalida la fuente. |
| IDENTITY_MISMATCH | Equipo/temporada/horario incompatibles o cambio de equipo sin secuencia reconciliada. |
| SOURCE_UNAVAILABLE | Fuente de calendario o manifiesto sin evidencia suficiente; error de lectura genera panel indisponible. |
| PARTIAL | Columna ausente, recibos discordantes, original pendiente, lesión o alineación sin confirmar. |
| INSUFFICIENT_SAMPLE | La secuencia comprobable se agota antes de reunir diez participaciones elegibles. |
| STALE | Fecha del precio no válida, posterior al corte o fuera de vigencia; partido fuera de pregame. |
| CONTRACT_UNVERIFIED | Precio, libro, lado, línea, contrato o prórroga sin respaldo suficiente. |

El umbral de diez minutos preserva el criterio estadístico previo. Un DNP o menos de diez minutos identificados en el original permiten avanzar hasta el siguiente partido elegible. Un dato ausente bloquea la posición. Con diez recibos concordantes de manifiesto, una ventana puede mostrar su valor descriptivo con calidad PARTIAL mientras falte el cotejo de un original. Top, ranking, nuevo freeze y señal favorable exigen VALIDATED. Aun con datos validados, VIGILAR en este board sigue indicando investigación SHADOW. Frecuencia histórica = aciertos/muestra; proyección = estadística estimada; probabilidad validada requiere calibración prospectiva; ventaja económica requiere probabilidad respaldada y precio ejecutable.

## Verificación y condiciones de cierre

- Unidades e integración del motor cubren datos faltantes, recuperación, DNP, límite de minutos, cero real, traspasos, duplicados, fechas PR/UTC, reprogramados, materialización futura, valores corregidos, mercado/OT, precios vencidos, congelados y verificación de gzip/SHA. Una prueba de recuperación aporta un contrato y alineación sintéticos verificados, confirma que el motor admite exactamente un nuevo freeze y luego lo bloquea al vencer el recibo. Datos reales del incidente y escenarios sintéticos adicionales se identifican en los tests.
- Regresión por deportes: 622 pruebas pasaron. Familias adicionales con sus respectivos loaders: 124 pruebas de dashboard/deportes y 9 de runtime de tenis. Dos expectativas antiguas basadas en texto del código ya fallaban en la base, se reprodujeron en un checkout separado y se actualizaron a los contratos vigentes.
- La prueba de navegador usa respuestas generadas por el motor del PR y un fallo 503 controlado. Recorre las seis pestañas, inspecciona el partido faltante, actualiza la proyección y verifica que se retire el valor anterior en escritorio y móvil. Resultado en Chromium real: 2/2 pruebas de navegador aprobadas, a 1440×900 y 390×844. El build local completó compilación, verificación de tipos y prerender de 400/400 páginas. Estos ensayos no acreditan latencia/transferencia ni comportamiento con toda la carga real de una jornada.
- Quedan abiertos el cotejo byte a byte de los 225 objetos privados (se verificaron sus metadatos, conteos y hashes registrados), una medición de lectura a escala de jornada antes de activar cualquier descarga, validación independiente por deporte de L3/L20, titular/suplente, ritmo, descanso, viajes, rivales y probabilidades, y calibración con juegos futuros independientes. Los lectores de estas features están enumerados en el inventario. Para reactivar oportunidades de otro deporte hay que implementar su evidencia de origen antes de marcar filas validadas.
- Cualquier backfill debe ser aditivo y preservar hash, fecha efectiva, fecha de observación y procedencia de ambas versiones. Evaluar primero NBA 21718140 y 21718112 en una propuesta independiente. Costos, cambios de esquema, crons, promoción de modelos y puesta en producción requieren la decisión del propietario.

### Reproducción local

Desde la raíz, instalar las dependencias registradas con `npm ci`. El build necesita las variables públicas y de servidor habituales; para pruebas aisladas puede usarse una URL de Supabase local sin servicio y valores de prueba. Las pruebas siguientes no necesitan credenciales deportivas.

```bash
node --test tests/nba-history-integrity.test.mjs tests/nba-storage-integrity.test.mjs tests/nba-decision-archived-final.test.mjs
node --test --test-concurrency=2 tests/{nba*,nhl*,ncaab*,edge-lab*,*soccer*,*ufc*,*tennis*,*ncaaf*,*mlb*}.test.mjs tests/college-*.test.mjs tests/three-sports-readiness.test.mjs
node --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/dashboard-multisport/*.test.mjs tests/free-sports/*.test.mjs tests/ufc/*.test.mjs tests/tennis-free/contract.test.mjs
node --loader ./tests/tennis-free/runtime-loader.mjs --test tests/tennis-free/runtime.test.mjs
npm run build
# Windows, con Chromium de Playwright instalado
npm run test:product-experience -- nba-integrity.spec.ts
# Linux, con el servidor de pruebas local ya iniciado en el puerto 3107
PLAYWRIGHT_EXTERNAL_SERVER=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npm run test:product-experience -- nba-integrity.spec.ts
```
