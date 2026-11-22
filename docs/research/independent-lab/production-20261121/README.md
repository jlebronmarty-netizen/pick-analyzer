# PR #396 — integración y verificación en producción

## Estado al cierre del 21 de noviembre de 2026

**PR #396 fusionado; producción verificada.** Vercel quedó `READY` a las **8:38:52 p. m., America/Puerto_Rico**. El dominio principal y el despliegue inmutable respondieron con el commit `a3d2a1a15ba4afa8594c933efe2a1c3de01458be`. La comprobación posterior observó HTTP, datos archivados y huellas de historial entre las 8:39 y 8:42 p. m. PR. Esta evidencia acredita el despliegue y sus lectores; la primera emisión GOAT V1.1 y los siguientes ciclos naturales de Decision V2 quedan pendientes.

- [PR #396 integrado](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/396).
- [Despliegue de producción](https://vercel.com/pick-analyzer/pick-analyzer/GYajmAvr5sZtFpVXUftPHZBRhUtB).
- [Tablero NBA](https://pick-analyzer.vercel.app/nba-decision-board) y [NCAAB](https://pick-analyzer.vercel.app/ncaab).
- [Alcance y verificación original de las correcciones](../2026-11-21-corrections.md).

La autorización del usuario cubrió integrar el PR y verificar su despliegue, conservando SHADOW y `JUGADA` bloqueada. Las lecturas de esta verificación hicieron cero llamadas adicionales a proveedores deportivos y cero escrituras en la base de datos. No se ejecutaron crons manuales, backfills ni promociones.

## Integración y pruebas

Antes de fusionar, `main` había incorporado el PR #394 (`ddad50856161f47f4d8799cab4769f4a1d774521`). Se integró ese cambio en la rama y se resolvieron únicamente dos conflictos de encabezados en los documentos maestros, conservando ambos contenidos. El PR #395 mantiene su alcance independiente.

| Comprobación | Resultado |
|---|---|
| Head de integración probado | `d1daf845e8aa5a9bdbfbba6b0b89c2c5ea131554` |
| Árbol probado y árbol del merge | `510af8b9c7cc55e31e264d0b8b3ac5db485b450a`, idénticos |
| Commit de producción | `a3d2a1a15ba4afa8594c933efe2a1c3de01458be` |
| GitHub sobre el head integrado | 9 de 9 workflows aprobados; Vercel preview `success` |
| Suite local original | 354 de 354 pruebas de las suites afectadas |
| CI NCAAB integrado | 31/31 NCAAB, 122/122 dashboard, TypeScript y 400/400 páginas |
| CI College integrado | 17/17 college, 122/122 dashboard y TypeScript |
| Navegador en CI integrado | 2/2: escritorio y móvil; componentes reales con fixture de prueba |

Los recuentos de las suites solapadas no se suman como pruebas independientes. Las pruebas de navegador de CI no se presentan como una sesión interactiva de producción. Evidencia: [CI integrado](ci_d1daf845_final.json), [College](ci_d1daf845_college.json), [merge](merge-result.json) y [despliegue](deployment.json). Los runs principales son [NCAAB](https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/44967176439) y [College](https://github.com/jlebronmarty-netizen/pick-analyzer/actions/runs/44967176475).

## Respuestas reales de producción

Los accesos protegidos usaron la autenticación disponible del despliegue. No se publican tokens, cookies, cabeceras de autorización ni respuestas privadas completas.

| Ruta | Resultado observado |
|---|---|
| `/api/system/version`, dominio principal e inmutable | HTTP 200, ambiente `production`, commit exacto `a3d2a1a1` |
| `/ncaab` | HTTP 200; referencias archivadas, DraftKings y advertencias de modelo/precio presentes; cero errores Flight |
| `/api/ncaab/overview` | HTTP 200, `AVAILABLE`; 940 observaciones, 131 eventos cotejados y 21 con cuotas en la ventana; cobertura `PARTIAL`, sin errores de fuente |
| `/api/ncaab/calibration-shadow` | HTTP 200, `REVIEW_INVALID_EVIDENCE`; 91 congelados, 22 liquidados válidos, 68 pendientes y 1 inválido; promoción y holdout acreditado en false |
| `/api/model-learning/overview` | HTTP 200, `AVAILABLE`; sin errores y sin promoción automática; NBA separado por versión y mercado |
| `/nba-decision-board` | HTTP 200; las seis etiquetas de navegación presentes en SSR; cero errores Flight |
| `/api/nba/decision-board` | HTTP 200; 5 juegos, 1,154 lados, 25 candidatos de estudio y 0 picks calibrados |
| `/api/nba/decision-learning` | HTTP 200, `EXPLORATORY_PROSPECTIVE_SHADOW` |
| `/api/market-data/nba/model-report` | HTTP 200, `AVAILABLE`; versión histórica V1 y muestras por mercado |
| `/api/nba/goat/audit` | HTTP 200, `ATTENTION`; seis contratos GOAT pendientes, sin promoción |

`REVIEW_INVALID_EVIDENCE`, cobertura parcial y `ATTENTION` son estados de datos que se muestran expresamente; un HTTP 200 no certifica su aptitud para apostar. El chequeo de producción verifica HTML servido y APIs, sin afirmar haber recorrido filtros hidratados con un navegador. El componente experimental `/nba-decision-v2` sigue limitado a Preview por diseño.

Evidencia: [HTTP principal/NCAAB](http-main.json), [HTTP NBA resumido](http-nba-summary.json) y [seis vistas](ui-labels.json). Una primera sonda buscó `Props` con una etiqueta incorrecta; la comprobación final usa el texto real `Player props` y confirma las seis vistas. Ese falso negativo del arnés no se registra como defecto del producto.

## Corte NBA a las 8:41:36 p. m. PR

| Mercado | Lados archivados evaluados | Contratos con preferencia descriptiva |
|---|---:|---:|
| Moneyline | 10 | 0 |
| Spread | 10 | 0 |
| Total | 12 | 0 |
| Player props | 842 | 0 |
| Cuartos / Mitades | 280 | 61 |

El Top muestra 25 candidatos de investigación y **cero `JUGADA`**. Las preferencias por contrato y las clasificaciones de los lados originales son estructuras distintas; no se equipara el recuento de 61 preferencias con las 37 filas originales `VIGILAR`. El orden de estudio no constituye una probabilidad validada ni una demostración de EV positivo.

La calidad de los 1,154 lados se distribuye en 360 `INCOMPLETE_HISTORY`, 482 `PARTIAL`, 62 `STALE`, 50 `CONTRACT_UNVERIFIED` y 200 `VALIDATED`. El lector devuelve cero llamadas de proveedor, cero escrituras y política `ARCHIVED_ONLY`. La captura HoopsAPI más reciente es de **7:15:46 p. m. PR**; la captura de calendario es de **8:30:16 p. m. PR**. La hora del informe no se confunde con la hora de cada fuente.

Hay tres incidencias de captura: identidad/fase incompatible en el mercado principal de los juegos `21718156` y `21718157`, y fuente de props no disponible para `21718156`, que permanece en cuarentena. Son alertas de cobertura pendientes, no contratos que puedan rellenarse con cuotas supuestas. [Resumen archivado del tablero](nba-board-summary.json).

## Integridad de los historiales

Se comparó un corte previo de **8:30:52 p. m. PR** contra una lectura posterior de **8:39:10 p. m. PR**. Las seis huellas SHA256 y sus conteos coinciden exactamente.

| Conjunto preservado | Filas | Alcance de la huella |
|---|---:|---|
| Decision V1 forecasts | 963 | Filas completas |
| Decision V1 outcomes | 693 | Filas completas |
| Decision V2 forecasts | 40 | Filas completas, incluidos record y benchmark |
| Decision V2 judgments | 15 | Filas completas |
| NCAAB calibration SHADOW | 91 | Filas completas |
| GOAT CURRENT_ERA_SHADOW | 93 | Campos congelados de predicción, precio, entradas, versión y elegibilidad; excluye estado mutable de liquidación |

Una lectura completa de las 8:39:28 p. m. PR encontró cero filas nuevas fuera del corte. Esa observación es puntual: nuevas filas de los crons posteriores deben contabilizarse aparte y no confundirse con alteraciones a los originales. [Comparación de hashes](comparison.json), [método y resultados](data-verification.md), [SQL previo](baseline.sql) y [SQL posterior](after-cutoff.sql).

La variable de producción `NBA_DECISION_V2_MODE` se leyó directamente y conserva el valor `shadow`. Los 40 forecasts V2 continúan `VIGILAR`; los 93 GOAT mantienen cero recomendados/elegibles/stakes y los 91 NCAAB cero oficiales/elegibles. No se modificaron permisos ni variables de entorno durante esta entrega. [Elegibilidad posterior](eligibility-after.json).

## Muestras independientes y pendientes

Los tres conjuntos se siguen por separado:

1. **Decision estadístico V1:** 963 contratos en 19 juegos; 693 resultados en 13 juegos y 270 pendientes en ocho. Los juegos liquidados y pendientes se solapan. El lector de métricas tiene 39 grupos baseline y 30 grupos candidatos, con un máximo de 13 juegos independientes por comparación y cero promociones. Hay **15 props pendientes de más de 24 horas**, presentes antes del despliegue: uno en `21718144` y catorce en `21718148`.
2. **Decision operativo V2**, esquema privado `nba_v2_shadow`: 40 pronósticos en ocho juegos, 15 resultados en tres y 25 pendientes en cinco. El ciclo automático de las 7:35 p. m. consideró 1,148 filas y 25 elegibles, con cero inserciones porque ya estaban importados. No acredita una primera captura nueva ni una primera liquidación automática.
3. **GOAT V1 / nueva V1.1:** al corte solo hay 93 filas V1. El despliegue prepara la nueva cohorte `nba_prediction_engine_v1_1_inputs_shadow`; falta observar una emisión natural que cumpla los requisitos. Las métricas históricas no se atribuyen a V1.1.

No se declara una mejora validada ni una apuesta aprobada. Siguen faltando muestras prospectivas suficientes, al menos 100 juegos independientes y holdout separado conforme al contrato de investigación. Ni el cambio de versión ni un número grande de selecciones del mismo partido resuelven esa falta de evidencia.

## Observabilidad y próximos ciclos

La consulta de logs del despliegue exacto no devolvió errores, advertencias ni fatales entre **8:38:52 y 8:42:04 p. m. PR**. Es una ventana acotada, no una garantía sobre ejecuciones futuras. [Resultado de logs](runtime-logs.txt) y [filtros utilizados](runtime-log-query.json).

Las lecturas de esta entrega no llamaron proveedores. El último archivado ordinario, a las 8:30:26 p. m. PR y anterior al despliegue, declara siete solicitudes del gateway dentro del cron existente; ese consumo programado se conserva distinguido del consumo cero de la verificación.

| Hito pendiente al corte | Horario existente PR | Evidencia requerida |
|---|---|---|
| Primera emisión GOAT V1.1 | Siguiente turno 21-nov, 9:00 p. m. | Filas nuevas o motivos de exclusión, versión, precios reales y huellas previas intactas |
| Liquidación Decision V1/V2 | 22-nov, 8:15 a. m. | Resultados nuevos frente a recibos finales, pendientes, duplicados, continuidad V1 |
| Congelaciones Decision V1/V2 | 22-nov, 11:35 a. m. y 7:35 p. m. | Nuevos pronósticos previos al inicio, captura y precio vigentes, estado de los importados |

Se actualizó el contenido de la revisión diaria NBA existente para seguir estos tres conjuntos, las nuevas emisiones y la cola antigua. Mantiene el horario diario de **6:00 p. m. PR**. **Cero tareas adicionales y cero cambios de horarios.** No se forzó ningún ciclo para completar el informe. [Continuidad del seguimiento](daily-followup.json).

## Alcance de este registro documental

Este directorio contiene evidencia agregada y consultas de solo lectura. La rama documental `research/pr396-production-verification` tiene los despliegues desactivados por la regla existente `research/*`; no añade cambios de aplicación ni pretende reemplazar el commit de producción. Las entradas anteriores en los documentos maestros se conservan como historial y este cierre actualiza su estado.
