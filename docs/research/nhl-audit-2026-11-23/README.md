# NHL — auditoría integral de datos y pruebas reproducibles

**Corte de datos:** 23 de noviembre de 2026, 11:52:27 a. m. de Puerto Rico (`2026-11-23T15:52:27.459Z`).

**Conclusión:** el archivo permite investigar los mercados principales y preparar estadísticas de jugadores. Ninguna prueba nueva demuestra una mejora robusta que justifique promover un modelo. V6 sigue en SHADOW. Se corrigieron exclusiones por acentos en puck line, controles de identidad/tiempo y la admisión de estadísticas incompatibles en nueva evidencia V7.

## Estado y alcance

- Repositorio: `jlebronmarty-netizen/pick-analyzer`; base inicial verificada `a3d2a1a15ba4afa8594c933efe2a1c3de01458be`; rama actualizada sobre `ca2d8450dd0f00569614844197b383bb830e6711` tras la integración paralela del PR #395 de NBA.
- Rama: `research/nhl-data-evaluation-20261123`. [PR #399 abierto y revisable](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/399), sin fusionar. Código validado: `1a6c7aa18421a3e421cbfc7f47f492124591444d`; las actualizaciones posteriores de esta entrega solo documentan la verificación. [Vista previa NHL](https://pick-analyzer-pxt7u7i38-pick-analyzer.vercel.app/nhl), `READY`. No se despliega este trabajo en producción.
- Supabase `ynuocvexviorgdjrfthw`: `ACTIVE_HEALTHY` durante la revisión. Se usaron exclusivamente consultas de lectura.
- Vercel producción: `dpl_GYajmAvr5sZtFpVXUftPHZBRhUtB`, `READY`, commit inicial. Durante esta auditoría otro chat integró #395 y producción pasó a `dpl_AJCLW29TdCUGWEbM6vQN3dztgbvq`, `READY`, commit `ca2d8450dd0f00569614844197b383bb830e6711`; se preservó ese avance. `/nhl`, `/api/nhl/late-v6-readiness` y `/api/nhl/exact-circa-market-research` respondieron HTTP 200 antes de los cambios.
- Se revisaron las ramas y PR NHL. El PR #372, sobre reconstrucción reglamentaria/OT/SO V8, sigue abierto y en draft; sus resultados anteriores no se presentan como código desplegado. Los PR #397 y #398 de continuidad/NBA/navegación tampoco se incorporan implícitamente.
- Cero llamadas nuevas a proveedores deportivos, escrituras de datos, migraciones, suscripciones o cambios de cron. No se modifican fórmulas oficiales ni congelaciones anteriores.

## 1. Inventario actualizado

| Conjunto | Registros o capturas | Partidos distintos / detalle |
|---|---:|---|
| Boxscore y jugada por jugada oficiales | 142 cada uno | 142, del 3 al 22 de noviembre |
| Equipos | 32 | 6–11 partidos por equipo |
| Base normalizada equipo–partido | 284 | Dos lados por partido; no 284 partidos independientes |
| Jugadores de cancha | 5,112 | 700 IDs NHL, 142 partidos |
| Porteros en boxscore | 568 | Incluye suplentes; 301 apariciones con minutos, 76 IDs |
| Pronósticos originales DRatings | 137 | 137 partidos; 130 con resultado |
| Resultados asociados | 130 | 130 partidos |
| Moneyline Circa | 3,915 capturas | 118 partidos |
| Puck line Circa | 1,901 capturas | 58 partidos |
| Total Circa | 1,901 capturas | 58 partidos |
| Ambos porteros probables ESPN | 41 partidos | Seis capturas; cero confirmaciones oficiales de ambos titulares |
| PP/PK | 8 capturas | 32 equipos por captura, 256 filas equipo–captura |
| Tirador–portero | 3,324 registros | 125 partidos |
| Poisson temprano congelado | 56 | 50 evaluables, seis sin resultado al corte |
| V6 tardío congelado | 24 | 24 con resultado |
| Diagnósticos posteriores | 130 | Descriptivos; no causalidad demostrada |

Hay 911 ejecuciones almacenadas al corte. El archivo de calendario incluye 1,362 recibos del endpoint oficial diario y 910 payloads distintos por URL+SHA256. La auditoría offline verificó estos payloads y 21 fechas. El lector de la interfaz selecciona únicamente los recibos necesarios antes de los cortes reales: en la prueba con todos los metadatos, 50 cuerpos, 418,425 bytes frente a 6,679,800 bytes del conjunto distinto completo. Ventanas, cohortes y resultados de las cinco variantes fueron idénticos.

`report.json` contiene la cobertura por equipo y fecha, las fechas de captura, las cohortes y todos los motivos de exclusión. `team-games.csv` conserva la base normalizada reutilizable. No se afirma un histórico completo de temporadas anteriores.

### Calidad y exclusiones específicas

| Partido | Estadística original | Tratamiento |
|---|---|---|
| `nhl:2026020326` | D. Vladar, PHI: 19 tiros; 4 goles + 16 atajadas = 20 | Se excluye la estadística de forma previa; se conserva el original |
| `nhl:2026020349` | D. Levi, EDM: 19 tiros; 3 goles + 17 atajadas = 20 | Mismo tratamiento |
| `nhl:2026020342` | VGK: 27 tiros de equipo = 26 de patinadores + 1 del portero Adin Hill | Falso positivo corregido con observación tirador–portero del mismo archivo; se recuperan tiros propios VGK y concedidos DAL |

No se elimina ningún partido del inventario ni se corrige silenciosamente la fuente. Permanecen dos partidos con estadísticas de portero en cuarentena. El nuevo control del helper V7 actúa solo al generar evidencia posterior. Si `saves` o `saveShotsAgainst` están registrados, deben cuadrar con tiros y goles; se distingue cero de dato ausente. Los conflictos de identidad permanecen bloqueados.

**Corrección de tiros ofensivos del portero, 23 de noviembre:** el archivo original `matchups.json` ya contiene a Hill (`8478499`) como tirador frente a Oettinger (`8479979`), con un tiro y cero goles en `nhl:2026020342`, capturado a `2026-11-18T06:37:21.275Z`, igual que el PBP archivado. La guardia ahora suma tiros de patinadores y tiros ofensivos de porteros identificados, validando partido, fecha, rivales, minutos, conteos, duplicados y captura. `shots` del agregado ya incluye los goles; nunca se suma `shotsAgainst`. Los agregados sin período no recuperan tiros de partidos decididos por shootout. La hora de esta evidencia se conserva y se exige antes de cada decisión que la utiliza. La corrección usa los mismos 13 JSON, sus hashes y el corte original; no reemplaza resultados, pronósticos o congelaciones. [Evidencia y diferencias](goalie-shot-correction.json). Fuentes de corroboración: [Event Summary oficial](https://www.nhl.com/scores/htmlreports/20262027/ES020342.HTM) y [Play-by-play oficial](https://www.nhl.com/scores/htmlreports/20262027/PL020342.HTM), tiro de Hill al 01:39 del segundo período.

Las tablas consultadas no presentan duplicados de eventos en pronósticos, resultados ni congelaciones. Los lectores rechazan solapamientos de páginas, claves ausentes, cambios de conteo y límites alcanzados. Un error o una lectura incompleta se presenta como no disponible, sin métricas parciales.

## 2. Qué utiliza cada referencia

| Referencia | Entradas que modifican su probabilidad | Evidencia adicional / límite |
|---|---|---|
| DRatings original | Probabilidad publicada por el proveedor | Sus variables internas no quedan demostradas por este archivo |
| Poisson propio | Goles recientes y promedio previo según localía; mezcla existente de 75% forma y 25% promedio | Distribución independiente aproximada; empate repartido para Moneyline; no contrato OT/SO certificado |
| V6 | Circa de ambos lados sin margen + residuo previo de localía con contracción `n/(n+50)` | Requiere el historial elegible previsto; ajuste exploratorio |
| Porteros y PP/PK guardados | No modifican automáticamente la probabilidad vigente | Probables, identidades candidatas y evidencia para pruebas separadas |

Los boxscores originales son datos capturados; las filas por equipo/jugador son estadísticas normalizadas; forma, descanso y fuerza del rival son variables derivadas. Una variable disponible no se presenta como una entrada validada del modelo.

## 3. Moneyline y calibración

La cohorte principal conserva exactamente los mismos 24 partidos y verifica los originales DRatings, los tiempos, las identidades, el precio Circa congelado y los resultados. No suma capturas repetidas.

| Referencia | Aciertos | Accuracy | Brier | Log loss |
|---|---:|---:|---:|---:|
| DRatings original | 13/24 | 54.17% | 0.259496 | 0.716389 |
| Circa sin margen | 15/24 | 62.50% | 0.251252 | 0.698825 |
| Poisson tardío | 14/24 | 58.33% | 0.250802 | 0.696968 |
| V6 exploratorio | 14/24 | 58.33% | 0.247957 | 0.694140 |

Brier y log loss menores son mejores. La diferencia de Brier V6−Circa es **−0.003295**, con bootstrap pareado del 95% **[−0.034250, +0.027877]**. El intervalo incluye cero. La sensibilidad por fecha también incluye cero; solo hay tres fechas de Puerto Rico entre el 19 y el 22 de noviembre. No existe evidencia de superioridad robusta.

La mediana de anticipación de DRatings es **1,312.62 minutos (21.88 horas)**. Circa tiene **112.68 minutos** y Poisson/V6 tardíos **112.54 minutos**. Es una comparación de referencias tal como se emitieron, no un concurso de algoritmos con el mismo conjunto de información.

Se incluyen intervalos Wilson de accuracy y calibración por bandas prefijadas, con probabilidad media, frecuencia real, denominador e incertidumbre; además, desgloses exploratorios por lado, favorito/underdog y probabilidad. Los grupos pequeños no se usan para seleccionar reglas.

Cohortes distintas, mostradas por separado: DRatings **75/130**, Brier **0.243955**, log loss **0.682462**; Poisson temprano **29/50**, Brier **0.259711**, log loss **0.715058**. No se comparan estas tasas entre sí como si fueran los mismos juegos. De los 137 originales, 113 no tienen las cuatro referencias válidas; sus IDs y motivos se conservan. Siete originales y seis congelaciones tempranas permanecen sin resultado al corte.

## 4. Goles, tiros y forma previa

La normalización distingue **110 finales en reglamentario, 19 en OT y 13 en shootout**. El gol decisivo de shootout se conserva en el marcador final utilizado para una evaluación matemática de contratos, pero no se asigna a jugadores/porteros ni a conversión de tiros. Los porcentajes utilizan cocientes de sumas.

La cohorte de variables contiene 56 decisiones canónicas y 50 resultados: se prefiere V6 tardío si existe, en caso contrario V1 temprano, antes de mirar el resultado o la disponibilidad de una variable. Nunca se contabilizan dos versiones de un partido como dos observaciones.

Entre los 50 partidos evaluables, 48 tienen los cinco partidos anteriores certificados con las capturas oficiales diarias previas; ninguno tiene diez. Los 50 tienen evidencia de calendario para el verdadero partido anterior y descanso. Se verifica cada día intermedio, el partido objetivo y la identidad/fecha del historial; cinco filas disponibles por sí solas no acreditan L5.

### Pruebas separadas

Las cuatro variantes evaluables comparten los mismos 19 partidos posteriores del 21–22 de noviembre. Cada fila compara contra el Poisson guardado en esos mismos juegos.

| Grupo añadido | Entrenamiento / intermedia / posterior | MAE total: base → prueba | MAE margen: base → prueba | Brier ML: base → prueba |
|---|---:|---:|---:|---:|
| Volumen de tiros | 17 / 14 / 19 | 2.18147 → 2.15716 | 1.55874 → 1.73589 | 0.23571 → 0.25999 |
| PP/PK | 15 / 11 / 19 | 2.18147 → 2.18116 | 1.55874 → 1.55976 | 0.23571 → 0.23604 |
| Calidad observada del rival | 17 / 14 / 19 | 2.18147 → 2.18047 | 1.55874 → 1.55754 | 0.23571 → 0.23554 |
| Descanso verificado | 17 / 14 / 19 | 2.18147 → 2.17316 | 1.55874 → 1.54997 | 0.23571 → 0.23933 |
| Forma del portero probable | 7 / 10 / 2 | Sin evaluación | Sin evaluación | Sin evaluación |

**Todos los intervalos del 95% de diferencias de MAE incluyen cero.** Tiros empeora el margen y Brier en esta muestra; PP/PK y calidad del rival producen cambios mínimos; descanso mejora ligeramente MAE, pero empeora Brier. Ningún resultado justifica promoción. La prueba de porteros queda bloqueada por tamaño cronológico: hay 19 partidos con forma previa de ambos probables, pero únicamente dos en su bloque posterior.

Definiciones reproducibles: tiros es el promedio entre tiros generados propios y concedidos por el rival en el historial observado; fuerza del rival es el negativo de su diferencial previo de goles físicos por juego; PP/PK combina el PP propio y `1−PK` rival de un snapshot válido de hasta 36 horas; descanso es el intervalo entre inicios consecutivos, limitado a siete días. Portero usa `1−save%` previo ponderado por tiros del probable rival, con mínimo de 50 tiros y correspondencia histórica por equipo/nombre inequívoco. Los IDs ESPN no se convierten automáticamente en IDs NHL.

Cada prueba aprende un solo coeficiente sobre el residuo del Poisson, estandarizando únicamente con entrenamiento y ridge fijo 10, sin intercepto adicional. No se probaron rejillas de pesos ni una combinación elegida por su resultado. Se registran las cinco variantes, incluida la bloqueada. Las fechas se fijaron una vez: tiros/rival/descanso entrenan hasta el 17 e intermedia hasta el 19; PP/PK hasta el 18 y 19; portero hasta el 19 y 21. Se mantienen jornadas completas y se purgan etiquetas de entrenamiento capturadas después de la primera decisión evaluada.

**Estas pruebas son retrospectivas exploratorias.** El protocolo se preparó durante esta auditoría; las 15:52:27 UTC son el corte de datos, no la fecha de emisión de nuevos pronósticos. Se han emitido cero pronósticos prospectivos de estas variantes. Los resultados nuevos no reajustan automáticamente los cortes ni los coeficientes. Queda reservado un periodo futuro sin usar para seleccionar fórmulas.

## 5. Puck line y total con línea exacta

Se reutiliza el evaluador existente, emparejando partido, equipos, hora, línea exacta y los dos precios antes de congelar. Los pushes se conservan aparte de W/L. La nueva normalización de nombres admite acentos, mayúsculas y espacios del nombre completo; no abrevia ni aproxima identidades.

| Cohorte/mercado | Poisson | Circa | Brier Poisson | Brier Circa | Pushes |
|---|---:|---:|---:|---:|---:|
| Temprana / puck line | 20/31 | 18/31 | 0.23443 | 0.22999 | 0 |
| Tardía / puck line | 16/24 | 15/24 | 0.21139 | 0.21466 | 0 |
| Temprana / total | 16/30 | 15/30 | 0.24784 | 0.25070 | 1 |
| Tardía / total | 11/23 | 13/23 | 0.24098 | 0.25126 | 1 |

El defecto Montreal/Montréal recuperó tres partidos evaluables tempranos (`0331`, `0345`, `0352`) y dos tardíos (`0352`, `0365`), además de un futuro temprano con precio (`0379`); todos con prefijo `nhl:202602`. Eso modifica correctamente la composición de la muestra, no la fórmula del modelo.

Las reglas públicas de Circa incluyen OT y el gol decisivo de shootout para los mercados descritos, sujeto a las estipulaciones concretas de la apuesta. No certifican por sí solas el contrato específico publicado en DRatings ni su disponibilidad en la jurisdicción del usuario. Persisten cero capturas con contrato certificado y cero horas publicadas de origen. La distribución Poisson aproximada no modela completamente OT/SO. Estos resultados no son ROI ejecutable, CLV certificado ni ventaja frente a FanDuel.

Fuentes primarias de contexto: [Circa House Rules](https://www.circasports.com/house-rules), especialmente reglas 3, 16 y 30; datos oficiales NHL ya archivados. No se llamó de nuevo al proveedor NHL durante el análisis.

## 6. Integración, reproducción y verificación

La sección NHL incorpora un panel de auditoría bajo demanda en su área de investigación, junto a los componentes existentes. Conserva navegación y mercados. También funciona como acceso independiente cuando el tablero del día está no disponible. Muestra corte, cobertura, denominadores, comparaciones, calibración, entradas usadas, pruebas, discrepancias, exclusiones y pendientes. Las fuentes vacías, errores y límites no se convierten en porcentajes cero ni recomendaciones.

Endpoint nuevo: `GET /api/nhl/research-audit`. Lee solo Supabase, con paginación ordenada, conteos exactos, máximo explícito por tabla, tres lecturas concurrentes, deadline de 40 segundos y coalescencia/cache en proceso de tres minutos. El corte real siempre se muestra. Los cuerpos grandes de jugada por jugada no se descargan; las estadísticas normalizadas completas quedan para reproducción offline. Los conteos se verifican por página; esto no se presenta como una transacción única de toda la base.

```bash
# Nuevo corte completo de solo lectura, usando el entorno Supabase de servidor existente.
node scripts/nhl-research-audit.mjs --live --export-input /ruta/privada/export \
  --output /ruta/reporte.json

# Reproducción offline del mismo corte; verifica hashes y conteos del manifiesto.
node scripts/nhl-research-audit.mjs --input /ruta/privada/export \
  --output /ruta/reporte.json --include-normalized

node --test tests/nhl-*.test.mjs
node --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/dashboard-multisport/nhl*.test.mjs
npm run build
```

No escribir credenciales en comandos compartidos ni documentos. La consulta SQL complementaria está en `sql/research/nhl_archive_inventory_20261123.sql`. El manifiesto guarda hashes de entradas; `report.json` y los CSV conservan los resultados de este corte. La reproducción de un corte antiguo depende del export preservado: las tablas de contextos/diagnósticos no son por sí mismas un sistema de versiones históricas.

Verificación local: **162 pruebas NHL y 26 de interfaz/integración aprobadas**, además de TypeScript y compilación completa. El primer intento de build carecía del placeholder `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` que exige el proyecto; se corrigió usando la configuración de CI existente. El render del reporte real confirmó 142/5,112/24 y las métricas comunes sin `NaN` ni valores indefinidos. La revisión visual mediante Chromium local quedó bloqueada por la restricción de sockets del entorno; el estado de Preview y revisión visual final se registra en `verification.json`.

### Comprobación publicada

- El [workflow NHL de este PR](https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/45215547281) completó las pruebas y el build. Los diez workflows devueltos para el commit de código finalizaron en `SUCCESS`, incluidos los otros tres controles NHL y seis controles existentes de MLB.
- Vercel `dpl_CR6Gf4Z8XohwdM58brjk7ksF1dbz`: Preview `READY`, commit de código `1a6c7aa…`. Se solicitó una vista previa puntual porque `vercel.json` ya desactiva los despliegues automáticos de `research/*`; esa configuración no se cambió. La API de Vercel denomina `staging` a este destino de Preview.
- `GET /api/nhl/research-audit` devolvió HTTP 200, lectura completa de las 13 fuentes y cero llamadas/escrituras. Su corte en vivo fue `2026-11-23T16:24:57.884Z` (12:24:57 p. m. PR): 3,922 capturas ML, 1,908 puck line y 1,908 total; 912 ejecuciones. Los ciclos existentes añadieron siete capturas por mercado después del informe histórico. La cohorte común, sus métricas y las pruebas de variables coinciden con el corte conservado.
- Navegador de escritorio, 1,348 × 936: apertura del panel, consulta bajo demanda, inventario, cuatro referencias, intervalos, bandas vacías de calibración y paginación de exclusiones de 1 a 2/11 verificados. Sin desbordamiento horizontal ni errores de aplicación observados. Se inspeccionaron capturas; no se publicaron archivos de navegador. La revisión visual móvil no se realizó.
- Tras la comprobación, producción seguía en `dpl_AJCLW29TdCUGWEbM6vQN3dztgbvq` / `ca2d8450`, y las cuatro huellas históricas permanecían idénticas. La consulta de logs de errores/advertencias del Preview no devolvió registros.

La evidencia SSR de la entrega original corresponde al SHA256 `0bcd8b916346924ee7c14e0e09e5d0cd6dab6007f54e3ad6f4a33bddae104200`. La corrección de tiros de Hill regenera el informe desde las mismas entradas; sus hashes anterior y corregido se conservan en `goalie-shot-correction.json`. La verificación de navegador/Preview anterior no se presenta como prueba de esta revisión, cuya nueva comprobación móvil queda pendiente. El paquete separado `nhl-audit-inputs-2026-11-23.zip` entregado con este trabajo conserva los 13 JSON originales y el manifiesto para reproducir offline el corte histórico; el código y los resultados permanecen versionados en este PR.

La corrección dirigida posterior a la entrega pasa **166 pruebas NHL, 26 de dashboard, TypeScript y build completo**, usando los mismos 13 archivos del corte original. La comparación Moneyline, mercados exactos, coeficiente de tiros y composición cronológica permanecen idénticos; solamente cambia el historial de tiros antes excluido por error y sus métricas derivadas. La nueva revisión móvil y la publicación quedan pendientes.

## 7. Pendientes y continuidad

1. Revisar el PR #399 y su Preview, y completar la comprobación visual móvil antes de integrar la interfaz y las correcciones de calidad. No activar nuevos candidatos ni fusionar PR #372 implícitamente.
2. Al alcanzar 30 V6 independientes, ejecutar la misma comparación y examinar intervalos, fechas y calibración. Es una revisión inicial; ni 30 ni 100 partidos garantizan mejora.
3. Mantener las fechas, las cinco variantes y el corte de esta investigación. Si se autoriza una etapa posterior, congelar antes del juego probabilidades de candidatos con versiones y features; evaluar luego el periodo futuro reservado sin ajustar parámetros sobre sus resultados.
4. Revisar las dos discrepancias restantes de estadísticas de porteros frente a otra evidencia original guardada o una captura futura autorizada, conservando procedencia. La supuesta discrepancia de tiros VGK en `0342` quedó resuelta con el tiro ofensivo de Hill ya archivado. Nunca alterar retrospectivamente congelaciones.
5. Conseguir identidad y estado previo del portero mejor verificados; el probable acertado después del partido no se vuelve una confirmación previa.
6. Para props de tiros/atajadas faltan líneas, precios, periodos, reglas OT/DNP/titular, correspondencia de jugador y liquidación. La base individual prepara esa investigación; no acredita mercados completos.

Continuidad: partir del código y de este informe, consultar el estado real de `main`, PR y Vercel, y volver a ejecutar la lectura para un nuevo corte. Conservar `report.json` de esta auditoría y no reemplazarlo silenciosamente con datos posteriores.

La siguiente fase acordada es un panel diario que reutilice las capturas de Supabase y el complemento histórico de 172 partidos del análisis manual, con origen, corte y cobertura visibles. Esa integración y sus snapshots nuevos de variables previas se implementan por separado del PR #399. La corrección de este PR no incorpora código del Site, no transforma datos consultados posteriormente en entradas históricas previas y no promueve modelos.
