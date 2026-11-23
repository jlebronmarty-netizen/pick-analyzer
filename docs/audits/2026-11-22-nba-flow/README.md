# NBA: navegación, jornada de Puerto Rico y continuidad de datos

## Problemas reproducidos

La portada y la navegación global enviaban NBA al archivo GOAT, no al Decision Board. La barra móvil solo ofrecía Hoy y Valor. El reporte GOAT elegía la cohorte nueva de tres contratos y un partido; los 93 contratos de la versión anterior seguían almacenados, pero esa separación no era evidente. La hora de lectura del reporte tampoco representaba una nueva emisión.

El contador diario GOAT utilizaba el día UTC. Nueve contratos creados la noche anterior de Puerto Rico agotaban el contador del día local siguiente. El límite autorizado sigue siendo nueve filas al día y tres por ejecución; el cambio corrige la frontera de fecha, sin reiniciar el uso al desplegar.

El verificador descartaba correctamente un box score incompleto, pero después mostraba `IDENTITY_MISMATCH` para los jugadores de ese original. El caso Cleveland–Miami del 13 de noviembre reproduce el error: el original no reconcilia con el final. La nueva razón es `ORIGINAL_BOX_NOT_VERIFIED`, con datos `PARTIAL`, clasificación `PASAR` y sin L5, L10 ni proyección. Una identidad verdaderamente incompatible conserva su bloqueo específico.

## Experiencia de usuario

- La entrada principal muestra deportes y accuracy por mercado y cohorte. Cada tarjeta abre el análisis del deporte. NBA abre `/nba-decision-board` y sus seis vistas existentes.
- Las tarjetas conservan W/L, pendientes y tamaño de muestra; los juegos únicos solo aparecen cuando el lector proporciona ese dato. No se promedian versiones NBA ni se presenta accuracy como probabilidad de ganar una apuesta.
- La navegación móvil ofrece Deportes, el Board del deporte cuando corresponde y Valor / Edge. Archivo, aprendizaje y estado son accesos secundarios.
- El archivo GOAT muestra las dos versiones, conserva la selección al actualizar, diferencia última emisión y hora de lectura, y retira cifras anteriores si falla la nueva lectura.
- El estado GOAT expone fecha local, zona horaria, filas consumidas, límite, saldo disponible y próximo reinicio. Una lectura sin emisiones lo indica explícitamente.

## Formatos de originales archivados

Se incorpora la corrección de formato propuesta en [PR #395](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/395), conservando los cambios posteriores de esta rama. El lector admite el array estacional y el envelope operacional después de verificar SHA256, tamaños, conteo y paginación. La prueba también utiliza el envelope que produce el nuevo materializador. La lectura de pantalla puede utilizar una caché separada de la programada; presupuesto cero sigue devolviendo vacío aunque haya caché. No se activan lecturas adicionales de Storage ni se modifica el presupuesto programado. PR #395 permanece abierto; esta entrega no afirma completar compactos históricos parciales ni resolver originales en disputa.

## Validación

- 104 pruebas de GOAT y política, incluidas once de límites de jornada local.
- 15 pruebas de integridad, incluidos Shead y el original incompleto Cleveland–Miami.
- 200 pruebas de dashboard multideporte, entradas NBA y separación de versiones.
- Compilación completa de las 400 páginas aprobada para el módulo de navegación y fecha. La compilación de la integración completa se vuelve a ejecutar en CI.
- 35 pruebas unitarias/de servicio del materializador y 26 comprobaciones en PostgreSQL 17.12 local, incluidos diez originales reales: ocho aceptados y dos rechazados.
- Cuatro pruebas del lector de Storage, incluidos los dos formatos y el aislamiento entre pantalla y congelación programada.
- Cuatro pruebas de navegador pendientes del runner de GitHub. Chromium local no pudo iniciar por una restricción de sockets del entorno; no se cuentan como aprobadas. El workflow NBA existente comprueba escritorio y móvil contra la aplicación con fixtures locales y conserva las capturas.

Las pruebas locales usan fixtures interceptados y credenciales de ejemplo; no consultan proveedores deportivos. La comprobación de producción se registra aparte y no se sustituye por esos fixtures.

## Conservación y alcance

`history-baseline.json` y `verify-history.sql` fijan el corte del 22 de noviembre a las 8:42:14 p. m. de Puerto Rico. Permiten cotejar las entradas congeladas NBA, V1 y V2 después del despliegue, sin confundir las nuevas filas de los ciclos naturales con una modificación histórica.

Esta corrección no cambia fórmulas, cuotas archivadas, resultados congelados, permisos de apuestas ni horarios. `JUGADA` sigue bloqueada. No se ejecutaron llamadas adicionales a proveedores ni se crearon tareas programadas. La verificación UI se incorpora al workflow de revisión de código NBA existente.

La tabla compacta de jugadores no tenía un materializador automático desde los originales operacionales. La rama incorpora ese paso al final del cron NBA existente, desactivado por defecto y limitado a tres juegos por ciclo. Verifica identidad, final independiente, minutos, componentes, hash y reloj antes de insertar manifiesto y filas en una transacción. Conserva la captura original y registra la hora actual de materialización. No sobrescribe compactos existentes ni rellena predicciones anteriores. La activación y el primer ciclo real siguen pendientes. [Contrato, permisos, límites y reversión](../../research/nba-archived-player-materializer.md).

La reproducción de archivos almacenados identificó ocho juegos admisibles y 278 filas. GSW–Dallas y LAC–Dallas siguen rechazados por sus marcadores incompletos. Estos resultados no certifican toda la temporada ni implican que las 278 filas se hayan insertado en producción.

## Reversión

Revertir el commit de aplicación restaura la presentación y el contador previos, sin borrar registros ni alterar predicciones. La fecha UTC anterior vuelve a ser incorrecta para Puerto Rico; por eso la reversión del contador solo debe hacerse ante una regresión demostrada y acompañada de seguimiento del límite local.

