# NBA Player Props — Fase 1 prospectiva SHADOW (13 nov 2026)

## Prioridad
Player Props es el mercado NBA prioritario de investigación. Moneyline y los demás motores quedan sin modificaciones. No se habilitan Official Picks, alertas ni apuestas.

## Inventario verificado
- El archivo de odds contiene decenas de miles de cotizaciones de props; las cotizaciones no son resultados reales ni muestras independientes. Múltiples snapshots del mismo jugador/mercado no son predicciones distintas.
- La evidencia archivada de calendarios contiene 57 partidos finales (la cobertura puede cambiar). La base de NBA Game Context V2 contaba con 14 juegos, 395 registros jugador-partido, 265 jugadores distintos, 107 con ≥2 partidos, 23 con ≥3 y 0 con ≥5, al comenzar esta fase.
- El research endpoint histórico pudo cotejar 1,000 quotes (scan cap), pero no tenía una sola predicción prospectiva certificada.
- Las cuatro primeras familias: puntos, rebotes, asistencias, triples. Mercados de hitos (yes) y periodos in-play no se incluyen.

## Cambios de esta rama
1. Baseline independiente, forward-only: necesita al menos 5 partidos finales anteriores a la quote, observados antes del momento de decisión, de la identidad exacta del jugador. Rechaza DNP/baja participación, estadísticas faltantes, mismatches y juegos futuros. Reporta media reciente y rango descriptivo sin aparentar probabilidades calibradas.
2. Endpoint GET /api/nba/goat/props-shadow-readiness: resumen agregado, read-only; 0 llamadas al proveedor, 0 escrituras, y razones de falta de preparación. No entrega recomendaciones.
3. Backfill aislado de box scores: reutiliza la tabla existente nba_game_context_v2, preservando snapshots de lineups. Se ejecuta después del cron GOAT actual y únicamente con flag privado NBA_PROPS_HISTORY_BACKFILL_ENABLED=true; por defecto queda desactivado. Máximo 1 solicitud BDL por ejecución y 4 intentos por día UTC; un partido final por solicitud, sin paginación incompleta ni sobrescribir estadísticas existentes. Las corridas quedan auditadas en sports_sync_jobs.
4. Tests fail-closed para contratos over/under, FULL_GAME_LABEL_OT_UNVERIFIED, tiempos, no lookahead, mínimo histórico, seguridad del collector y separación de los modelos.

## Restricciones
- Aunque el baseline pueda calcular un valor proyectado, es SHADOW_HYPOTHESIS_ONLY: probabilidad/EV = null. No se declara edge ni accuracy.
- No se utilizan lesiones, projected lineups, defensa contra jugador, ritmo o projected minutes como ajustes hasta que se valide su uso. Tener data capturada no prueba que mejore el modelo.
- No se utiliza historial recuperado después de una quote para hacer predicciones retrospectivas aparentando disponibilidad previa. El piloto es prospectivo.
- La comparación estadística posterior al partido no constituye liquidación certificada por FanDuel. DNP y reglas de overtime requieren confirmación.
- El dataset de 57 finales es el historial de calendario disponible, no toda la temporada. Tampoco todos esos juegos tienen necesariamente player stats recuperables.
- Ningún modelo de producción se modifica; no se cambian cron schedules, modelos NHL/MLB/UFC/NCAAB, stakes, ni Official Picks.

## Puertas antes de recomendar una apuesta
1. Verificar preview CI, ejecutar las pruebas y hacer una corrida de backfill auditada, con presupuesto aprobado.
2. Acumular al menos 5 partidos antes de una quote por jugador (para empezar a generar hipótesis), luego 10+ y suficientes resultados cronológicos para investigación.
3. Congelar cada predicción antes del tipoff con ID exacto de game/player/market/line/price, modelo, fecha, snapshots y filtros de lesiones/DNP.
4. Comparar en holdout temporal contra baseline de mercado, monitorizar error de proyección, Brier/log loss solo para probabilidades calibradas, cobertura, rendimiento por tipo de mercado, incertidumbre y CLV.
5. Sólo considerar una versión certificada tras auditoría de reglas del book, datos, calibración, costes, validación fuera de muestra y aprobación humana.

## Activación (no automática)
Una vez verificada la seguridad y el consumo, activar en Vercel Production la variable privada NBA_PROPS_HISTORY_BACKFILL_ENABLED=true. Dejarla ausente o en false mantiene 0 nuevas llamadas al proveedor y 0 escrituras del collector. No colocar la API key en el cliente.
