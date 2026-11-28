# NCAAB Cheat Sheets · segunda revisión

Base del PR #417: 239541c2. Las dos rutas siguen protegidas en Preview. El laboratorio de liquidación reside fuera de supabase/migrations y carece de escritor programado. La ruta pública de pronósticos y los modelos conservan su contrato.

## Ventanas, identidad y calendario

Corte fijo a las 13:00 PR de cada fecha, con denominador de equipos únicos de la cartelera. Las primeras tres categorías son excluyentes. Las dos últimas son diagnósticos que pueden coincidir.

| Noviembre 2026 | Equipos | Temporada conciliada de menos de 10 | Historial parcial | Sin final anterior | Menos finales que el récord publicado | Hueco en el calendario de la ventana |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 23 | 89 | 40 | 39 | 10 | 37 | 34 |
| 24 | 172 | 93 | 71 | 8 | 70 | 71 |
| 25 | 137 | 67 | 64 | 6 | 59 | 48 |

Ningún equipo de estas carteleras acreditó L10. El día 23 un equipo tenía un partido anterior sin final verificable. Un hueco diario puede afectar varias secuencias y tampoco identifica por sí mismo el partido que falta. En estos equipos no se observó bloqueo de ventana por conflicto de identidad o de resultados. Los tres cortes tuvieron cero discordancias de ID de cabecera entre los contextos anteriores admisibles; tampoco había revisiones posteriores al corte de esos contextos previamente capturados. La división no interviene en la certificación L10. Los finales de la misma fecha PR, posteriores al corte y de temporadas diferentes se excluyen deliberadamente.

En los 174 lados del recibo de cartelera del 24 de noviembre, ninguno tenía team.division ni el nombre de una división en groups.parent. Había 165 lados con conferenceId. El cruce por ID y temporada con las observaciones previas confirmó 34 partidos DI–DI; los otros 53 siguen como indeterminados. El resumen distingue los casos en que hay evidencia para uno o ninguno de los equipos. De los 53, en 43 se identificó una sola división y en 10 ninguna. Las contradicciones tienen su propio estado.

Las primeras fechas de juego disponibles en los scoreboards, resúmenes de equipos y matchups individuales nativos son del 2 de noviembre de 2026. Los resultados de Pick tampoco aportaron partidos anteriores a julio. El PR #13 de Sports Edge Hub documenta 18.408 juegos en el ajuste de perfiles 2024–2026. Un perfil agregado no acredita las fechas, IDs, marcadores y procedencia de los enfrentamientos individuales. Se recuperó NCAAB_FREE_DATA_boxscores1100_20261010.zip por su huella SHA-256 (6af590d979fc42e5667a8ca5fbc850340f69cf62f23d04a97d30a836cd76cf4a). De 1.100 juegos, 1.024 tuvieron dos registros PASS sin errores, equipos identificados, tiempo verificado, puntaje entero, lineage coincidente y captura previa a la disponibilidad del paquete. La proyección utiliza 193, 191, 207, 216 y 217 finales de las temporadas terminadas en 2022–2026, respectivamente. Los 76 restantes quedan fuera. El directorio group50 de octubre no certifica la división histórica ni la afiliación de noviembre.

research/ncaab-sheet-history/extract.py reproduce prior.json desde el ZIP. El detalle de partido limita a cinco o diez enfrentamientos *observados por temporada*, sólo si el archivo ya existía antes del corte de la página. En las tres carteleras hay 1, 2 y 1 pares con algún cruce en este subconjunto. Los antecedentes anteriores no alimentan L10, frecuencia ni condiciones de la temporada actual. El paquete terminal de 31.022 box scores identificado en Sports Edge Hub queda pendiente de integración verificada.

## Ranking y simetría

El selector ordena los candidatos antes del Top 10 de cada banda. Frecuencia usa aciertos sobre juegos observados, condiciones cuenta únicamente criterios cumplidos y muestra el denominador evaluado. Brecha es el margen medio firmado en puntos a favor del lado: diferencial del equipo para ML, diferencial más hándicap para spread, total combinado menos línea para Over e inverso para Under. La brecha porcentual usa 100 × brecha / línea exclusivamente para totales positivos. Los empates se resuelven por frecuencia, n e identidad estable. El ATS histórico requiere la línea original de cada encuentro y sigue sin evidencia.

