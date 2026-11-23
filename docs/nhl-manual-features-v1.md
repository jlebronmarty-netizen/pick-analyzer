# NHL: inputs diarios compartidos con el panel manual

## Alcance

El contrato `NHL_MANUAL_FEATURES_V1` del normalizador canónico del panel (`src/manual-dataset.mjs` en el proyecto Site) puede archivarse en Pick sin recalcular ni sustituir predicciones. Se conservan los payloads originales: temporada, últimos diez, goles y tiros por período, PP/PK, descanso, portero reportado, cobertura y procedencia. La ruta nueva proyecta una comparación mínima de ambos equipos; no copia un motor de pronósticos.

La migración es aditiva. No consulta proveedores ni crea cron, modelos, promociones o escrituras sobre tablas de pronósticos, selecciones o resultados. La instalación y la publicación son pasos separados de la validación local.

## Persistencia y tiempo

- Migración: `supabase/migrations/20261123210507_nhl_manual_feature_snapshots_v1.sql`, generada con `supabase migration new nhl_manual_feature_snapshots_v1`.
- Tabla: `public.nhl_manual_feature_snapshots_v1`.
- Clave de snapshot: `(event_id, available_as_of)`. Clave de idempotencia: `(source_run_id, event_id)`.
- El trigger fija `available_as_of = inserted_at = clock_timestamp()` en el servidor. Los valores suministrados por el llamador no permiten retroceder el reloj de disponibilidad.
- `feature_payload.available_as_of` conserva la generación original de la fuente. Debe ser anterior o igual a la disponibilidad en Pick. La disponibilidad acredita el momento de inserción; no certifica decisiones anteriores ni equivale a una fecha histórica reconstruida.
- `scheduled_at > available_as_of` es obligatorio. El escritor devuelve `SKIPPED_STARTED` cuando el juego ya empezó; no escribe esa fila. Una carrera en el límite del inicio puede abortar el lote por la restricción, conservando la integridad prepartido; se puede reintentar el mismo lote.
- Un retry idéntico devuelve `ALREADY_STORED` con la hora anterior. Si cambia hash o payload del mismo run/evento, falla `DIVERGENT_NHL_MANUAL_FEATURE_RETRY`. Un nuevo run agrega otra versión. Los lotes se ordenan por evento para evitar esperas cruzadas entre reintentos concurrentes.
- El lote es atómico para las nuevas filas: cualquier error revierte sus inserciones. Un lote tiene hasta 32 eventos únicos; un payload ocupa hasta 128 KiB y el lote hasta 4 MiB.

La tabla tiene RLS activado y ninguna política de acceso para `anon` o `authenticated`. Se revocan todos los privilegios de esas cuentas, `PUBLIC` y `service_role`; únicamente se devuelve `SELECT` a `service_role`. Los triggers rechazan UPDATE, DELETE y TRUNCATE, incluso cuando los intenta el propietario sin deshabilitarlos. El escritor es `SECURITY INVOKER`, con `search_path` vacío y ejecución revocada para los roles de aplicación. Solo el propietario SQL autorizado escribe. No se amplían credenciales ni permisos del dashboard.

## Escritor

`scripts/nhl-manual-feature-writer.sql` contiene la consulta parametrizada:

```sql
select event_id, status, available_as_of, inserted_at
from public.append_nhl_manual_feature_snapshots_v1($1::text, $2::text, $3::jsonb);
```

Los parámetros son el `source_run_id`, el SHA-256 de los bytes exactos del dataset publicado y el array JSON de features canónicos sin modificaciones. El hash es procedencia del dataset completo: no se calcula sobre una serialización nueva del subconjunto de features. La respuesta `/api/features` del panel proporciona ambos identificadores y el array `features`.

Para conectores SQL que solo aceptan texto, el renderer `scripts/nhl-manual-feature-sql.py` valida el envelope y genera una llamada con valores UTF-8 codificados en base64, sin interpolación libre de JSON. No descarga datos ni ejecuta SQL. La automatización autorizada puede capturar `/api/features`, generar la consulta, ejecutarla como propietario SQL y comprobar los recibos. Debe conservar el mismo run/hash/payload para reintentos; no fabricar otra hora ni otro run para completar una captura histórica.

