# NBA V2 · Liquidación prospectiva y operación diaria

**21 de noviembre de 2026, Puerto Rico.** El primer lote quedó liquidado en su totalidad fuera de producción. Seis contratos Over ganaron y nueve perdieron. Los tres partidos independientes aportan tres observaciones por período. El Challenge tiene **$187.94** de capital informado y **SIN APUESTA**.

## Los 15 resultados

Cada celda muestra la línea Over congelada, el total de puntos observado y su liquidación estadística. Q4 comprende el cuarto reglamentario. H1 suma Q1 y Q2. Los tres partidos finalizaron en cuatro cuartos.

| Visitante @ local | Final | Q1 | Q2 | Q3 | Q4 | H1 |
|---|---|---|---|---|---|---|
| Phoenix @ Utah | 111–101 | 58.5 → 49 perdida | 57.5 → 61 ganada | 55.5 → 55 perdida | 53.5 → 47 perdida | 116.5 → 110 perdida |
| Houston @ Denver | 124–133 | 55.5 → 64 ganada | 54.5 → 58 ganada | 59.5 → 79 ganada | 56.5 → 56 perdida | 109.5 → 122 ganada |
| Sacramento @ LA Lakers | 104–106 | 59.5 → 56 perdida | 57.5 → 60 ganada | 56.5 → 50 perdida | 54.5 → 44 perdida | 118.5 → 116 perdida |

La lectura de archivos se acotó a las 4:00:30 p. m. PR. Las 30, 29 y 30 capturas finales respectivamente tenían una sola versión de los marcadores. Los parciales cuadraron con el marcador final y con el juego registrado en el box score operacional GOAT. Verificación de identidad, hora de inicio y ambos equipos por ID de origen. Cero devoluciones, disputas o pendientes en el primer lote. Cada liquidación conserva su ID de pronóstico, total observado, resultado, snapshot y hora de recepción. El blob Git de los pronósticos sigue siendo `e1552f38f8c3e2b22fdb613aaaf5acec7a7d416a`. [Pronósticos originales](../forward-20261120.json) · [15 liquidaciones](../outcomes-20261120.json) · [Recibos de precios y marcadores](evidence-20261120.json)

## Métricas prospectivas

| Período | Over ganados | Aciertos del clasificador | Brier V2 | Brier operador sin margen | Log loss V2 | EV medio congelado | ROI simulado |
|---|---:|---:|---:|---:|---:|---:|---:|
| Q1 | 1/3 | 3/3 | 0.1899 | 0.2631 | 0.5719 | −15.13% | −37.68% |
| Q2 | 3/3 | 2/3 | 0.2179 | 0.2534 | 0.6276 | +1.79% | +90.03% |
| Q3 | 1/3 | 2/3 | 0.2265 | 0.2516 | 0.6459 | −3.82% | −34.62% |
| Q4 | 0/3 | 1/3 | 0.3229 | 0.2501 | 0.8429 | +6.32% | −100.00% |
| H1 | 1/3 | 3/3 | 0.2056 | 0.2415 | 0.6033 | −9.50% | −38.42% |
| **Descriptivo combinado** | **6/15** | **11/15** | **0.2326** | **0.2519** | **0.6583** | **−4.07%** | **−24.14%** |

Un acierto del clasificador significa que acertó si el Over iba a ganar aplicando el umbral de 50%. El ROI simula una unidad en cada Over a la cuota americana congelada, igualando el peso de cada juego. Los precios americanos de HoopsAPI son aproximaciones archivadas de sus cuotas decimales. El mismo ejercicio con los precios decimales exactos de los 15 contratos dio −24.13%, IC descriptivo [−63.60%, +53.18%]. Para comparar al operador se conciliaron ambos precios decimales originales, libro, partido, período, línea, timestamp y captura pregame. El log loss del operador fue 0.6970. La ejecución en Puerto Rico sigue sin confirmar. El EV expresa la expectativa del modelo en el momento de congelación. De los siete Over con EV estimado positivo, cuatro ganaron y tres perdieron. El ROI simulado de ese subconjunto, dando igual peso a cada partido, fue −5.10% (IC descriptivo [−100.00%, +93.72%]).

