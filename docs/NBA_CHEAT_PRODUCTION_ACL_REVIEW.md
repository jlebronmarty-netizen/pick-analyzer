# NBA Cheat Sheets · control de publicación en producción

## Primera inscripción prepartido · 27 de noviembre de 2026

Horas de Puerto Rico. El primer lote se registró a las 02:30:34.558323 con diez posiciones simultáneas del ranking general por frecuencia (`rate`, banda −250 o mejor). La primera tarjeta del lote fue el jugador ID 15 de MIA–NYK, partido 21718193, más de 11.5 rebotes a −132 en FanDuel. El calendario archivado a las 02:30:26 fijaba el inicio para las 20:00 del mismo día. La cuota prepartido se recibió a las 02:00:34 y seguía vigente durante la inscripción. El archivo confirma el identificador, el lado y la línea. La cotización carece de nombre, verificación regional de precio y regla confirmada de prórroga.

- Captura `36357af502691236f6793c86825752695df18a6fd80b0794fd0d5558cf96c995`. Cotización `99175d991ee42938f04b279ea931b0bb7f3293d8494324583308bbef7e054403`. Calendario `ceeff56975b5e5abf3d8c7a96245f96b76835355c069295e1cb7e0c39ab6c794`.
- Vercel registró `OK` a las 02:30:34 (`q8q67-1795761025231-258200da8476`) y 03:00:31 (`6s2jl-1795762825620-5824dde2f6c0`). Cada ejecución informó 52 intentos de captura, cero vencimientos y cero llamadas del tracker a proveedores.
- Al corte de las 03:04, Supabase contenía 104 capturas, 725 inscripciones de cuatro partidos y 232 identificadores de cuota distintos. Las 725 coincidieron con la cuota archivada en jugador, partido, mercado, lado, línea y precio, y con la tarjeta en su posición y metodología originales. Todas entraron antes del inicio y dentro de la vigencia de la cuota. Hubo cero contratos repetidos dentro de la misma jornada, metodología, alcance y banda.
- Inscripciones por metodología: `rate` 158, `gap` 151, `pct` 154, `conditions` 159, `projection_five` 52 y `projection_ten` 51. Los alcances y métodos pueden compartir contratos. La posición pertenece al primer ingreso de cada contrato dentro de su estrategia y puede repetirse durante la jornada.
- Las 725 inscripciones seguían pendientes. La vista de la cola de liquidación, que exige que haya pasado la hora de inicio, tenía cero filas. En las 29 540 filas de rendimiento, todos los contratos estaban pendientes, con cero decisiones, pares liquidados y unidades ganadas, perdidas, netas o liquidadas. Accuracy y ROI eran nulos en todas las posiciones y Tops. Sigue pendiente la conciliación de la primera liquidación real, así como el recálculo con resultados y la comparación con Pick cuando existan pares equivalentes.

## Control operativo del 26 de noviembre de 2026

| Hora de Puerto Rico | Solicitud de Vercel | Resultado |
|---|---|---|
| 25-nov 23:30:32 | fg4dg-1795663825792-b607478655a9 | NBA_SHEET_TICK OK |
| 26-nov 00:00:26 | pnwcg-1795665625360-b2d90f9181ec | NBA_SHEET_TICK OK |

En ambas ejecuciones naturales del GET de producción hubo cero contratos intentados o vencidos, cero partidos pendientes, cero liquidaciones intentadas y cero llamadas del tracker a proveedores. El segundo recibo procede del despliegue dpl_2PNU6pnFaUWde87WWJcP2RavxYcA. Supabase a las 00:04:12 PR tenía cero capturas, inscripciones, liquidaciones y filas de rendimiento.

El seguimiento permanece abierto. Para cerrarlo, cotejar la primera captura elegible con su inicio, primera posición, metodología y precio; la primera liquidación con la estadística individual verificada; y las vistas de posiciones y Top acumulados con una recomputación de unidades, ROI, accuracy y denominadores por estrategia. Una muestra vacía no permite validar esa contabilidad prospectiva. El [roadmap NHL](NHL_CHEAT_SHEETS_ROADMAP.md) ya está en main; la propuesta definitiva aguarda ese cierre.


