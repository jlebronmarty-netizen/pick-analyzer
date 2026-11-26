# Revisión NBA por contrato · PR #408

Base 747b1b66. La página privada `/nba-cheat-sheets/analisis` amplía la hoja existente. El enlace superior abre el ranking general y el de cada tarjeta preselecciona jugador y partido. La jornada corresponde a Puerto Rico. Esta revisión es candidata de rama; el tracker se ensaya exclusivamente con datos de prueba en PostgreSQL aislado.

## Evidencia y límites del corte

| Juego | PBP archivado y box verificados el 25-nov | Decisión |
|---|---|---|
| 21718107 | Cierres 38–23, 71–54, 103–84, 129–110. El algoritmo JS aplicado a los eventos y box originales de Pick produjo parciales para 25 jugadores. | Admitir únicamente métricas conciliadas y segmentos con participación. |
| 21718097 | Q3 termina 92–90 en eventos y 92–91 en box. El final sí coincide. | Excluir parciales. |
| 21718149 | Al descanso 64–61 frente a 62–61; final 130–119 frente a 128–119. | Excluir parciales. |
| 21718161 | Q3 termina 75–67 frente a 76–67. | Excluir parciales. |
| 21718130 | Sólo dos cierres de período; el último evento es un tiempo muerto en Q3. | Excluir parciales. |
| 21718039 y 21718051 | En la consulta por ID a game_results, nba_game_context_v2 y nba_pbp_snapshots_v1 faltan final independiente, box operativo y secuencia. | Retener como pendientes; no deducir participaciones. |

Los recibos FanDuel prepartido del 25-nov contienen las cuatro combinaciones FT y puntos Q1. La consulta de inventario cuenta recibos, no contratos únicos ni ofertas vigentes. Habilitar la lectura de Q2–Q4, mitades y OT permite usar archivos comparables cuando existan. Mostrar un período en el historial de un jugador no establece una oferta del sportsbook.

## Implementación

| Capacidad | Fuente y comportamiento |
|---|---|
| Entrada | `readNbaDecisionBoard({forDisplay:true,withSheetLab:true})` lee el mismo archivo, menú por lotes, calendario, originales y cuotas. La opción adicional sólo se usa al abrir la página de análisis. `src/lib/nba/sheet-lab/build.mjs` cruza identidades y recibos; carga PBP y defensas de Supabase para los participantes del corte. Sin llamadas a proveedores. |
| Auditoría | `nba-evidence.mjs` adapta V13 al corte de Pick. Jugó, DNP con cero minutos registrados, jugó menos de diez minutos (fuera de la metodología de proyección), sin fila, sin evidencia y conflicto tienen significados diferentes. L10 usa apariciones observadas; la auditoría incluye el calendario del equipo cuando se conoce. Una fila ausente no equivale a un DNP. |
| Parciales | `periods.mjs` reproduce la asignación de roles del SQL V13. Orden de eventos único, cierres Q/OT y marcador final exactos; cada estadística individual debe sumar el box. Las mitades agregan Q1+Q2 y Q3+Q4+prórrogas respectivamente. OT agrega solamente prórrogas observadas. Sin evento de participación, sin dato en ese segmento. No hay minutos individuales de segmento verificados. |
| Combinados | `nba-props.mjs` calcula PRA, PR, PA y RA dentro de la misma participación y período. Un componente ausente deja la suma ausente. Las medias y las barras sólo usan valores finitos. |
| Comparabilidad regional | Usar libro, lado, período, contrato estricto y hora de captura. Aplicar la referencia FanDuel PR desde 30-jul-2026. FT y 2H incluyen OT en el histórico; para Q1 se exige evidencia de participación. Una regla de OT desconocida se etiqueta como pendiente y bloquea liquidación automática. Primer anotador, hitos y SGP quedan fuera. |
| Elegibilidad y filtros | `rank.mjs` usa las bandas existentes (−250 o mejor; −251…−650 inclusivas), filtros por partido, jugador, lado, período y mercado. Top 10 de contratos con ≥5 valores de las diez apariciones observadas. Una alternativa puede entrar con su propia cuota. Se conserva la vista previa de proyecciones y el ranking verificado de la portada. |
| Orden | Frecuencia = éxitos / datos comparables, con pushes en el denominador. Brecha en unidades = media − línea para Over, línea − media para Under. La brecha porcentual divide por una línea positiva. Orden descendente por la metodología elegida, tamaño de muestra, cuota e ID. General mezcla mercados; la brecha en unidades usa unidades propias de cada mercado. |
| Ocho condiciones | L5 favorable; L10 favorable; frecuencia L10 ≥60% con n≥5; minutos L5 dentro de ±15% de L10; mayoría favorable contra el rival con ≥2 encuentros; ≥3 juegos con cruce defensivo documentado; disponibilidad explícita; diez participaciones auditadas con métrica disponible. Cada criterio muestra Cumple, No cumple o Sin evidencia. Out/inactive/doubtful o ausencia de brecha comparable inhibe el conteo. Un cruce documentado acredita cobertura. |
| Perfil | Serie por fecha con FT, Q1–Q4, 1H/2H u OT. La gráfica y el resultado de la línea se habilitan sólo cuando coincide el período de la cuota y hay valores. Los n del corte son observados. Un recibo ausente, vencido o anterior al dato de disponibilidad puede dejar el ranking vacío. |