```sh
python3 scripts/nhl-manual-feature-sql.py features.json > append-features.sql
python3 scripts/nhl-manual-feature-sql.py --readback features.json > readback-features.sql
```

El argumento `-` acepta stdin. Ante un error no imprime SQL parcial y termina con código 2. Los tres argumentos variables se codifican, incluso run/hash. Se verifican flags exactos, identidad, ventanas recientes, cronología y cobertura; el renderer limita el SQL a 1,900,000 bytes para el conector. El readback consulta recibos y flags sin devolver el payload grande.

## Lectura e interfaz

`GET /api/nhl/manual-features` consulta el día actual en Puerto Rico. Acepta `?date=YYYY-MM-DD`; una fecha imposible devuelve HTTP 400. La respuesta siempre declara `readOnly`, cero proveedores/escrituras, `predictionAdjustment: false` y `modelPromoted: false`.

La lectura usa el cliente servidor existente y un corte capturado antes de consultar. Filtra `available_as_of` e `inserted_at` por ese corte, pagina en orden estable, exige conteo exacto y valida claves/contrato. El límite es 512 snapshots del día; una lectura parcial, un conteo cambiado o un límite excedido no produce estadísticas incompletas. Las consultas por página usan transacciones separadas; el conteo y corte son comprobaciones, no una transacción global serializable.

| Estado | Significado |
|---|---|
| `READY` | Lectura completa; se muestra la última versión guardada de cada partido. |
| `EMPTY` | Tabla instalada sin snapshots para la fecha. |
| `NOT_INSTALLED` | Tabla ausente en este entorno; HTTP 200 con explicación y sin fixtures. |
| `READ_UNAVAILABLE` | Lectura o integridad no verificable; HTTP 503 sin datos parciales. |
| `SOURCE_SCAN_CAPPED` | Límite de lectura superado; HTTP 503 sin datos parciales. |

La nueva sección NHL es bajo demanda y también aparece si la fuente de pronósticos no está disponible. Presenta ambos relojes, estado de porteros, cobertura L10, períodos y cortes de PP/PK. Los nulos siguen vacíos. Un partido iniciado conserva la etiqueta de snapshot histórico. Los datos compartidos siguen siendo inputs para investigación; este módulo no los conecta a ninguna fórmula de probabilidad.

## Validación y operación pendiente

Pruebas relevantes: lector paginado y fallos de integridad, límites temporales, presentación bajo demanda, y PostgreSQL efímero con la migración real. El ensayo SQL verifica privilegios, RLS, append-only, sellos de tiempo, reintentos idénticos/divergentes, concurrencia en orden inverso, partidos iniciados, flags de promoción, límites y rollback atómico.

```sh
node --test tests/nhl-*.test.mjs
node --loader ./tests/dashboard-multisport/tsx-loader.mjs --test tests/dashboard-multisport/nhl*.test.mjs
python3 -m unittest discover -s tests -p 'test_nhl_manual_feature_sql.py' -v
NHL_MANUAL_TEST_EMBEDDED_MODULE=file:///path/to/embedded-postgres/dist/index.js node tests/nhl-manual-features.postgres.integration.mjs
npm run build
```

`embedded-postgres` se usa en un runtime local de pruebas aparte; no se añade a dependencias de producción. El test crea un cluster temporal que solo escucha en `127.0.0.1`, nunca recibe una URL de base remota y lo detiene al terminar. Tras el PASS local, la migración fue aplicada por el coordinador y se verificaron RLS, los dos triggers y `service_role` con SELECT sin permisos de mutación/ejecución del escritor. Al preparar este PR faltan la primera escritura real con readback, la activación de la tarea diaria y la QA móvil del nuevo módulo. El estado y los resultados locales se conservan en `docs/research/nhl-manual-features-2026-11-23-validation.json`.
