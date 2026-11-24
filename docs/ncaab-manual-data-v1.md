# NCAAB — datos compartidos para el análisis

## Propósito y contrato

`GET /api/ncaab/manual-data` entrega el contrato `NCAAB_MANUAL_DATA_V1` que comparten la sección de NCAAB en Pick y el panel privado. La fecha predeterminada es la fecha actual de Puerto Rico; `?date=YYYY-MM-DD` selecciona otra fecha. Una fecha imposible o repetida devuelve HTTP 400.

La consulta solo lee evidencia ya almacenada. Siempre declara `readOnly: true`, `providerCalls: 0`, `databaseWrites: 0`, `predictionAdjustment: false` y `modelPromoted: false`. No ejecuta el sincronizador diario, no genera probabilidades y no modifica pronósticos, resultados, permisos o cron. No requiere tablas ni migraciones nuevas.

El tipo completo está en `src/types/ncaab-manual-data.ts`. El Site debe consumir este JSON y conservar su `readAt`, fecha, cobertura y procedencia. Su caché o copia privada no acredita una emisión de pronóstico ni transforma el conjunto en un snapshot prepartido.

La respuesta usa un `ReadableStream` de fragmentos UTF-8 de hasta 64 KiB, con `application/json` y `no-store`; conserva el mismo objeto JSON y códigos HTTP. Esto admite el crecimiento de los historiales sin depender del límite de 4.5 MB de respuestas almacenadas en búfer de Vercel. La plataforma [excluye las respuestas transmitidas de ese límite](https://vercel.com/docs/functions/limitations#request-body-size). El informe se valida y serializa antes de enviar el primer fragmento; no se presentan métricas mientras la lectura está incompleta.

## Fuentes y lectura

- `ncaab_daily_source_v1`: recibos inmutables del scoreboard ESPN guardados por los ciclos existentes. Se selecciona el último recibo por URL canónica; no se regresa a una captura anterior para recuperar un precio ausente.
- `ncaab_daily_predictions_v1`: proyecciones originales. Se muestran solo cuando coinciden la identidad de evento/equipos, la hora del partido y la emisión previa. Los números se conservan sin recalcular.
- `ncaab_game_context_v2`: complemento opcional. Se leen únicamente el encabezado y las estadísticas de equipos del resumen; no se descargan jugadores ni se habilitan props.

Los metadatos y pronósticos usan paginación por clave, corte fijo y conteos exactos. Cambios de conteo, páginas incompletas, duplicados o límites producen un error explícito, sin estadísticas parciales. Los cuerpos se leen en lotes de tres, verificando identidad contra los metadatos. Límites: 5,000 filas de metadatos, 2,000 proyecciones del día, 10,000 contextos, 190 fechas fuente, 15 MiB por recibo y 48 MiB totales. El plazo global es 45 segundos. El proceso reúne solicitudes iguales y conserva hasta tres respuestas durante tres minutos; `readAt` sigue siendo el corte real de la respuesta.

Las URLs originales son filtros y procedencia; nunca se consultan desde esta ruta. Los errores de backend se reducen a códigos conocidos; no se devuelven credenciales ni mensajes privados.

## Interpretación de los datos

### Fecha, identidad y temporada

Los partidos de la fecha se filtran por `America/Puerto_Rico`, aunque una URL diaria ESPN pueda contener partidos de otra fecha local. Los eventos se identifican por su ID ESPN y los equipos por su ID; no se mezclan universidades por similitud de nombre.

El directorio contiene equipos observados, incluidos rivales de otras divisiones. No afirma que cubre todas las universidades de División I. Los estados pospuesto, cancelado, en juego y final conservan su significado.

### Récord reportado y archivo observado

`reportedRecord` conserva el récord que publica la fuente, con evento, recibo y hora. `archive` calcula W/L y promedios únicamente con finales observados de la temporada anterior al día consultado. Ambos conjuntos se presentan por separado. La coincidencia de cobertura se indica explícitamente; una ausencia no se convierte en cero.

El historial de un día excluye los resultados de ese mismo día. Esto permite consultar una fecha después de sus partidos sin incluir el resultado objetivo en sus propios promedios. Es una vista descriptiva reconstruida al corte de lectura, no evidencia de que todo el historial estuviera disponible antes de una decisión histórica.

### Últimos diez y descanso

`recentGames` muestra hasta diez finales concretos con rival, sede, marcador, resultado y captura. `last10.coverage` distingue diez verificados, temporada con menos de diez juegos, historial parcial y ausencia de historial. Una muestra de seis encuentros no se etiqueta como diez completos.

Los desgloses local, visitante y neutral usan la sede verificada. El descanso solo se etiqueta como verificado cuando la secuencia lo permite.

### Estadísticas y mitades

En los scoreboards de partidos futuros, las estadísticas de competidores pueden ser acumulados de temporada; en los finales, representan el partido. El normalizador no suma los acumulados futuros como si fueran encuentros adicionales.

FG%, 3P% y FT% usan el cociente de aciertos e intentos agregados. Rebotes, asistencias y pérdidas conservan un denominador por métrica. Los datos ausentes permanecen nulos. Las mitades se derivan de los períodos realmente archivados; la prórroga no se agrega a la segunda mitad.

El resumen detallado solo complementa un final cuando su identidad y marcador coinciden. Si falta, las estadísticas verificadas del scoreboard siguen disponibles y las faltantes continúan vacías.

### Proyecciones y cuotas

Se reutiliza el lector estricto `buildNcaabArchivedEvidence` para cuotas pareadas. Un precio necesita un pronóstico original que coincida, identidad exacta, horario y captura prepartido. Sin ese enlace, se muestra ausente. No se inventa una fecha de emisión para forzar la lectura de cuotas.

Los precios son referencia archivada, no ofertas ejecutables. Permanecen sin certificación de prórroga, disponibilidad actual, EV o recomendaciones. Las proyecciones mantienen su estado experimental.

## Interfaz

Pick incorpora una sección bajo demanda con Resumen, Partidos, Equipos, Últimos 10 y Estadísticas. Incluye selector de fecha, búsqueda, filtro de equipos del día, paginación y navegación de pestañas con teclado. La sección funciona incluso cuando el resumen original de pronósticos no está disponible.

Los paneles principal y privado reciben exactamente el mismo contrato; el Site mantiene su propia navegación y permisos.

## Verificación y operación

Pruebas: normalización de identidades y horarios, separación de estadísticas de temporada/partido, historiales incompletos, duplicados y correcciones, denominadores, períodos, proyecciones sin recalcular, fallos de paginación, y presentación de ausencia de datos. Se ejecutan también las regresiones NCAAB del dashboard y la compilación completa.

Validación local del 24 de noviembre de 2026: 54 pruebas aprobadas y `npm run build` completo con salida 0. La prueba de transporte conserva un JSON UTF-8 mayor de 5.4 MB y verifica que `UNAVAILABLE` mantiene HTTP 503. El corte real de las 12:22:15 UTC contiene 87 partidos de la fecha PR, 562 equipos observados y 1,158 finales anteriores; el estado sigue siendo `PARTIAL` por cobertura histórica ausente. La latencia y permisos efectivos de la nueva ruta requieren verificación en el despliegue antes de darla por publicada.

El almacenamiento original y los ciclos existentes permanecen intactos. Si una lectura supera el presupuesto, se muestra no disponible y se investiga la proyección de fuente antes de ampliar el límite; no se sirve un subconjunto como temporada completa.