Intervalos percentiles descriptivos del 95%, por partido independiente. Brier [0.2142, 0.2535], log loss [0.6214, 0.7008], accuracy [40%, 100%], ECE [0.2841, 0.4950], EV [−8.12%, −1.86%], ROI [−63.61%, +53.18%]. El ECE puntual fue 0.2860 en diez intervalos. La diferencia Brier V2 menos operador fue −0.0194, intervalo [−0.0436, +0.0007]. Se enumeraron las 27 combinaciones de tres juegos con reemplazo, manteniendo juntos sus períodos solapados. Con esta muestra, esos límites describen solo la variación entre los tres juegos observados. Para cohortes mayores se usa bootstrap por partido. [Métricas, intervalos, precios y razones por contrato](prospective-report.json)

El segundo lote quedó anclado en GitHub a las **4:22:21 p. m. PR** en el commit `6265600e`. Se congeló el 21 de noviembre a las **4:02:46 p. m. PR**, antes del primer inicio a las **8:30 p. m. PR**. Consiste en 25 contratos de cinco partidos con sus 25 pares de precios. Las protecciones descartaron el partido ya iniciado y las filas sin evidencia suficiente. Para Q1–Q4 y H1 hay 3 juegos liquidados y 5 pendientes por período. Para Moneyline, Spread, Total de partido completo, asistencias y H2 hay cero juegos V2 liquidados. El mínimo de 100 por versión y alcance sigue pendiente. [Segundo lote](../forward-20261121.json) · [Contexto del segundo lote](evidence-20261121.json)

## Vista y Challenge

La ruta `/nba-decision-v2` muestra el archivo de la rama en el entorno preview. Hay filtros por jornada y resultado, detalle de probabilidad, implícita, EV, precio, captura, historial, contexto, versión y motivo. Los L5/L10 sin recibo se muestran como ausentes. El informe distingue ausencia de observaciones, clasificación pregame y liquidación posterior. La vista no consulta proveedores ni el saldo de una cuenta. La navegación del tablero oficial conserva sus seis vistas. Una preview con protección de acceso podrá usar `NBA_DECISION_V2_PREVIEW_LEDGER=read` tras la autorización. Esa opción lee el último informe publicado y los primeros pronósticos posteriores de las dos jornadas más recientes. Distingue el corte de métricas del momento de captura, almacena la respuesta durante cinco minutos y muestra los fallos de lectura. El saldo sigue siendo el informado por el usuario.

El saldo declarado consta en centavos. $177.92 provienen de las jugadas de Atlanta y $10.02 del cash out de Oklahoma City. La clasificación ejecutable del Challenge sigue vacía. Los pronósticos futuros y estas simulaciones no cambian el saldo. [Saldo informado](challenge-balance.json)

## Procedimiento original de activación

El 21 de noviembre se autorizó la integración escalonada hasta una observación manual en producción. [Procedimiento aprobado para esta etapa](observe-release.md)

1. **Integrar en la rama** el parche `scripts/research/nba-v2/daily/activate-after-approval.patch`, revisar el diff y aprobar el release. Reutiliza el tablero que ya cargó la congelación V1. El modo predeterminado es desactivado. El PR actual deja el parche separado y conserva intactos `vercel.json`, los handlers de cron y el servicio V1.
2. **Provisionar solo el almacenamiento V2** con `storage-proposal.sql` en una transacción aprobada. El esquema privado guarda ejecuciones, forecast original, precio contrario, observaciones de liquidación y reportes. Los RPC públicos son de tipo invoker y están revocados para público, anon y authenticated. El cliente existente de servidor usa el rol de servicio. Revisar los privilegios y el acceso PostgREST en el entorno de destino.
3. **Importar los dos lotes manuales y la primera liquidación** antes del primer ciclo operativo. `node scripts/research/nba-v2/daily/seed-proposal.mjs` solo imprime el SQL a revisar. Verifica hashes de los seis archivos, conserva el JSON original y almacena los precios comparativos por separado. Repetir la semilla antes de activar mantiene 40 forecasts y 15 resultados. Usar el mismo hash/modelo para evaluar la cohorte.
4. **Observar un ciclo completo** con `NBA_DECISION_V2_MODE=observe`. La congelación utiliza el tablero en memoria. La liquidación lee el archivo de calendarios y, para props, el box original y el compacto. Registrar duración, volumen de lecturas, tamaño de descartes, expiración de precios, resultados pendientes y comportamiento V1. Contrastar con los límites contratados. Si el presupuesto disponible o el tiempo del cron son insuficientes, mantener el modo desactivado.
5. **Habilitar solo SHADOW** con `NBA_DECISION_V2_MODE=shadow` dentro de la autorización de activación. Aprovechar las 11:35 a. m. y 7:35 p. m. PR para congelar y las 8:15 a. m. PR para liquidar. Se respeta la ventana ya admitida por V1. La hora de escritura y la expiración se comprueban en la base. Registrar la primera clave por hipótesis y publicar cada ciclo en una sola transacción, incluidos sus descartes. Un reintento de la misma franja reutiliza el ciclo. Una segunda franja conserva el primer pronóstico de cada hipótesis. El límite por lectura de liquidación es de 12 juegos; los juegos nuevos y los que llevan más tiempo sin comprobar tienen prioridad. Los liquidados vuelven a revisarse durante siete días. Una corrección posterior a esa ventana requiere revisión explícita.
6. **Comprobar los primeros ciclos** en logs V2 y ledger. Contrastar cantidad de candidatos, rechazos por motivo, precios con par, pronósticos únicos, resultados pendientes y número de juegos independientes. El reporte lee páginas de 100 por clave estable hasta el ciclo confirmado. Si la publicación del reporte falla, el reintento recompone ese corte sin duplicar resultados. El wrapper registra fallos V2 preservando el resultado V1. Si aparecen duplicados, registros post-tip, diferencias en V1, errores continuos, tiempo o uso fuera del presupuesto, volver a `off`. El historial experimental permanece disponible y la operación de rollback no requiere borrar filas.