## Tracker de investigación

Migración base `202611240901_nba_cheat_snapshots.sql`. La migración aditiva `202611260901_nba_sheet_tracker_guard.sql` fuerza el reloj del servidor y el corte prepartido, prohíbe mutaciones y crea un registro privado de liquidaciones por snapshot y quote. La vista `nba_sheet_accuracy_v1` usa permisos del invocador. Los roles anon y authenticated carecen de acceso; service_role tiene sólo las operaciones necesarias sobre estos objetos. Conservar las dos migraciones en ese orden.

`freezeLabRankings(db,lab)` en `ledger.mjs` lee originales SHADOW con `shadow.mjs` y congela IDs, precio, reglas, lado, período, jugador, mercado, muestra, metodología y score. `prepareSnapshots` deriva el identificador del día y contenido canónico. Reintentos idénticos convergen. La comparación exige mismo partido e inicio, jugador, market/stat, línea, libro y regla OT conocida; fecha de cuota, decisión y registro prepartido. Pick puede tener el lado opuesto. Una selección sin equivalente conserva original nulo. Una anulación se vincula al quote ID propio de cada lado. Para un par congelado, la escritura final espera a que ambos se puedan calificar.

`settleLabRankings(db,snapshot,evidence)` recibe evidencia final por gameId, valida original contra final independiente y cruza PBP si el contrato lo requiere. Push, DNP y void documentado no entran en decisiones; sin certeza el contrato queda pendiente y puede reintentarse. La vista separa por metodología, alcance, mercado, período y banda. Usa la primera aparición de cada quote dentro del alcance para no contar capturas repetidas; accuracy = victorias / decisiones. Ambas accuracies prospectivas usan los mismos pares decididos. Cero pares produce accuracy nula.

**Activación pendiente:** revisar y ensayar las dos migraciones y el proceso que suministra evidencia antes de autorizar producción. Los lectores del panel no disparan este writer. El ensayo aislado acredita la mecánica, no una tasa de acierto NBA en vivo ni un historial prospectivo recuperable a posteriori.

## Pruebas y control MLB

- `node --test tests/nba-sheet-periods.test.mjs tests/nba-sheet-lab.test.mjs tests/nba-cheat-ranking.test.mjs tests/nba-cheat-projections.test.mjs`. Incluye ejemplo archivado de Jamal Shead, alternativas, datos nulos, condiciones y cohortes comparables.
- `node --test docs/reference/nba-site-v13/tests/*.test.mjs` y `python3 docs/reference/nba-site-v13/tests/test_pbp.py` reproducen la referencia. Pruebas de la aplicación verifican también calificación individual, OT y parciales rechazados.
- Con un PostgreSQL desechable vacío escuchando exclusivamente en loopback, ejecutar `node tests/nba-sheet-tracker.postgres.mjs` con el módulo pg y puerto de prueba. Crea roles dentro de una transacción y revierte todo. Comprobados reloj del servidor, prepartido, no duplicación, permisos, inmutabilidad, registro final y vista de accuracy.
- Navegador a 390 y 1440 px: portada, cuatro mercados, bandas, H2H, perfil, menú de período, estados de condiciones y supresión de barras al seleccionar otro período. La ruta de análisis usa el mismo control de acceso de NBA. Vercel declara SSO activo en despliegues salvo dominios personalizados; producción exige el host canónico privado.
- El fallo específico `SOURCE_DRIFT:src/components/dashboard/NbaBoardAccess.tsx` del job 139632136603 (run 45736879377) pertenece a la rama. El archivo de main `99f9a151` produce SHA-256 normalizado `04e89410ee4e444268e31c5515e8ea0285657e1b9412622f1eb1371b37fcc0f8`, idéntico al esperado por el control. El de #408 produce `1851a793f1603335e49f0d2bc050f85e0d9960fe1c9d9045531842b14463d315`. Revisar por el proceso titular de certificación antes de fusionar. Esta comprobación compara la causa concreta; no acredita otros controles de main.

Primera vista previa de esta entrega, commit ad448349: Vercel READY; portada y análisis HTTP 200, con tarjetas reales y 17 de 26 boxes seleccionados con parciales. Ambos controles NBA de GitHub pasaron. La cobertura corresponde a ese corte.
