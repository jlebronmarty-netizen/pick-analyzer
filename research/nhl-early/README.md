# Captura temprana de equipos NHL

Pick archiva un registro de equipo antes de conocer necesariamente el rival. El cierre PASS o PARTIAL del cron NHL intenta guardar un lote por media hora. El lote requiere 32 identidades distintas y tasas PP/PK entre 0 y 1 procedentes del último archivo de la misma fuente, con un máximo de 36 horas de antigüedad. La hora del lote la asigna PostgreSQL. Una falla del archivo se registra como advertencia y el proceso principal puede continuar.

El lote conserva los partidos de temporada regular observados más recientes de cada equipo, con ID, fecha, local, visitante, tiros y horas de fuente. Diez filas observadas todavía requieren conciliación con el calendario completo para usarse como L10 certificado. Los goles de temporada, descanso certificado y porteros tienen sus propios requisitos de evidencia.

La vista privada nhl_early_research.first_observation_pairs vincula los dos equipos por ID y temporada. Exige que el lote exista antes de la captura de la fuente usada por el primer pronóstico archivado de ese partido. Una captura anterior a la hora del partido pero posterior a DRatings queda excluida. La hora pública de primera publicación en el sitio de DRatings es desconocida.

Este archivo es independiente del panel manual, del tracker de apuestas y de los pronósticos oficiales. La vista se consulta en modo lectura. El primer lote se verificó el 27 de noviembre a las 8:37:39 p. m. de Puerto Rico: 32 equipos, 313 observaciones equipo–partido, 27 equipos con diez partidos observados y cero cruces con pronósticos anteriores.
