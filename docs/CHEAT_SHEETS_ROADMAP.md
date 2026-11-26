# Consolidación NBA · revisión de entrega

## Tracker prospectivo · revisión de lanzamiento de NBA

Pendiente de autorización: tres migraciones aditivas, activar el cron y observar capturas y liquidaciones reales. Comparar metodologías sólo en sus propias muestras. [Auditoría, fórmulas, pruebas y procedimiento de activación](NBA_CHEAT_LAUNCH_REVIEW_20261125.md).


## NBA · Revisión posterior a 747b1b66 · 25-nov-2026

Las fases de auditoría, períodos, combinados, filtros y condiciones ya tienen implementación candidata en #408. El tracker tiene ensayo aislado; restan la revisión de certificación MLB y la decisión de producción. [Informe de implementación, pruebas y pendientes](NBA_CHEAT_REVIEW_20261125.md).


**Destino actual:** vista previa de `feat/nba-cheat-sheets` en el PR #408. Base visual y funcional `2bd1709e`. La revisión entrega el inventario, la recuperación del trabajo técnico y una separación de presentación en uso por NBA. La activación de capacidades históricas adicionales tiene hitos propios.

| Fase | Cierre de esta revisión | Evidencia |
|---|---|---|
| 1. Inventario NBA | Relación de funciones disponibles, parciales y exclusivas, con archivos, datos y acción de traslado. | [Matriz maestra](CHEAT_SHEETS_MASTER.md), fuente Site V13 identificada por commit; lectura de rama, rutas y catálogo de Supabase. 20 pruebas NBA de la referencia pasaron antes de extraer componentes. |
| 2. Recuperación | Consultas de sólo lectura, compilador PBP, cuatro módulos de análisis, servicio histórico NBA, pruebas y sumas de integridad en GitHub. | [Referencia ejecutable](reference/nba-site-v13/); las 20 pruebas Node NBA y las dos pruebas del compilador PBP pasaron en la copia recuperada. |
| 3. Arquitectura y estética | NBA usa tarjeta, grupo de filtros y barras compartidos; CSS original trasladado íntegro. Servicios, reglas y rankings permanecen a cargo de Pick. | [Contrato de componentes](CHEAT_SHEETS_MULTISPORT.md). En un navegador con fixture NBA, a 390 y 1440 px, apertura de metodología y rival, selección de temporada, línea acertada, defensa directa y ausencia de scroll horizontal. En ambos anchos coincidieron los rectángulos de todos los elementos con la referencia anterior. Pasaron las cuatro pruebas de ranking, rangos, series y proyecciones. |
| 4. Revisión de rama | Las seis guías/índices se publican en el mismo PR. Consultar los checks del SHA y el despliegue Preview asociado antes de cualquier promoción. | Prueba de compilación Next/TypeScript de Vercel, HTTP de página y lectura del API privado. El informe de revisión al usuario registra el resultado real del despliegue. |

## Próximas entregas NBA

| Orden | Trabajo | Criterio para cerrar |
|---|---|---|
| 1 | Integrar auditoría de participaciones y parciales PBP al servicio manual existente. Ofrecer por jugada Q1–Q4, 1H/2H y OT cuando haya evidencia. | Comparar por jugador, métrica y corte con `nba-evidence.mjs` y `reconcile.py`. Cohorte histórica V13: 60/64 juegos conciliados; 21718097, 21718149 y 21718161 tienen divergencia y 21718130 termina en Q3. Los candidatos 21718039 y 21718051 carecen de final independiente. Revalidar estos conteos antes de usarlos en otra jornada. |
| 2 | Completar comparación de equipos y selección manual del rival, contratos por período, combinados y lectura por condiciones. | Comparar contra referencia y archivos de época, incluidos OT, línea cero, falta de minutos, lesión, duplicados y empates. El conteo de condiciones necesita n visible y etiqueta descriptiva. El ranking actual conserva su cohorte y orden. |
| 3 | Diseñar y ensayar migración de tracker personal y pares prospectivos. | Inventario por hash de `nba/days`, `nba/research.json`, `nba/finals.json`, `nba/prop-results.json` y `nba/tracker`. Separar identidad del Site de UUID de Pick. Probar dos cuentas y anónimo, restauración aislada, duplicados, DNP, push y original ausente. Acreditar el mismo contrato prepartido para el denominador emparejado. |
| 4 | Preparar lanzamiento de la hoja y persistencia de rankings. | En el proyecto Supabase se verificó el 25-nov que `public.nba_cheat_snapshots_v1` aún no existe. Revisar `supabase/migrations/202611240901_nba_cheat_snapshots.sql` y ensayar permisos, idempotencia, vencimiento y relectura en entorno aislado. Validar fallback de captura fallida. Llevar resultados al propietario antes de migración o merge. |
| 5 | Aceptación de paridad y decisión sobre el futuro del Site. | Revisar integridad, privacidad, historial, evidencia visual y diferencias explicadas. Retiro, exportación privada y cambios de producción requieren decisión posterior. |

## Reproducción

Desde la raíz de Pick, usar las dependencias del lockfile. En Linux ejecutar `npm run build` y en Windows `npm.cmd run build`. Para las pruebas dirigidas:

~~~sh
node --test tests/nba-cheat-ranking.test.mjs tests/nba-cheat-projections.test.mjs
node --test docs/reference/nba-site-v13/tests/*.test.mjs
python3 docs/reference/nba-site-v13/tests/test_pbp.py
(cd docs/reference/nba-site-v13 && sha256sum -c SHA256SUMS)
~~~

En la vista privada, abrir cada mercado, cambiar L5/L10/H2H y ambas bandas; revisar que un juego no vigente sale al vencer. Probar un contrato con historia, otro con menos de cinco y otro sin rival único. Inspeccionar el API con el `asOf` de la misma respuesta y registrar por separado página, acceso y cobertura. Para regresión visual comparar los mismos datos, período, viewport y estado expandido en el commit de referencia y en el candidato. Las pruebas con fixtures cubren interacción; el caso real valida la lectura de archivos.

Reversión en revisión: retirar el commit de extracción en la rama por una reversión normal. La entrega no requiere revertir tablas, modelos ni recopilaciones.
