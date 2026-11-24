# Revisión del PR 391 para integración

**Producción, 20 de noviembre a las 9:25 p. m. PR.** La versión de integridad está desplegada y el tablero se comprobó con datos reales. [Resultados de las seis vistas y ciclos SHADOW pendientes](production-verification.md)

Se revisaron los 35 archivos de la primera versión (`55a86bd1`), las rutas consumidoras, dos RPC de SHADOW, las capturas archivadas, los logs de las tres ejecuciones y la versión de producción. La base comprobada fue `61ed75d8145f41bb8a2e116a91c31491513fce6f`. La revisión añade correcciones a la rama existente. El despliegue de referencia es `dpl_4mjsCRqDjp9ZWqMtgMGGd4saCt7C`. [PR, commit vigente y controles](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/391/checks)

## Cambios que afectan a los resultados

| Problema comprobado | Protección y prueba |
|---|---|
| Alta. Las 54 cuotas principales del corte carecían de timestamp de recepción a nivel de precio. Sí había timestamp en las envolturas. Una cuota antigua podía sobrevivir a un menú posterior vacío. | Lectura del último menú archivado por juego y tipo, inclusive vacío. Se concilian cabecera, hora de disponibilidad, fase, equipos, lote, identificadores, número de cuotas y hora del operador. La envoltura respalda la recepción. Un precio viejo sigue vencido. Prueba de 1,100 cuotas en dos lotes y prueba de lote perdido. |
| Alta. Un tope global de filas o una fuente secundaria indisponible podía ocultar oportunidades de otro juego. | Páginas disjuntas de historial por jugador, conflictos de calendario limitados a equipos afectados y a días de la ventana, aislamiento de lecturas opcionales y diagnósticos por juego. Se mantienen líneas alternativas de equipo, con un solo lado preferido por contrato. El Top se recompone desde preferencias vigentes al vencer las primeras. |
| Alta. La alineación de la muestra era esperada en los 18 registros. Cuatro entradas de lesiones indicaban expresamente disponible. | Un modelo descriptivo de marcadores de equipo puede continuar con advertencia de disponibilidad. Un prop exige titularidad confirmada o recibo positivo de disponibilidad y equipo/juego inequívocos. Identidad, estadísticas, calendario, muestra, reloj del precio y contrato siguen siendo críticos. Una ausencia en la lista de lesionados no acredita disponibilidad. |
| Alta. Un resultado retirado, un dato de prórroga ausente o discrepancias de componentes podían afectar liquidaciones. | Se usa la versión más reciente del calendario disponible, se reconcilian marcador y períodos, se distingue cero de ausencia y se deja pendiente la prórroga material sin regla. Para props se requiere final operacional conciliado y, cuando existe compacto, igualdad en los componentes usados. Rebotes/PRA quedan pendientes ante una disputa de rebotes. Los recibos existentes permanecen inmutables. |
| Media. Los contratos del mismo partido tenían peso acumulativo en la métrica base. | El lector conserva la métrica por contrato y calcula el promedio por partido antes de combinar juegos por modelo/mercado/período/estadística. Exige que coincidan ambos denominadores. En la prueba de diez aciertos de un juego y un fallo de otro, tasa 50% y MAE 6. |
| Media. La jornada completa produjo 4,603,068 bytes de JSON. Además, la UI ordenaba Moneyline por margen, pero no mostraba el valor en la columna de brecha. | La respuesta privada se envía en flujo y admite gzip (223,709 bytes al comprimir esta muestra). La prueba de transferencia verifica igualdad de JSON y caracteres Unicode en ambas codificaciones. Se usa el mismo margen en la tarjeta y en el orden. Latencia, proxy y compresión del dominio real quedan para el control de despliegue. [Límites de Vercel Functions](https://vercel.com/docs/functions/limitations) |
| Baja. Un test de BSN mezclaba recibos del 11 de noviembre con la fecha de la máquina. | Reproducción de `0 !== 20` también en `main`. Se fijó el reloj del ensayo a la fecha de los recibos. |

## Reproducción de la jornada NBA

Corte 20 de noviembre a las **7:35 p. m. de Puerto Rico**, equivalente a 23:35 UTC. Se extrajeron por SQL 210 juegos de calendario base, cuatro recibos diarios, 18 menús GOAT para nueve juegos, 558 lados HoopsAPI, 6,463 filas compactas, 225 manifiestos, 72 box scores operacionales y el contexto pregame vigente. Un doble HTTP local sirvió esos registros al servicio de la rama con su API habitual de Supabase. El doble utilizó proyecciones de los campos consumidos por la aplicación, los 139 registros de la tabla auxiliar de accuracy y los timestamps archivados de los recibos. Se contrastaron las tablas y sus relaciones mediante SQL. La reproducción acredita la jornada archivada y el código de aplicación. La latencia de PostgREST y del proxy real requiere el despliegue autorizado.

| Vista | Lados del archivo evaluados | Preferencias visibles |
|---|---:|---:|
| Top 25 | Conjunto de preferencias entre mercados | 25 de 143 |
| Moneyline | 18 | 0 |
| Spread | 22 | 0 |
| Total | 18 | 0 |
| Player Props | 1,524 | 0 |
| Cuartos / Mitades | 504 | 143 |

Se evaluaron 2,086 lados. Primer estado por lado: 450 VALIDATED, 1,004 PARTIAL, 472 INCOMPLETE_HISTORY, 112 CONTRACT_UNVERIFIED y 48 IDENTITY_MISMATCH. Las razones pueden coexistir. Todos los lados de partido completo y los 1,524 props carecían de prueba de prórroga. Los 25 destacados eran VIGILAR. El plan local consideró 213 freezes SHADOW, con cero escrituras. Las 55 lecturas simuladas corresponden a esta jornada. La estimación de capacidad de la función desplegada sigue abierta.

**Shead.** A las 7:00 p. m. faltaban los juegos 21718136, 21718126 y 21718114. El cálculo anterior daba 8.8 / 7.1 y 8.21. El guardado V1 conserva su precio −160. El nuevo control devolvió INCOMPLETE_HISTORY y PASAR, sin nueva congelación. A las 7:15 p. m. ya se podían calcular 5.4 / 7.2 y 6.03, con un recibo distinto a −158 y contrato sin verificar. A las 7:35 p. m. el último menú ya no ofrecía el Over 4.5. La prueba positiva suministra explícitamente los requisitos restantes y confirma que una selección recupera elegibilidad automáticamente. La huella de la fila histórica fue `55eb0c114238577d4e8023f29b3968af` antes y después de la revisión. [Fixture de capturas](../../../tests/fixtures/nba-shead-20261120.json)

**Interpretación.** SIN DATOS indica que faltan fuente o muestra para calcular. PASAR conserva el diagnóstico ante un defecto crítico o una brecha que no califica. VIGILAR exige datos validados y un lado descriptivo favorable. La región y la ejecución permanecen sin verificar. JUGADA requiere la política oficial, probabilidad prospectivamente calibrada y contrato ejecutable. Este board SHADOW emite cero jugadas oficiales. Los mercados sin preferencia conservan el diagnóstico cuando su calidad está pendiente.

## Reparaciones concretas sujetas a aprobación

**Warriors–Dallas, 21718140.** El primer calendario final del 18 de noviembre ya marcaba 116–94. A las 11:30:29 p. m. PR el box operacional archivó 29 jugadores distintos. Sus filas de Dallas sumaban 116, las de Golden State sólo 68. En el archivo estacional faltaban el manifiesto, el objeto de jugadores y los derivados para este juego. No se probó qué paso anterior omitió los dos jugadores. Copiar las 29 filas propagaría la diferencia.

El acta oficial contiene 25 jugadores con minutos. Se cotejaron los 23 disponibles en el operacional y los dos ausentes. Gui Santos (6 puntos) y Will Richard (20) completan los 94. Yaxel Lendeborg tiene 4 asistencias frente a 5 en el operacional. También difieren los robos de Caleb Martin, Cooper Flagg, Kyrie Irving y Zaccharie Risacher. La consulta de previsualización ejecutada devuelve siete filas, cinco cotejos y dos jugadores ausentes, con marcador simulado 116–94. El SHA-256 del PDF descargado es `031e8260ba1ae320402a4eb8946fc1e45a8208b0eac543e9eecfa872c481f12b`. [Acta NBA](https://statsdmz.nba.com/pdfs/20261118/20261118_GSWDAL_book.pdf) · [SELECT de previsualización](gsw-dallas-repair-preview.sql)

Para una reparación autorizada, conservar el acta y la respuesta operacional en versiones distintas. Registrar ID oficial, ID GOAT contrastado, hash, procedencia, minuto y componente, fecha de observación real y fecha efectiva del partido. Validar los 25 que jugaron, DNP, unicidad, minutos, ambos marcadores y campos combinados antes de generar una revisión derivada aditiva. Un lector temporal sólo puede usar esa revisión a partir de su fecha de conocimiento. No atribuir al proveedor GOAT un recibo de NBA.com. Ninguna de estas operaciones se ejecutó.

**Spurs–Jazz, 21718112.** El compacto conserva 5 rebotes para Devin Vassell y 11 para Victor Wembanyama. El box operacional y el oficial muestran 6 y 10 respectivamente. Mientras difieran, las ventanas y liquidaciones pendientes que necesitan esos rebotes siguen bloqueadas. La reparación aditiva seguiría la misma política de fuente y fecha de conocimiento. [Box oficial](https://www.nba.com/spurs/game/0022600239-spurs-vs-jazz-salt-lake-city-ut-11-15-2026/box-score)

## Cobertura fuera de NBA

| Deporte | Superficie y adaptador de datos pendiente |
|---|---|
| NHL | Top compartido y señales consultables en su mercado. Faltan porteros titulares, alineaciones, reconciliación de calendario y reglas de prórroga/shootout por contrato. |
| NCAAB | Board compartido. Quedan identidad local/visitante, sedes neutrales, horarios y precios por mercado. La importación tardía de 73 pronósticos tiene evidencia Git anterior al juego. |
| NCAAF | Board compartido vía Edge Lab. Requiere reconciliar seis eventos disputados, disponibilidad de QB, cambios de contrato y calendario. |
| Soccer | Board compartido vía Edge Lab. Requiere 1X2/reglamentario, prórroga, competencia y fixture, con versión de resultados. |
| Table Tennis | Board compartido vía Edge Lab. Faltan identidad entre fuentes, series/sets y cobertura de liquidación. |
| UFC | Superficie propia. Requiere cartelera, sustituciones, peso, tiempo/método de finalización y versión de combate. |
| ATP / WTA | Superficie de tenis propia. Requiere cobertura por gira, retiros/walkovers, contrato de sets y estadísticas disponibles antes del partido. |
| NFL | Superficie propia. Requiere participantes, lesiones, semana y regla de tiempo extra por mercado. |
| MLB | Superficie propia y temporada pausada. Requiere criterio de abridor, entradas y reglas F5/NRFI al reanudar. |
| BSN | Archivo en desarrollo. Falta calendario completo, cotejo de originales y cohorte prospectiva. |

Las pruebas de regresión y los límites de cobertura de la primera auditoría siguen documentados por deporte. [Matriz e inventario](README.md) · [Resultados SQL](observations.json)

## SHADOW y operación

La clave primaria de outcomes y la FK hacia forecasts usan `forecast_id`. Las escrituras existentes ignoran IDs ya registrados. La lectura de pendientes excluye outcomes existentes. Los logs de **producción V1**, 20 de noviembre, documentan 234 intentos idempotentes en cada congelación de las 11:35 a. m. y 7:35 p. m., y 119 intentos de liquidación a las 8:15 a. m. Son intentos registrados, posiblemente repetidos. Vercel reportó cero llamadas deportivas en las tres ejecuciones. Dos consultas de solo lectura devolvieron 708 forecasts y 119 outcomes. Se probó el lector de métricas con el resultado real del RPC y las 119 filas enlazadas mediante un transporte local. Coincidieron las 31 cohortes de baseline, con un máximo de cuatro juegos por cohorte y 14 comparaciones de candidatos. Ninguna promoción.

## Pruebas y reproducción

Resultados locales: 634 pruebas de motores y mercados, 126 de componentes/multideporte, 9 de runtime de tenis, 31 de preparación MLB y 11 de BSN. Total: **811 aprobadas**, sin omisiones en esas ejecuciones. Chromium recorrió ambas pruebas de navegador en escritorio 1440×900 y móvil 390×844. Se comprobó el cambio de proyección de Shead, la retirada de datos ante 503, las seis vistas, 25 tarjetas, orden real de brecha en ambos sentidos, filtros de partido y período, navegación a la segunda página y ancho del documento. Next.js completó verificación TypeScript y 400/400 páginas estáticas.

Los comandos por familia están en el [informe inicial](README.md#reproducción-local). Se ejecutaron también las familias BSN y MLB readiness. La prueba opcional de jornada completa consume el JSON generado por el lector de sólo lectura. Usar un archivo nuevo fuera del repositorio y las credenciales de lectura ya autorizadas.

```bash
node --loader ./tests/bsn-free/runtime-loader.mjs --test tests/bsn-free/*.test.mjs
node --test tests/mlb-production-readiness/*.test.mjs
node --loader ./tests/dashboard-multisport/tsx-loader.mjs scripts/nba-decision-board-audit-replay.mjs 2026-11-20T23:35:00Z /tmp/pick-nba-1935.json
NBA_ARCHIVED_SLATE_FILE=/tmp/pick-nba-1935.json PLAYWRIGHT_EXTERNAL_SERVER=true PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npm run test:product-experience -- nba-integrity.spec.ts nba-archived-slate.spec.ts
```

## Integración, observación y reversión

1. Conservar el SHA del despliegue activo y comprobar los controles, cabeza y base del PR justo antes de integrar. Si `main` cambió, validar el resultado de integración sobre esa base y repetir las regresiones. Obtener autorización explícita para la fusión y su despliegue automático asociado. La rama de investigación tiene previews deshabilitadas.
2. Mantener el presupuesto de descarga privada en cero. Conservar habilitación, autenticación, horarios, modelos y variables actuales. El PR no necesita migración ni backfill.
3. Tras un despliegue autorizado, abrir el host de despliegue permitido con la sesión autorizada. Comprobar la versión `NBA_DECISION_BOARD_SHADOW_V2_INTEGRITY`, las seis vistas, JSON privado íntegro con y sin gzip, tiempo de respuesta bajo el límite de 45 segundos y ausencia de errores 413/5xx. Contrastar el último menú por juego y las cotizaciones vigentes. Un Top vacío puede ser correcto si sus razones son reproducibles.
4. En las próximas dos congelaciones programadas, contrastar logs, número de contratos elegibles y nuevas filas por versión. Verificar 0 llamadas de proveedor, ausencia de filas con historial crítico o posterior al corte y la huella V1 de Shead. En la liquidación programada siguiente, contrastar pendientes, resultados con fuente y disputas de OT/componentes. Confirmar día PR, las cohortes y el peso por juego. Usar las [consultas de salud](health.sql) y la evidencia de este documento. Evitar forzar manualmente los crons.
5. Detener la habilitación y solicitar reversión ante una recomendación con evidencia crítica, alteración de una huella histórica, uso de información posterior, llamadas deportivas inesperadas, error reiterado de respuesta o desaparición de contratos válidos reproducibles. Con autorización, restituir el despliegue de referencia o revertir únicamente el cambio de código en Git. Preservar cualquier nuevo recibo SHADOW con su versión, y mantener la cuarentena operativa para el comportamiento anterior de Shead.
6. La verificación de la versión nueva en producción sólo se cierra tras las lecturas y ciclos anteriores. Los complementos de fuente, backfills, nuevas condiciones con operadores y cualquier promoción de modelo necesitan decisiones separadas.
