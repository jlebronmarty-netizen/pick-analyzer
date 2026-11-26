# NBA Cheat Sheets · revisión de publicación del 25 de noviembre de 2026

## Integridad de liquidación · revisión del PR #408

El lanzamiento de 74133c6b se detuvo antes de producción. Un rebote −1 producía un acierto Under aun cuando el verificador lo descartaba. La corrección usa valores verificados para FT y conserva el cotejo individual de Play-by-Play para períodos. En PostgreSQL aislado se observó un pendiente con cero filas de liquidación, cero decisiones, cero unidades liquidadas y cero pares. Una segunda lectura válida produjo una única liquidación. Las pruebas usan datos sintéticos. El job sheet-settlement-regression ejecuta las pruebas NBA y tres suites PostgreSQL en una base efímera.


## Navegación y acceso

El enlace del Decision Board de NBA abre /nba-cheat-sheets. La portada enlaza /nba-cheat-sheets/analisis y /nba-cheat-sheets/tracker. El tracker reutiliza el control privado de NBA. Las páginas son lectoras. El proveedor de dashboard omite toda la familia de rutas Cheat Sheets. El archivo de navegación compartida NbaBoardAccess y la política compartida read-only-sport-route se restauran desde main. Los manifiestos y hashes de MLB conservan su versión certificada.

## Corte real del archivo GOAT

25-nov, 10:09:29 p. m. de Puerto Rico. Dos eventos aún prepartido (21718191 y 21718192). Capturas de las 10:00:31 y 10:00:36 p. m. Ventana de archivo con cobertura 17/26. Cada fila del laboratorio satisface captura ≤ corte < inicio. Conteos de quote_id de los ocho mercados antes del límite de diez, aplicando el criterio de frecuencia.

| Cuotas | Recibidos | Elegibles | Excluidos |
|---|---:|---:|---:|
| −250 o mejor | 1,093 | 330 | 749 hitos YES sin equivalencia verificada y 14 Q1 con muestra insuficiente |
| −251 a −650 | 94 | 0 | 94 hitos YES sin equivalencia verificada |

En el primer rango había 172 Over y 172 Under antes de comprobar historial. Entre los 330 elegibles hubo 34 PRA, 46 PR, 32 PA, 30 RA y 24 contratos Q1. Las combinaciones requieren componentes observados en el mismo partido o período. En capturas previas de esa jornada figuraron Under de triples y asistencias en el segundo rango. Su presencia anterior no autoriza incorporarlos a este corte.

| Condición entre los 330 elegibles | Sí | No | Sin evidencia |
|---|---:|---:|---:|
| L5 |165|165|0|
| L10 |162|168|0|
| Frecuencia ≥60 % |119|211|0|
| Minutos |306|0|24|
| Historial contra el equipo |0|0|330|
| Defensor directo observado |0|0|330|
| Disponibilidad |0|54|276|
| Auditoría |118|158|54|

El total de condiciones describe evidencia. La portada distingue proyecciones descriptivas y tendencias verificadas. La falta de reglas OT verificadas puede dejar una proyección pendiente al liquidar. El archivo no justifica emparejar períodos sin conciliación individual.

## Captura, posición, precio y muestra

El GET programado existente /api/cron/nba-current-era-shadow corre cada 30 minutos. La rama del tracker exige producción, bearer del cron, petición sin parámetros y NBA_CHEAT_TRACKER_ENABLED=true. scheduler.mjs lee el tablero archivado y las decisiones SHADOW previas, captura y revisa liquidaciones de forma independiente. La visita a la página y el freezer legacy dejan de escribir snapshots. Cada tick registra NBA_SHEET_TICK con su estado y conteos. Una cuota que aparece y vence entre ticks puede quedar sin captura. Un intervalo perdido no se reconstruye usando resultados.

Cada ranking conserva hasta diez posiciones en orden, metodología, alcance (general o del mercado), rango, recibo, período, regla OT, lado, línea, cuota, inicio y primera expiración. PostgreSQL asigna la hora y rechaza registros tardíos. El primer ingreso de un contrato por método, alcance y rango fija posición y cuota. Se ignoran reintentos, movimientos posteriores y nuevas identificaciones de la misma línea. En una jornada puede entrar más de un contrato distinto en una posición. El ranking de portada usa sus ventanas L5/L10 y contra el rival cuando corresponde; el avanzado usa frecuencia, brecha, brecha porcentual o condiciones. Cada serie tiene su propio denominador.

