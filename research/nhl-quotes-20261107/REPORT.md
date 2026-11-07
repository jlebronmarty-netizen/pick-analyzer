# NHL — cierre de mejora de cuotas gratuitas

**PASS.** En el ciclo real de las 17:37 PR del 7 de noviembre de 2026, la cobertura de pares Circa para partidos futuros pasó de **5/10 a 10/10**, sin aumentar las **12 solicitudes gratuitas por ciclo** ni cambiar el cron de 30 minutos. Página: https://pick-analyzer.vercel.app/nhl.

## Causas y reparación

El presupuesto anterior incluía directorio y fechas repetidas antes de consultar solo los primeros siete partidos. Además, las etiquetas NY Rangers / NY Islanders impedían reconocer dos pares existentes. Se reutiliza un directorio oficial íntegro de hasta 24h, se solicitan fechas relevantes con protección Puerto Rico/Eastern a medianoche, y se priorizan precios ausentes/vencidos y el intento más antiguo. Solo se aceptan equivalencias verificadas y filas visitante/local inequívocas. Reproducir los mismos siete documentos archivados produjo 5/7 pares con el lector anterior y 7/7 con el corregido; ese diagnóstico no hizo llamadas nuevas ni rellenó precios históricos.

## Registro independiente

Diez snapshots contemporáneos de probabilidades/precios se guardaron antes del inicio, con FK de predicción, ciclo, página de precio, probabilidades DRatings, calendario y directorio oficiales. El último directorio se reutilizó verificando gzip y SHA256. Se comprobó por separado el SHA256 de los trece raws relacionados y se reprodujeron exactamente las diez observaciones desde sus fuentes.

Los **29 registros originales** conservan el mismo hash por ID. Ninguna cuota nula se reemplazó y los precios posteriores no entraron al ROI original ni añadieron victorias. Las métricas originales coinciden antes/después de la mejora. La captura de un resultado nuevo anterior al despliegue ya había actualizado el registro a 14 W / 5 L; no fue un cambio de fórmula ni un efecto de las cuotas. Esta entrega no introduce otra cohorte de accuracy/ROI ni promociona Official Picks.

La página ahora diferencia cobertura de probabilidades y cobertura de pares recientes. El historial identifica la cuota posterior como una observación separada, con su fecha y sin uso en el ROI original. Solo se reutilizan snapshots completos de hasta 45 minutos, todavía prepartido y con la misma identidad/horario oficial; nunca se combina una probabilidad nueva con un precio viejo. LIVE, capturas futuras, fechas incompatibles y pares vencidos no entran en edge vigente. Una fuente puede dejar de ofrecer una cuota: 10/10 describe esta verificación, no una garantía permanente ni ejecución certificada.

## Verificación

- Ciclo `NHL:996715`: PASS, 12 solicitudes, directorio en caché, diez intentos PAIRED, sin errores. Lease liberado.
- Después de abrir API y página: diez observaciones y doce fuentes nuevas en ese ciclo; no nuevas adquisiciones ni escrituras por lectura.
- RLS, vista SECURITY INVOKER y grants verificados. Se retiró explícitamente el TRUNCATE heredado del rol de servicio en la tabla nueva; solo SELECT/INSERT. Sin UPDATE/DELETE/TRUNCATE ni acceso de navegador. No se truncó ni modificó ningún dato.
- 93 pruebas multisport, 261 regresiones Edge Lab, lint y builds locales/preview PASS. Las reparaciones concurrentes de Edge Lab se preservaron; sin cambios de modelos, writers, suscripciones o schedulers de otros deportes.
- Migraciones registradas: `20261107211452` y `20261107212911`. El CLI no estaba instalado/cached; los nombres de archivo usan las versiones reales generadas por el conector de migraciones de producción.

Evidencias: `BASELINE.json`, `PARSER_REPLAY.json`, `LIVE_REPLAY.json`, `VERIFICATION.json` y `PROTOCOL.md`. `verify-live-export.mjs` reproduce el conjunto de raws exportados sin acceder a proveedores ni escribir en la base:

```bash
node --loader ./tests/dashboard-multisport/tsx-loader.mjs research/nhl-quotes-20261107/verify-live-export.mjs /ruta/al/export
```

Los archivos completos permanecen archivados en Pick; el export usa `manifest.json` y `<source-id>.raw` descomprimidos. NHL continúa en SHADOW. Recuperación del historial del Hub y validación predictiva/calibración/rentabilidad quedan como trabajos separados.
