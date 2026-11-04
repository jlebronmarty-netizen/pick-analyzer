# NHL restaurado en Pick — 4 de noviembre de 2026

**Estado: PASS, adquisición prospectiva en producción.**

Página: https://pick-analyzer.vercel.app/nhl. El bridge anterior del Hub responde 503. Pick ahora captura y consulta su propio registro, sin depender del bridge para NHL.

## Comprobación real

El ciclo `NHL:996559` finalizó a las 15:37:22 UTC: nueve solicitudes gratuitas, cuatro selecciones, cuatro precios originales Circa y cobertura 4/4. Las fuentes oficiales NHL y DRatings devolvieron HTTP 200. El panel general también muestra cuatro partidos, cuatro selecciones y un modelo NHL. Los pronósticos muestran ganador proyectado, probabilidades, precios y horario PR.

| Selección congelada | Probabilidad publicada | Cuota Circa original | Estado |
|---|---:|---:|---|
| Buffalo Sabres ML | 57,10% | −124 | OPEN |
| Florida Panthers ML | 68,40% | −249 | OPEN |
| Seattle Kraken ML | 56,40% | −129 | OPEN |
| Los Angeles Kings ML | 56,90% | −160 | OPEN |

Son observaciones **MODEL_ONLY / SHADOW**, no Official Picks, probabilidades calibradas ni recomendaciones de valor. Mayor probabilidad no implica EV positivo; un favorito puede pagar demasiado poco. Los cuatro resultados siguen pendientes: accuracy, beneficio y ROI permanecen nulos, sin métricas inventadas.

## Operación

Cron autenticado en producción a los minutos UTC 7/37. Máximo 12 solicitudes gratuitas por ciclo, deduplicación de slot, lease, raw comprimido con SHA256, bloqueo por acceso denegado y tablas aisladas con RLS. Páginas y APIs leen exclusivamente datos persistidos: cero llamadas a proveedores y cero escrituras al abrirlas.

La primera selección por partido conserva sus probabilidades y cuotas. La liquidación automática usa el resultado final oficial, incluido OT/SO; identidades, equipos, horario y marcadores deben coincidir. Resultados ausentes o contradictorios quedan sin liquidar. El flujo de liquidación pasó las pruebas; aún no existe un partido final real de esta cohorte para comprobarlo en producción. Accuracy cuenta W/(W+L). ROI aritmético usa solo selecciones liquidadas con cuota original y stake plano de 1u. No certifica ejecución ni rentabilidad.

## Evidencia preservada

El primer ciclo `NHL:996558` capturó cuatro fuentes HTTP 200 pero produjo cero selecciones por nombres oficiales abreviados. Se conserva íntegro. La reparación enlaza nombre completo del directorio NHL por ID y triCode; no inventa ciudades ni altera fórmulas. El protocolo argmax y los umbrales de identidad/tiempo no cambiaron.

Trece raws descomprimidos pasaron SHA256. Las cuatro predicciones se reprodujeron exactamente desde calendario, directorio, probabilidades y tabla Circa originales, comprobando sus claves de procedencia y captura anterior al inicio. Tras abrir NHL y el panel general, siguen dos ciclos, trece solicitudes, trece fuentes y cuatro predicciones con el mismo hash. Lease libre.

Las 84 pruebas multisport, lint, build local final y builds Vercel pasaron. Un intento local falló en limpieza ENOTEMPTY después de compilar y verificar tipos; se preservó el directorio generado y el build completo repetido terminó con código 0. No se cambió configuración de la aplicación para ocultarlo.

Archivos: `RELEASE_VERIFICATION.json`, `REPLAY_VERIFICATION.json`, `MULTISPORT_VERIFICATION.json`, `PROTOCOL.md` y preflights. El historial anterior del Hub está pendiente de exportación y verificación; no se importó su beneficio ni se mezcló con esta nueva cohorte. No se promocionaron Official Picks ni se modificaron otros motores deportivos.

Para reproducir esta auditoría inicial, exportar las trece fuentes inmutables y las cuatro predicciones indicadas en las evidencias, verificar/descomprimir cada raw en `<source-id>.raw` y preparar `manifest.json` con sources, predictions, source_id y runs. Ejecutar desde la raíz:

```bash
node --loader ./tests/dashboard-multisport/tsx-loader.mjs research/nhl-free-direct-20261104/verify-release-export.mjs /ruta/al/export
```

El verificador está acotado a esta cohorte inicial de cuatro observaciones; no reentrena, modifica datos ni hace solicitudes a proveedores. Los raws completos permanecen archivados en Pick.