nba_sheet_performance_v1 calcula posiciones exactas 1–10 y Top inclusivos 1/3/5/7/10, desde el ranking original antes de aplicar filtros de informe. Filtra por mercado, período y Over/Under. Día, semana (lunes), mes y acumulado se basan en la jornada de Puerto Rico. Las muestras superpuestas no se suman. W/L son victorias y derrotas. Accuracy = W/(W+L). Se arriesga 1 unidad por contrato, con ganancia neta odds/100 para cuota positiva y 100/abs(odds) para negativa. La derrota cuesta 1 y el push devuelve la unidad. El ROI divide saldo entre W+L+push. DNP, anulaciones y pendientes se cuentan aparte. Un denominador vacío se representa sin porcentaje.

Pick se congela con el original SHADOW registrado antes del mismo corte. Deben coincidir juego, hora de inicio, jugador, libro, estadística, período, regla OT y línea. Puede seleccionar el lado contrario. La comparación pareada de accuracy exige ambos decididos y el ROI pareado además exige ambos precios. Se muestran ambos denominadores. Falta de archivo de anulación o final compatible deja el contrato pendiente.

## Activación y reversión

1. Revisar GitHub Actions y el preview del SHA que se autorice. Comprobar en el catálogo de Supabase que las tablas y columnas fuente siguen presentes. El entorno consultado tenía PostgreSQL 17 y rol service_role con bypass RLS. Las migraciones base estaban pendientes.
2. Con el escritor apagado, aplicar por el registro de migraciones, en orden: 202611240901_nba_cheat_snapshots.sql, 202611260901_nba_sheet_tracker_guard.sql y 202611260902_nba_sheet_performance.sql. El DDL depende de la ejecución única que controla el registro de migraciones. Evitar reejecutar manualmente CREATE TABLE.
3. Cotejar permisos efectivos: anon/authenticated sin lectura ni escritura; service_role con SELECT/INSERT autorizados sobre snapshots y grades, sólo SELECT sobre entradas y vistas. El trigger de inscripción se ejecuta con search_path fijo; las vistas usan security_invoker. Verificar hora asignada por servidor, duplicados e imposibilidad de modificar o borrar resultados.
4. Tras autorización, desplegar el SHA y habilitar NBA_CHEAT_TRACKER_ENABLED=true en producción, con redeploy. Observar dos ticks, cotejar primera captura/expiración/inicio y una liquidación con el final archivado. Revisar pendientes y distribución de muestras en /nba-cheat-sheets/tracker. Hasta entonces no hay accuracy ni ROI prospectivos de esta versión.
5. Para detener escrituras, quitar la bandera y redesplegar. Conservar tablas e historial. Antes de volver a código antiguo que escriba al visitar la página, retirar permisos de inserción de ese escritor. Cualquier retirada física de tablas requiere respaldo y autorización independiente.

## Evidencia reproducible y siguientes pasos

13 pruebas Node de rankings, proyecciones, períodos, liquidación y cron. Dos suites pasan en PostgreSQL aislado, incluyendo roles, reloj del servidor, reintentos, posiciones, ventanas, cohortes superpuestas y comparaciones. Ejecutar tests/nba-sheet-tracker.postgres.mjs y tests/nba-sheet-performance.postgres.mjs en una base local vacía con roles de prueba. En navegador con interfaz y datos de ensayo del análisis, 1440 px y 390 px pasaron expansión, gráfica, ausencia de gráfica Q1 sin evidencia y ancho sin desborde. Carga local registrada 60 ms y 44 ms. Una lectura del preview con datos reales tardó 5.27 s incluyendo el acceso de Vercel. Estas mediciones individuales no estiman percentiles de producción.

Para recuperar historia privada de Sites, inventariar exportaciones autorizadas en staging aislado, cotejar procedencia, zona, identificadores y duplicados antes de proponer traslado. Mantener la distinción entre archivos históricos y selecciones prospectivas. Para NHL, reservar presentación y contrato de reporting reutilizables; exigir sus propias equivalencias de mercados, OT, participación y fuentes antes de implementar. La revisión actual abarca NBA.