Para totales, L5 y L10 y el criterio de sede exigen muestra de ambos equipos, unifican los juegos por ID y aplican el umbral del 60 %. La sede distingue neutral y localía registrada. Se conservan también H2H y la comprobación de ambas mitades. El cálculo de ritmo agrupa los juegos con posesiones válidas, exige cinco por equipo, cuenta una vez cada partido compartido y deja sin evidencia los componentes contradictorios. Multiplica ritmo por 40 minutos por puntos totales por posesión del conjunto. Se requieren dos puntos de brecha en el sentido evaluado. Las pruebas invierten local y visitante manteniendo el total fijo. Los conteos no son probabilidades calibradas.

## Rendimiento

El lector conserva paginación por clave y conteo exacto. Lee dos lotes de tres cuerpos simultáneamente, reutiliza el formateador de fecha y evita serializar recibos grandes para compararlos consigo mismos. El armado de historias utiliza índices por equipo. Tras la autorización, Next almacena únicamente el tablero compacto por fecha, corte exacto y versión de formato durante 180 segundos. Las comparativas siguen bajo demanda. La medición data-ncaab-timing contiene duraciones, sin credenciales. En una respuesta reutilizada los tiempos de construcción pertenecen al armado original.

Muestra de Preview, primer acceso medido y repetición inmediata, segundos de extremo a extremo. Los componentes interiores están en milisegundos y pueden solaparse. La medición de autenticación de aplicación cubre el chequeo de acceso y no el inicio de sesión interactivo del usuario.

| Jornada | Partidos | Primera / repetida (s) | Acceso app (ms) | Índices y consultas Supabase (ms) | Cuerpos de archivo (ms) | Normalizar (ms) | Rankings (ms) |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 23 | 45 | 7,18 / 4,39 | 5 | 637 | 1694 | 362 | 6 |
| 24 | 87 | 6,58 / 3,12 | 1 | 513 | 1469 | 846 | 12 |
| 25 | 69 | 5,75 / 3,42 | 1 | 486 | 1612 | 455 | 4 |

En seis renderizados React SSR aislados por jornada, usando las propiedades reales del Preview, el tablero tardó 5–26 ms. Estas mediciones son de la pantalla y no incluyen toda la composición de Next, la red ni el SSO de Vercel. La primera lectura no garantiza una instancia recién creada; no se efectuó invalidación global. Aún falta demostrar menos de tres segundos de extremo a extremo en muestras repetidas de varias jornadas.

## Contratos, laboratorio y paridad

Los cinco recibos de cartelera examinados del 23 al 27 de noviembre a las 13:00 PR contenían 236 entradas de DraftKings con campos moneyline, pointSpread y total del juego. El conteo bruto no equivale a lados pareados elegibles. Las cuotas archivadas no acreditan jurisdicción, inclusión de OT, push, suspensión o anulación; tampoco acreditan ofertas por mitades o total de equipo. No hay reglas reales certificadas en el catálogo del tracker.

research/ncaab-sheet-tracker/lab.sql adapta el libro de NHL para esquema aislado, cronología de servidor, capturas únicas por estrategia y contrato incluso al cambiar de banda, posiciones y Tops, pares equivalentes prospectivos y unidades a cuota original. El reloj se asigna en INSERT. Las vistas security_invoker separan metodología, mercado, banda, lado, período, división y neutralidad. Las cohortes diarias, semanales y mensuales usan la fecha de inicio en PR. Pendientes y anulados aportan cero unidades liquidadas y cero decisiones. Push devuelve la unidad y queda fuera de accuracy. Las vistas conservan RLS y SELECT sin delegación para service_role. No se conceden escrituras al rol de aplicación.

verify.mjs exige identidad del evento y ambos equipos, recepción final dentro del corte, parciales enteros y unívocos que sumen el marcador, empate previo a cada OT, estado final y regla archivada equivalente. Admite partido con OT, reglamentario y mitades sin OT. Las reglas de segunda mitad que incluyan OT siguen sin soporte. Un caso pendiente admite reintento con evidencia nueva. settle.mjs pagina los pendientes y usa la clave única de liquidación. Las pruebas de PostgreSQL verifican permisos efectivos e heredados, inmutabilidad, reloj, duplicados, pendientes, cambio de lado de Pick y sus resultados independientes. Los datos del laboratorio son exclusivamente fixtures.

El Site original sigue en V13. La base consultable del Site contiene nhl_tracker_predictions; sus originales NCAAB se escriben en un bucket separado. La ruta HTTP de datos exige sesión privada y el código V13 normalmente responde con una lectura en vivo de Pick. La comprobación de fase 1 fue paridad de procesamiento sobre el mismo insumo. El cotejo independiente requiere los originales del bucket identificados por fecha, readAt y SHA-256; permanece pendiente.
