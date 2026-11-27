# NBA · Historial de Props y contratos de jornada completa

## Tablero de producción del 23 de noviembre

Corte del tablero a las 8:11:14 p. m. en Puerto Rico (24-nov 00:11:14.156 UTC). El dominio servía `4d4b4ae2`. La API de lectura respondió 200 y reportó 10 juegos, 25 en observación, cero picks oficiales, cero llamadas deportivas y cero escrituras oficiales.

| Mercado | Lados archivados en el tablero | Lados preferidos |
|---|---:|---:|
| Moneyline | 20 | 0 |
| Spread | 24 | 0 |
| Total | 20 | 0 |
| Player Props | 1,652 | 0 |
| Cuartos y mitades | 560 | 134 |

El Top 25 mostró 25 filas en observación. Hay 133 jugadores con props. De los 1,652 lados de props, 922 tenían historial incompleto y 730 tenían calidad parcial. Entre estos últimos, el primer motivo fue original sin cotejar en 714, exclusión por minutos sin verificar en 8 y discrepancia con el original en 8. Hay 678 lados con diez partidos incluidos y calidad parcial. Un jugador puede aparecer en varios mercados y ambos lados.

Se cruzaron los 1,716 precios de jornada completa por identidad del recibo y hora. De GOAT proceden 48 lados de equipo y 1,652 props con prórroga sin verificar. Los otros 16 son de Hoops y tampoco acreditan su alcance de prórroga. Los indicadores de ejecución y disponibilidad regional eran falsos en los recibos consultados. Para habilitar un contrato hace falta evidencia del operador para esa oferta, con región, mercado, período, regla de prórroga, precio y hora. Las reglas públicas generales por sí solas no vinculan esos datos. Ocho props con discrepancias de componente quedan bloqueados. En Spurs–Jazz los rebotes de Devin Vassell fueron 5 en el compacto y 6 en el original, y los de Victor Wembanyama fueron 11 y 10, respectivamente.

## Qué archivos seleccionaba el tablero

Con caché vacía, el lector de producción usaba el orden ascendente de identificador del manifiesto de temporada para gastar el presupuesto de 262,144 bytes. Se reprodujo su selección con el corte anterior, la lista real de precios y jugadores, el calendario archivado, 2,000 filas compactas, 240 manifiestos y los campos originales que consume el verificador para 92 box scores operacionales. De estos, 90 pasaron el verificador del box completo y dos quedaron en cuarentena. Se respetaron las horas de captura y materialización. Entre las incidencias de las 714 filas con original pendiente había 24 juegos distintos cuya revisión de temporada ya estaba en Storage antes del corte. Sus archivos sumaban 67,996 bytes.

| Plan con caché vacía | Objetos seleccionados | Bytes comprimidos reservados | De los 24 originales pendientes |
|---|---:|---:|---:|
| Producción, orden del manifiesto | 91 | 261,846 | 0 |
| Rama de revisión, primera pasada de ventanas | 79 | 224,992 | 24 |

Para medir la selección se registró el manifiesto de cada intento y se devolvió vacío en lugar de descargar objetos. Es un conteo de lecturas planeadas. La verificación real de contenido, la transferencia efectiva y la cantidad de props que cambian de estado se deben medir tras una integración autorizada.

El cambio se aplica cuando el tablero tiene presupuesto de lectura propio. Agrupa las cuotas repetidas por partido y jugador y consulta la misma secuencia que utiliza el auditor de L10. Si un original demuestra un DNP o una exclusión por minutos, puede incorporar el siguiente encuentro en una segunda o tercera pasada. Todas las pasadas comparten el límite de bytes y de 128 descargas. El lector conserva la comprobación del hash y la prioridad de la revisión operacional, incluso si está en cuarentena. Los originales pendientes siguen sujetos al control de integridad. Las lecturas programadas conservan su ruta y caché independientes.

## Seguimiento del historial compacto

El cruce inicial de las 5:30 p. m. PR identificó 222 pares jugador–partido sin fila al corte. A las 8:11 p. m. había 91 pares materializados en 13 partidos. Se cotejaron identificador, equipo, minutos, siete componentes, huella y hora del archivo con las filas de investigación. Hubo 90 apariciones y un cero de minutos explícito. La reproducción local del materializador aprobó otros 45 pares de cinco partidos completos (175 filas considerando ambos equipos). Se rechazó el juego 21718158 porque los Clippers sumaban 93 en el box y 100 en el final. Dallas sumaba 110 en ambos.

A las 8:30 p. m. la ejecución natural materializó 105 filas de tres juegos. Confirmamos en Supabase que 28 pertenecen a los 45 anticipados, con las mismas estadísticas, minutos, equipo, hora y huella que sus originales. El job registró cero errores, llamadas al proveedor y cambios a picks oficiales. Marcó cuatro contextos pendientes. La fila de los Clippers siguió en cuarentena.

| Estado de los 222 al cierre del ciclo de las 8:30 p. m. | Pares |
|---|---:|
| Ya materializados y cotejados | 119 |
| Reproducción aprobada y escritura natural pendiente, juegos 21718147 y 21718149 | 17 |
| Participación con box no conciliado, juego 21718158 | 5 |
| Participación o DNP sin evidencia suficiente | 81 |

En el último grupo, 79 pares de 52 juegos tenían archivo identificado y dos contaban solo con el contexto operacional. Figurar en el banco sin una fila estadística no basta para certificar un DNP. La ejecución natural y sus resultados posteriores tienen un control de solo lectura ya programado para las 9:40 p. m. PR. [Cohorte inicial y mejora de presentación](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/401)

## Reproducción y aceptación

Desde la raíz de la rama, ejecutar los siguientes controles.

```sh
node --test tests/nba-storage-integrity.test.mjs
node --test-concurrency=2 --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/nba*.test.mjs
npm run build
```

La ejecución local completó 334 pruebas NBA con cero fallos. El build de Next.js y TypeScript terminó con código 0 y generó 400 páginas.

La nueva prueba usa 15 box scores sintéticos con hash y marcador conciliados. Verifica los diez juegos incluidos, el juego antiguo necesario tras un DNP, el orden por fecha pese a identificadores discontinuos, la reutilización de caché, el presupuesto entre pasadas, el rechazo de bytes corruptos y la prioridad de un original operacional en cuarentena. Para aceptar el cambio en producción hay que comprobar en un corte común el contenido efectivamente cotejado, los motivos de exclusión, los tiempos del tablero y los contadores de lecturas. La clasificación favorable sigue dependiendo de todos los controles del mercado. La mejora de presentación se revisa por separado en el PR #401.
