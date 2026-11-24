# NBA V2 · Revisión prospectiva del 24 de noviembre

Corte del ciclo 11 a las 8:15:24.503 a. m. Puerto Rico. Modelo `nba-residual-20261120.1`, hash `1ec8aff30c264bec1f87917f326db5affb85f508457dc5031b16f80016101329`. Se consultaron originales, forecasts, observaciones e informes existentes mediante SELECT. La rama prepara el seguimiento del ledger para el mismo acceso privado del Decision Board. En producción se exige el hostname del deployment autenticado y se lee el informe publicado. Un error de lectura o un modelo distinto muestra indisponibilidad. Preview conserva la opción de reproducir el archivo fijo.

## Evidencia disponible

Hay 125 pronósticos únicos de 25 partidos. Las 125 hipótesis independientes por modelo, partido, mercado/período, jugador y lado conservan sus identidades. Todos pasan el orden quoteAt ≤ capturedAt ≤ featuresAsOf ≤ frozenAt = decisionAt = captured_at, diez minutos antes del inicio, vencimiento posterior y calidad/contrato validados para evaluación estadística. La región de ejecución continúa sin acreditar.

Los ciclos naturales 4, 6, 7, 9 y 10 consideraron respectivamente 25, 34, 25, 50 y 50 elegibles. Los forecasts ligados directamente a esos ciclos fueron 0, 34, 1, 50 y 0. El ciclo 7 añadió una hipótesis del mismo juego ya presente en otra franja. Los 40 importados y sus 15 resultados preservan los hashes de referencia. El SQL reproduce la huella como SHA-256 de la concatenación ordenada de hashes de arrays JSONB por registro. El hash de un array agregado usa otra serialización.

El ledger tiene 175 observaciones de liquidación, incluidas revisiones de resultados, con 125 contratos distintos. Las 175 coinciden en actual y resultado con el snapshot específico del calendario guardado antes de su corte. Se verificaron el estado final, el game ID, las horas de recepción y registro, Q1–Q4 reglamentarios y H1 como Q1+Q2 de ambos equipos. En el informe publicado hay cero pushes, disputas y pendientes.

Se reconstruyeron los lotes desde los forecasts inmutables y todas sus observaciones, aplicando `evaluateForward` y los pares de precios originales. Las métricas y los intervalos coinciden con el informe del ciclo 11, con tolerancia absoluta 1e-12. [Informe reproducido](prospective-metrics.json) · [Consultas de control](audit.sql)

## Resultados por mercado

| Mercado | Juegos liquidados | Ganados / perdidos | Brier V2 | Brier operador sin margen | ROI simulado |
|---|---:|---:|---:|---:|---:|
| Total Q1 | 25 | 13 / 12 | 0.3033 | 0.2495 | −1.88% |
| Total Q2 | 25 | 11 / 14 | 0.2454 | 0.2472 | −17.54% |
| Total Q3 | 25 | 11 / 14 | 0.2551 | 0.2478 | −17.50% |
| Total Q4 | 25 | 11 / 14 | 0.2590 | 0.2462 | −16.61% |
| Total H1 | 25 | 10 / 15 | 0.2324 | 0.2500 | −23.66% |
| Moneyline, Spread, Total completo, H2, Props asistencias | 0 | 0 / 0 | — | — | — |

El combinado descriptivo reúne los mismos 25 juegos y 125 contratos, con Brier 0.2591 frente a 0.2482 del operador y ROI simulado −15.44%. Su diferencia Brier tiene IC95% [−0.0093, 0.0363]. Q1 presenta peor Brier en esta muestra y su intervalo de diferencia es [0.0121, 0.0987]. Los intervalos de Q2, Q3, Q4 y H1 incluyen cero. Las probabilidades siguen experimentales. Se conservan reglas, parámetros, forecasts y versiones. La muestra actual aporta 25 de los 100 partidos prospectivos mínimos por mercado de períodos. Los mercados con cero requieren primeras congelaciones elegibles y liquidaciones del ciclo existente.

ROI simula una unidad en el lado congelado a la cuota americana archivada, con igual peso por partido. Se distingue de accuracy del clasificador al umbral de 50%, que puede acertar al anticipar una pérdida del Over. La disponibilidad regional y la ejecución real siguen pendientes. El JSON contiene calibración, MAE, Log Loss, EV, ROI e intervalos por partido calculados por el evaluador existente. La historia de entrenamiento permanece separada.

## Vista propuesta y verificación

El enlace desde el Decision Board abre el seguimiento V2. La tabla presenta métricas por mercado, intervalos Brier, versión, corte, tamaño independiente y motivos. El detalle conserva las dos últimas jornadas, mientras las métricas abarcan toda la cohorte. La cifra $187.94 del Challenge se identifica como informada por el usuario el 21-nov. El lector emplea el RPC STABLE `nba_v2_shadow_review`, de solo lectura, con caché de hasta cinco minutos. Lee un informe ya publicado y no ejecuta handlers ni recalcula métricas en producción.

La evaluación de acceso requiere el hostname validado del proyecto, el tablero habilitado y el encabezado de autenticación que suministra Vercel. En producción el origen de la vista siempre es el ledger. Las pruebas rechazan peticiones sin autenticación, otros entornos/hosts, informes de otro modelo e informes incompletos. Se mantiene la interfaz Preview de archivo para las pruebas de navegador. La revisión de permisos no necesita cambios.

La comprobación local del ledger real reprodujo 85 contratos en el detalle de dos jornadas, 25 juegos independientes y las métricas de mercado del informe. Las pruebas de interfaz cubren la tabla, el estado sin resultados, el Challenge y los filtros en escritorio y móvil. La publicación de esta propuesta requiere revisar el PR y autorizar su integración. JUGADA continúa desactivado.

## Reproducir las métricas y las pruebas

Exportar por separado los SELECT de forecasts, judgments y report de `audit.sql` como arrays JSON y objeto de informe. Ejecutar desde la raíz del repo.

```sh
node scripts/research/nba-v2/verify-published-report.mjs docs/research/nba-v2/model.json forecasts.json judgments.json report.json
node --test-concurrency=2 --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/nba*.test.mjs
npm run build
```

Se reprodujeron exactamente todas las métricas e intervalos del informe del ciclo 11. Pasaron 336 pruebas NBA y el build de Next.js y TypeScript, con 400 páginas. La comprobación de navegador de escritorio y móvil se añade al workflow existente para validar este PR. No se repiten llamadas de proveedores.

## Lo que falta para completar NBA

- Sumar 75 juegos independientes prospectivos por cada período ya evaluado y estudiar calibración/estabilidad antes de revisar una promoción.
- Iniciar muestras válidas en ML, Spread, Total y Props con contratos y datos suficientes.
- Acreditar jurisdicción, disponibilidad y condiciones del precio concreto, además de prórroga por mercado.
- Conciliar los dos boxes en cuarentena y acreditar participación o DNP en los historiales incompletos.
- Medir la lectura de originales de #403 cuando una jornada requiera esos archivos.
- Revisar contraste del tema claro por separado.
