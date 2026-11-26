# NBA Cheat Sheets en Pick Analyzer

## Reanudación controlada · cuarta migración

La migración 202611260903_nba_sheet_view_acl limita los permisos a las cuatro vistas identificadas. El control exige SELECT sin delegación para service_role, ausencia de permisos efectivos por tabla y columna para anon y authenticated, y security_invoker. La prueba reproduce los privilegios predeterminados de producción y comprueba un permiso heredado mediante membresía; ejecutar este control en cada futuro tracker deportivo. Continuar con la lectura de catálogo antes de fusionar y activar. Los estados siguientes describen el corte anterior a esta corrección.


## Publicación controlada · estado de producción

Las tres migraciones están aplicadas. El escritor continúa apagado y la fusión está detenida por permisos adicionales sobre cuatro vistas. [Evidencia, procedimiento de reanudación y requisitos para NHL](NBA_CHEAT_PRODUCTION_ACL_REVIEW.md).


## Integridad de liquidación · revisión del PR #408

La liquidación de partido completo usa la fila individual normalizada que devuelve el verificador. Las estadísticas de períodos conservan su conciliación independiente con Play-by-Play.


## Tracker prospectivo · revisión de lanzamiento de NBA

La portada, el análisis avanzado y el tracker comparten el archivo prepartido. Las visitas son de lectura. El cron captura y liquida con activación explícita. [Auditoría, fórmulas, pruebas y procedimiento de activación](NBA_CHEAT_LAUNCH_REVIEW_20261125.md).


## NBA · Revisión posterior a 747b1b66 · 25-nov-2026

Entrega NBA de revisión. La portada mantiene sus rankings y da acceso al análisis por contrato, perfiles y combinados. [Informe de implementación, pruebas y pendientes](NBA_CHEAT_REVIEW_20261125.md).


Guía de continuidad · revisión del 25 de noviembre de 2026 (Puerto Rico). Revisar la rama `feat/nba-cheat-sheets`, PR #408, antes de consultar producción. El estándar de diseño es la vista NBA del commit `2bd1709ea1c96f11bf97a5ee87929074a4db03d8`. Esta revisión extrae componentes de presentación y recupera las funciones exclusivas del Site como referencia ejecutable.

## Dónde empezar

1. Leer `AGENTS.md` y estas cuatro guías. [Contrato de datos](CHEAT_SHEETS_DATA_CONTRACT.md) cubre fuentes y cálculos. [Arquitectura compartida](CHEAT_SHEETS_MULTISPORT.md) delimita la responsabilidad de los componentes. [Roadmap](CHEAT_SHEETS_ROADMAP.md) contiene criterios de aceptación y revisión de salida.
2. En GitHub abrir `jlebronmarty-netizen/pick-analyzer`, comparar el HEAD de #408 con `main` y revisar PR concurrentes. En Vercel buscar el proyecto `pick-analyzer` (`prj_hmkAkzUTe3b7M7yedvshGl5L9rP7`), filtrar por el SHA exacto y exigir READY. El alias de esta rama sirve la [vista privada](https://pick-analyzer-git-feat-nba-cheat-sheets-pick-analyzer.vercel.app/nba-cheat-sheets).
3. En Supabase consultar el catálogo del proyecto `ynuocvexviorgdjrfthw` y los cortes archivados. Usar la fecha local `America/Puerto_Rico` y conservar el instante UTC. Probar el API con los IDs y el corte de la misma tarjeta.
4. Para implementar una capacidad adicional, reproducir primero su prueba de referencia con datos locales. El informe final de esta entrega se encuentra en el roadmap. La salida a producción requiere decisión posterior.

## Inventario NBA y correspondencias

La columna de situación describe la rama de revisión. En esta tabla, los archivos sin ruta de Pick pertenecen a la fuente NBA del Site V13. “NBA manual” designa el servicio `src/services/nba-manual-data.service.ts` y su API en Pick.