Un dato retirado o un final posterior incompleto suspende la puntuación. Una confirmación concordante puede recuperarla. Dos resultados definitivos contradictorios para el mismo pronóstico quedan en disputa. El objetivo es recolectar evidencia, no reajustar automáticamente parámetros. Cualquier nueva versión inicia un seguimiento separado. Autorizar esta operación no autoriza `JUGADA`, cambios a modelos oficiales ni llamadas a proveedores.

## Evidencia reproducible

- `scripts/research/nba-v2/daily/initial-evidence.sql` contiene las cinco consultas de solo lectura con el corte fijo. Exportar los arrays a los nombres indicados y ejecutar `verify-initial.mjs CARPETA archivo-nuevo.json`. Volver a ejecutar `settle.mjs` produjo los mismos 15 resultados. `receipt-context.mjs` reprodujo el acompañante del segundo lote. `compile-view.mjs` regenera las métricas y la vista sin red.
- Las pruebas de la rama cubren el corte anterior al partido, par de cuotas, descartes, cuarentena de revisiones, recuperación y ponderación por partido. La prueba de integración usa dos conexiones PostgreSQL, transacciones reales y un esquema desechable local. Incluye semilla repetida, colisión entre conexiones, fallo tras escritura parcial, precio expirado/franja inválida, persistencia del primer forecast, permisos y recuperación tras fallo del reporte.
- El SQL propuesto se ejecutó fuera de producción en PostgreSQL 17.6, la misma versión reportada por Supabase. Se verificaron las siete funciones RPC, dos conexiones concurrentes y los roles anon, authenticated y service_role. La prueba de la interfaz filtró los 15 resultados y los 25 pendientes en escritorio y móvil. La ruta devolvió 404 en el servidor local con configuración de producción.
- Pasaron 38/38 pruebas de las cinco suites afectadas, las dos pruebas de Playwright de la vista archivada y la compilación de Next.js con TypeScript (400 páginas). La lectura opcional del registro diario también se comprobó en Chromium en escritorio y móvil mediante una respuesta HTTP local simulada, incluido el salto de 15 resultados a 25 pronósticos posteriores. La integración SQL se ejercitó por separado contra PostgreSQL real. Comandos de regresión:
  ```sh
  node --test tests/nba-v2-daily.test.mjs tests/nba-probability-research.test.mjs tests/nba-decision-probability-v2.test.mjs tests/nba-decision-learning.test.mjs tests/nba-history-integrity.test.mjs
  node tests/nba-v2-postgres.integration.mjs
  npm run build
  ```
  El segundo comando requiere una base `postgres` local desechable con el rol propietario `v2_test_owner` en loopback en el puerto 31873 y el cliente `pg` disponible. El build local final se completó con 4,864 MiB de heap tras alcanzar el límite predeterminado en un intento.
- Estado operativo al corte: Vercel producción READY en `9275118c`. Las consultas a Supabase de esta revisión fueron de solo lectura. La integración con la API PostgREST de producción, los permisos reales del nuevo esquema y el consumo efectivo en Vercel solo podrán verificarse tras aprobación.
