# Pick Analyzer — multisport Decision Board rollout (2026-11-19)

## Objetivo aprobado
Today debe ser la pantalla principal de **accuracy por deporte**; entrar a un deporte debe conservar la experiencia de NBA (resumen, mercado, selección de un lado, contexto, sort, accuracy y aprendizaje) **solo cuando ese mercado cuente con datos y criterios verificados**.

## Estado auditado
- Today: ya tiene `SportModelOverview` con W/L, accuracy, pendientes y clasificación por deporte. Se mantiene como fuente de métricas, sin calcular porcentajes inventados.
- NBA: Decision Board de seis mercados con `preferredRows`, top25 y sort; números SHADOW no calibrados. Se reduce la prioridad visual del panel de aprendizaje, pero permanece accesible.
- NHL: página propia `NhlDashboard` con ML MODEL_ONLY, datos Circa si hay par confirmado, accuracy W/L y ledger. Spread/Total son investigación separada; no exponer como mercado oficial sin contratos y validación.
- NCAAB: `NcaabDashboard` tiene forecasts, abstenciones y W/L experimentales; no hay cuotas conectadas para afirmar EV.
- NCAAF, Soccer y Table Tennis: `edge-lab` con modelos FREE, coberturas y registros diferenciados. No adoptar el algoritmo NBA para selección de lado.
- MLB: `MlbDecisionBoard`, fuera de temporada; mantener pausas y no activar cron.
- Otros deportes: usar su ruta/historial solo si hay soporte vigente, sin habilitar pestañas vacías que parezcan oportunidades reales.

## V1 — UI / navegación no destructiva
- Today: accuracy arriba, enlaces por deporte en sección dedicada, calendario y juegos debajo.
- Navegación uniforme entre rutas verificadas para los siete deportes principales. Respeta los tableros existentes.
- NBA: panel aprendizaje colapsable para reducir desplazamiento y mostrar oportunidades antes.
- No modifica APIs, DB, modelos, pesos, predicciones congeladas, valores de cuotas, crons, recomendaciones oficiales ni controles de seguridad.
- La lista de enlaces **no** afirma que todos tengan Decision Board NBA de seis mercados. Etiquetar capacidades verdaderas por deporte.

## Fases pendientes para equivalencia funcional
1. Contrato compartido de UI para mercado (game/contract/side, projection, current line, capturedAt, price, sample, modelProbability, calibrationState, evidenceScore, status), con valores nulos cuando no existan.
2. Adaptadores de lectura por deporte, preservando status actual, periodos y settlement. Cada tab solo muestra contratos soportados, no dos lados opuestos si es una vista de recomendaciones; la vista de diagnóstico debe quedar separada.
3. Pruebas de equivalencia y regresión por deporte (as-of, ausencia de cuotas, muestras pequeñas, deduplicación de lados, eventos reprogramados, datos en vivo/postinicio, W/L y filtros).
4. UI específica por mercado con Top N, sort por magnitud apropiada a la unidad de cada deporte, estados PASAR, SHADOW/MODEL_ONLY y Official Picks. Un score entre deportes no se compara sin calibración.
5. Revisión de costos, Auth, Preview, producción y rutas canónicas antes de despliegue.

## Seguridad
No modificar `main` hasta validar Preview. No usar este cambio para reactivar MLB ni crear llamadas a proveedores. El ranking de condiciones y la brecha no se convierten en probabilidad, edge positivo ni ROI certificado.
