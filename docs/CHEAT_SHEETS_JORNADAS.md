# Jornadas privadas NBA, NHL y NCAAB

## Revisión y publicación

El PR #417 parte de a9de2692. La incorporación de main en efef18ab conserva las dos líneas de desarrollo. La interfaz NCAAB usa NCAAB_CHEAT_SHEETS_ENABLED en producción y exige la identidad y el host privados de la aplicación. En Preview se aplica el control privado existente. El laboratorio de NCAAB continúa aislado, sin escritor programado. El nuevo selector comprueba la habilitación de las rutas antes de mostrar enlaces. Para retirar la interfaz tras una futura activación, se deshabilita únicamente su flag. Esta fase no requiere cambios de esquema.

## Contrato de presentación

La jornada termina a medianoche de Puerto Rico. Fecha omitida y fecha explícita de hoy usan el reloj actual. Para fechas anteriores se puede consultar el archivo a la 1 p. m. PR o al cierre de la fecha local. La pantalla utiliza la evidencia disponible en ese corte, incluso si faltaba el final del juego. Las cuotas mostradas son referencias prepartido. Ninguna de estas vistas ofrece líneas live.

Próximos exige un inicio futuro y un estado archivado compatible. En vivo y Finalizados requieren confirmación explícita. Si el horario pasó y el archivo todavía dice programado, el encuentro queda en Todos con estado sin confirmar. Los aplazados y cancelados también se consultan en Todos. La selección prepartido elimina las cuotas vencidas y los partidos excluidos antes de ordenar, deduplicar y limitar. El navegador revisa los vencimientos y el cambio de día, consulta de nuevo al volver a la pestaña y actualiza la jornada activa cada minuto. La caché autorizada del tablero compacto de NCAAB usa cortes de tres minutos. El corte histórico queda fijo.

El selector conserva la fecha, el corte histórico, el estado, el rango de cuotas y las ventanas y mercados compatibles. Equipo, partido y conferencia son propios de cada deporte. La navegación histórica del tracker sigue consultando las inscripciones prospectivas originales.

## Implementación y archivos

- `src/lib/cheat-sheets/jornada.mjs` contiene fecha, estado, vigencia y equivalencias de filtros. `src/components/cheat-sheets/jornada.jsx` y `private-nav.jsx` concentran el selector, el reloj y las vistas.
- NBA expone el calendario archivado de `nba_market_schedules_v1` para la presentación. Se filtran proyecciones, hitos, H2H, combinados y filas del laboratorio antes de sus rankings. Las gráficas y las comparativas del rival mantienen el corte de su tarjeta.
- NHL consulta los recibos diarios guardados en `nhl_free_source_v1`, verifica su hash y el cierre del run, y concilia el ID, los equipos y el horario. Las comparativas muestran el estado. La falta de confirmación del archivo excluye al partido de Próximos. Las referencias Circa siguen siendo descriptivas.
- NCAAB conserva `NCAAB_MANUAL_DATA_V1`, la paginación y los análisis bajo demanda. La respuesta compacta del ranking transporta ID, inicio, estado y expiración. Al cruzar un límite se solicitan candidatos a la misma fotografía con la vigencia actual. Se conservan frecuencia, condiciones, brecha en puntos y brecha porcentual comparable.
- `tests/cheat-sheet-jornada.test.mjs` verifica corte PR, estado confirmado, cancelación, aplazamiento, vencimiento, sustitución, transporte de filas y acceso privado. El fixture de bandas NBA incluye un calendario explícito.

## Recuperación histórica universitaria

El [PR #13 de Sports Edge Hub](https://github.com/jlebronmarty-netizen/sports-edge-hub/pull/13) identifica el paquete acumulado `NCAAB_FREE_DATA_boxscores31022_20261012.zip` en el directorio de trabajo de Sports Edge Hub en Windows. Registra 5.197.720.629 bytes, SHA-256 `590b8d09f6e7069b2221a2265187933b4a193f026560f5f4023cf20f0e3b20e2`, CRC y 33.918 miembros comprobados en origen. De 31.023 objetivos, 31.022 se capturaron, 28.863 se declararon consistentes, 2.159 quedaron en cuarentena o rechazados y un objetivo quedó bloqueado. La búsqueda por nombre no proporcionó una copia íntegra disponible para verificar sus bytes en esta revisión.

Para incorporar el paquete se necesita la copia original de la ruta registrada o una entrega verificable. Comprobar tamaño, SHA-256, manifiesto y SQLite en aislamiento. Reconciliar para cada evento los IDs ESPN, equipos, temporada, localía, marcador, fuente, duplicados y timestamps. Registrar las discrepancias y conservar las cuarentenas. Separar H2H por temporada y limitarlo a evidencia disponible al corte. El acumulado no acredita por sí mismo las secuencias recientes L10.

Los tres cortes previos del 23, 24 y 25 de noviembre acreditaron cero ventanas L10 completas. El subconjunto histórico incorporado sigue siendo de 1.024 finales verificados. Véase [la auditoría por jornada](NCAAB_CHEAT_SHEETS_PHASE_2.md). Las líneas universitarias requieren certificar operador, jurisdicción, período, prórroga, pushes y anulaciones antes de cualquier liquidación. La revisión de interfaz no autoriza contratos ni trackers.

## Verificación de revisión

Se ejecutaron 716 pruebas de NBA, NHL, NCAAB y sus paneles. En el corte del 24 de noviembre, la comparación del HTML renderizado con las filas almacenadas detectó una respuesta compacta antigua sin inicio ni estado. La caché del tablero usa una nueva versión para filas que transportan vigencia. NHL contrasta además el calendario con los contextos de `nhl_game_context_v2` recibidos al corte y coteja identidad y hora antes de reconocer una confirmación más reciente.

Para repetir la revisión, abrir las tres rutas protegidas a 390 y 1440 px, cambiar estado y rango, y navegar entre deportes con filtros. Comparar en NCAAB la fecha de hoy explícita con la omitida y, en otra fecha, la 1 p. m. con Cierre del día. El histórico NBA anterior a las 9:03 a. m. PR del 27 de noviembre conservaba 1.225 inscripciones, todas anteriores al inicio. La comprobación de producción fue de solo lectura.