## Publicación y activación · 25 de noviembre, después de las 11 p. m. de Puerto Rico

PR #408 fusionado en `5410211f38edb007ce5cf7a5ce4e1738fcc6217c`. Ocho controles pasaron en el candidato `c1b603375ba8a84ebd05ff0f53819f2f23d1983b`. La única migración ejecutada durante la reanudación fue 202611260903_nba_sheet_view_acl.sql, registrada en producción como nba_sheet_view_acl, versión 20261126030845. El catálogo confirmó exclusivamente SELECT sin grant option para service_role en las cuatro vistas, security_invoker=true y ausencia de acceso para PUBLIC, anon y authenticated. La migración también comprueba privilegios por columna. En PostgreSQL aislado se reprodujeron los defaults de producción y una membresía con TRIGGER que la migración rechazó. Pasaron las suites de inscripción, liquidación, reintento, unidades, pares y ACL.

Vercel producción READY, primero con escritor apagado y luego con NBA_CHEAT_TRACKER_ENABLED=true sólo en producción. Despliegue activo al validar: `dpl_FeqbN2kyZa5Kw2EwxaMfzy1KhNSX`. Se verificó el enlace del Decision Board, la portada, el análisis y el tracker. Las tres páginas privadas activadas devolvieron HTTP 200; el tracker consultó su vista y mostró ausencia de observaciones. Reversión del escritor: retirar la bandera y redesplegar el mismo código, preservando registros, migraciones y protecciones de acceso.

Al activarse el escritor habían pasado las horas de inicio de los nueve partidos de la jornada, incluidos los dos últimos a las 11 p. m. PR. Cero snapshots, entradas y liquidaciones al corte. El contador de muestra vacía no es accuracy de cero. Seguimiento horario temporal de las dos primeras ejecuciones naturales y la primera liquidación disponible, con logs NBA_SHEET_TICK y relectura del archivo. Hasta observarlas, no certificar éxito del cron ni resultados prospectivos.

### Investigación con archivos existentes

En el corte de las 10:09 p. m. PR, los 94 recibos del rango −251 a −650 de los ocho mercados en los dos juegos finales tenían contrato de hito sin verificar y OT desconocida. Mantenerlos excluidos. Para reconsiderar, exigir equivalencia de umbral, período, OT, participación, precio y liquidación por contrato. No inferir reglas de una línea Over parecida.

Una consulta descriptiva de los 25 jugadores con precio estricto estándar de esos dos juegos identificó a los 25 por la última afiliación de equipo archivada y compatible con el partido; el campo de equipo en los propios recibos no permitió ese enlace. Con corte anterior al juego y temporada 2026 observada, 13 tenían al menos una aparición contra ese equipo y ninguno alcanzaba dos. La muestra cuenta jugadores y no es el denominador de los 330 contratos del informe anterior.

La captura previa incluía cinco titulares esperados por equipo y, entre los cuatro equipos, 15 registros Out y 4 Questionable. Para los 25 jugadores, 20 figuraban como titulares esperados. Ninguno de esos titulares tenía una observación defensiva archivada contra los titulares esperados del contrario bajo los filtros de temporada y corte; se comparó únicamente esa intersección. El archivo global sí contenía 6,330 observaciones con tiempo positivo en 67 juegos. Un reporte de lesiones no certifica automáticamente a los jugadores disponibles. Permanecen pendientes la cobertura de suplentes y la conciliación de períodos donde falten componentes individuales. Conservar el mínimo de muestra y la distinción entre rival posicional y defensor observado.

Para NHL: inventariar las fuentes internas equivalentes y las exclusivas del Site, validar reglas de OT/participación de porteros y probar por contrato las protecciones de liquidación y permisos antes de reutilizar la presentación. La validación operativa NBA precede al desarrollo NHL.


## Reanudación controlada · cuarta migración

