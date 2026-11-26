# NBA Cheat Sheets · control de publicación en producción

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