| Funcionalidad | Situación en Pick | Fuente, implementación en Site y acción futura |
|---|---|---|
| Dashboard de jornada, fecha PR, partidos, búsqueda y cobertura | Parcial | NBA manual → src/nba-ui.js y src/nba.html. Conectar las tarjetas al mismo corte, mostrar antigüedad y navegar a partido/equipo/jugador. |
| Comparativa de equipos, L5/L10/temporada observada, PF/PC, margen, récord, previos y descanso | Parcial | NBA manual → teamHistory, previousMeetings, average, estimates en src/nba-history.mjs. Preservar la identidad de los equipos, localía y muestras reales. |
| Proyección descriptiva y contraste de spread/total por cuarto, mitad y partido | Parcial | Finales/parciales y precios NBA manual → periodForm y archiveGap en nba-history.mjs. Mantener cobertura por equipo y signo según local/visitante. Sin incorporar la estimación a los modelos. |
| Plantel por encuentro, búsqueda, tarjeta y comparativa de dos jugadores | Parcial; #408 ya compara posición rival y promedios | roster y appearances en nba-history.mjs; gráficos y selectores en nba-ui.js. Reutilizar comparación del PR. Conservar selección manual de dos jugadores y desglose por contrato cuando falten en Pick. |
| Historial de apariciones y auditoría de calendario | Parcial en main | decision-integrity de Pick y enrichEvidence/auditRows en src/nba-evidence.mjs. Integrar Jugó, DNP por cero minutos registrados, fila ausente, conflicto y métrica ausente. Distinguir últimos partidos del equipo de últimas apariciones del jugador. |
| Puntos, rebotes, asistencias, triples, robos, tapones y pérdidas individuales por segmento | Exclusiva identificada para la conciliación completa | PBP + box → maintenance/nba/nba-period.sql, nba-box.sql, reconcile.py; periodRows en nba-evidence.mjs. Portar agregación, conciliación y corte temporal a gráficas, tarjeta y ranking. |
| Props combinados, doble-doble, triple-doble y minutos | Parcial; #408 centra su ranking en PTS/REB/AST/3PM | src/nba-props.mjs, propMetrics/playerValues. PRA, PR, PA y RA requieren componentes válidos del mismo segmento. DD/TD exigen las cinco categorías. Los minutos de segmento quedan ausentes. |
| Contratos de FanDuel PR y antigüedad de cuotas | Parcial | NBA manual + lineState/scoreComparison en nba-props.mjs y bitácora maintenance/NBA.md §2. Llevar versión, OT, disponibilidad, hora de captura y advertencias a la metodología y a cada contrato. |
| Ranking global por brecha, principal y alternativas | Parcial; #408 ya tiene rankings y bandas de cuotas | rankLines/selectRankSide en src/nba-ranking.mjs; controles en nba-ui.js. Incorporar L5/L10, brechas, porcentajes, frecuencias con pushes, minutos, n, coincidencia, orden reversible, filtros de partido/equipo/jugador/estadística/período/lado/cuota/disponibilidad/muestra, principal/alternativa y Top 10/25/50/todos. Abrir tarjeta exacta. |
| Ranking complementario por ocho condiciones explicadas | Exclusiva identificada para esta puntuación | rankLines usa historia, línea, rival, matchups, minutos, disponibilidad e integridad. Llevar conteo y estados por criterio como vista adicional. Fórmulas más abajo. |
| H2H por jugador vs. equipo, comparación posicional, lesiones y descanso | Existe en #408; validar equivalencia al integrar | cheat-rival.mjs usa alineaciones, finales, matchups e injuries. Mantener la presentación de Cheat Sheets, ver fecha de posición histórica, n y captura. Portar sólo métricas o filtros de evidencia que falten. |
| Defensor directo y agrupación de cruces | Parcial en #408 | nba_matchup_observations_v3 → defensiveGroups en nba-props.mjs. Agrupar por defensor y juego, filtrar antes del corte y mostrar segundos y estadísticas observadas. Separar posición equivalente y defensor observado. |
| Lesiones, disponibilidad y alineaciones por encuentro | Existe el dato y #408 muestra contexto; parcial la vista | nba_pregame_context_v1, NBA manual; roster, nba-ui.js. Reutilizar estados e instante del reporte; nunca asignar equipo actual sólo por última aparición. |
| Tracker privado de ML/spread/total/props, guardado prepartido y liquidación | Exclusiva identificada para estos registros personales | src/nba-service.mjs, nba/tracker/ y archivos de resultados R2. Reutilizar contrato y pruebas, implementar almacenamiento privado en Pick según plan. |
| Comparación prospectiva emparejada por mercado/período/stat/condición | Parcial: Pick tiene originales SHADOW | maintenance/nba/nba-originals.sql, originalFor/pairedSummary y nba-service.mjs. Congelar pareja elegible y conservar la ausencia de original; mostrar denominador compartido y exclusiones. |
| Consulta de día archivado, suplemento, deduplicación y relectura | Parcial | NBA manual y R2 → nba-service.mjs, maintenance/nba/daily.md. Conservar los cortes históricos y suplementos que añaden evidencia; referenciar la fuente canónica cuando los bytes coincidan. |


## Recuperación técnica

La versión 13 del Site corresponde a `9835e3ab79ec423cab1333198e10f7565e845eb0` (proyecto `appgprj_6b048f41f1808191814f578f7bff2e5a`). La [referencia NBA](reference/nba-site-v13/) conserva funciones, pruebas, consultas históricas, compilador de parciales y sumas SHA-256. Procede de la recuperación de V13 cotejada con los 65 archivos publicados. La selección en GitHub contiene fuentes NBA y fixtures de prueba. Se excluyen cuentas, exportaciones personales, el Worker compilado y los datos de ejecución. La aplicación no importa estos módulos.

| Directorio de referencia | Uso al retomar |
|---|---|
| `src/nba-evidence.mjs`, `src/nba-history.mjs` | Participaciones, historial, identidad, parciales y originales prepartido. |
| `src/nba-props.mjs`, `src/nba-ranking.mjs` | Reglas de comparación, líneas, lado, muestra, orden y condiciones. |
| `maintenance/nba/` | SQL histórico de calendario, box, PBP y originales SHADOW más `reconcile.py`. Insumos de reproducción fuera de producción. Para integrar, ligar juego, revisión y corte exactos antes de agregar eventos. |
| `src/nba-service.mjs` y `tests/` | Contrato de cortes y tracker privado del Site, persistencia, identidad y liquidación con dobles locales. La migración del almacenamiento se revisa aparte. |

## Versiones y evidencias

La rama incorporó Top 10 y captura el 24-nov, consolidó las bandas de cuotas en `7a3ff822` e incorporó rival y metodología en `2bd1709e`. El commit V13 del Site identifica la fuente recuperada y es independiente de la numeración de Pick. Los documentos distinguen entrega en la rama, capacidad en producción, referencia recuperada y trabajo futuro.