La migración 202611260903_nba_sheet_view_acl limita los permisos a las cuatro vistas identificadas. El control exige SELECT sin delegación para service_role, ausencia de permisos efectivos por tabla y columna para anon y authenticated, y security_invoker. La prueba reproduce los privilegios predeterminados de producción y comprueba un permiso heredado mediante membresía; ejecutar este control en cada futuro tracker deportivo. Continuar con la lectura de catálogo antes de fusionar y activar. Los estados siguientes describen el corte anterior a esta corrección.


25 de noviembre de 2026, 10:52 p. m. en Puerto Rico. Candidato del PR #408: `40c7141fc4a44142aabb9d5dee865f47ea4b26ff`. GitHub reportó ocho controles aprobados, PR abierto y compatible con main. La publicación se detuvo antes de la fusión y del despliegue de la aplicación.

## Migraciones aplicadas con el escritor apagado

| Archivo en Git | Versión registrada en Supabase |
|---|---|
| 202611240901_nba_cheat_snapshots.sql | 20261126025156 |
| 202611260901_nba_sheet_tracker_guard.sql | 20261126025211 |
| 202611260902_nba_sheet_performance.sql | 20261126025212 |

Los identificadores del registro de Supabase corresponden al momento de aplicación. Para reanudar, cotejar el nombre y la versión aplicada antes de programar cualquier migración adicional. Las tres tablas tenían cero filas. Los triggers nba_sheet_clock_v1, nba_sheet_enroll y nba_sheet_grade_guard estaban habilitados. Se comprobó la clave única por estrategia y contrato y la clave primaria por snapshot y recibo. Las pruebas de inserción y reintento corresponden a PostgreSQL aislado.

## Bloqueo de permisos

Las tres tablas tienen RLS. El rol service_role tiene SELECT e INSERT en snapshots y grades y sólo SELECT en entries. anon y authenticated carecen de lectura y escritura en las siete relaciones revisadas. Las cuatro vistas usan security_invoker. En nba_sheet_accuracy_v1, nba_sheet_performance_v1, nba_sheet_pending_v1 y nba_sheet_pending_games_v1, has_table_privilege confirma SELECT, TRUNCATE, REFERENCES, TRIGGER y MAINTAIN para service_role. El catálogo de privilegios predeterminados de postgres en public concede esos cuatro privilegios adicionales. Las migraciones de vistas revocan permisos públicos, pero conservan los privilegios predeterminados de service_role. El permiso TRIGGER contradice el contrato de sólo lectura. Un privilegio catalogado en una vista ordinaria no demuestra que todas esas operaciones sean ejecutables sobre sus tablas.

Preparar una corrección aditiva limitada a las cuatro vistas, revocando los privilegios de service_role y concediendo únicamente SELECT. Verificar primero en una base aislada que reproduzca los privilegios predeterminados de producción, luego volver a leer todos los permisos efectivos en producción tras autorización. Mantener la bandera de escritura apagada hasta completar el control. Conservar las tablas y el historial durante la pausa.

## Validación y continuidad

La fusión, el despliegue y las visitas de validación en producción, los dos ticks, la primera liquidación y el informe real por posición siguen pendientes. No hay accuracy ni ROI prospectivos que publicar. Las investigaciones sobre hitos, rivales, disponibilidad y períodos quedan pendientes al detener la publicación.

Para NHL y futuros deportes, el tracker debe congelar una selección prepartido por estrategia, liquidar únicamente componentes individuales verificados y mantener los pendientes fuera de decisiones, unidades y pares. Reutilizar presentación, inscripción y reportes. Antes del desarrollo NHL, inventariar fuentes archivadas de Pick para identidad, mercado, tiempo reglamentario, prórroga, participación y porteros; mapear funciones exclusivas del Site a esas fuentes; demostrar equivalencia, controles de acceso y paridad por contrato en una muestra aislada. El retiro de la dependencia requiere captura y liquidación autónomas verificadas en Pick. Registros personales y Sites quedan fuera de esta fase.
