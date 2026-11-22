# PR396 — comprobación de datos antes/después

Proyecto Supabase: `ynuocvexviorgdjrfthw`. Solo SELECT y función lectora STABLE. Cero escrituras, proveedores o crons ejecutados manualmente.

## Corte previo al despliegue

`2026-11-22T00:30:52.466181Z`, equivalente al **21 de noviembre, 8:30:52 p. m. Puerto Rico**.

| Conjunto | Filas preservadas al corte | Huella |
|---|---:|---|
| NBA Decision V1 — forecasts | 963 | SHA256 de filas completas ordenadas por forecast_id |
| NBA Decision V1 — outcomes | 693 | SHA256 de filas completas ordenadas por forecast_id |
| NBA Decision V2 — forecasts | 40 | SHA256 de filas completas ordenadas por id, incluidos record y benchmark |
| NBA Decision V2 — judgments | 15 | SHA256 de filas completas ordenadas por cycle_id, forecast_id |
| NCAAB calibration SHADOW | 91 | SHA256 de filas completas ordenadas por id |
| NBA GOAT CURRENT_ERA_SHADOW | 93 | SHA256 de campos originales de pronóstico, precio, inputs, versión y elegibilidad; no incluye estado de liquidación mutable |

Los valores completos de huella constan en `baseline.json`. La consulta `after-cutoff.sql` conserva el corte temporal para V1, GOAT y NCAAB, y `cycle_id <= 4` para V2. Los registros nuevos legítimos de los crons se contabilizan aparte y no se confunden con alteraciones a los originales.

## Ciclos y muestra observada

- V1: 963 congelados en 19 juegos únicos; 693 resultados en 13 juegos; 270 pendientes en 8 juegos. Los conjuntos de juegos liquidados y pendientes se solapan.
- Hay 15 props pendientes con inicio de más de 24 horas, presentes antes del despliegue: 1 en el juego `21718144` y 14 en `21718148`. Es un pendiente previo, no una regresión atribuible al PR396.
- V2: 40 pronósticos en 8 juegos, 15 resultados en 3 juegos y 25 pendientes en 5 juegos. Todos los forecasts son `VIGILAR`.
- El ciclo V2 automático 4, congelación de **21-nov 7:35 p. m. PR**, consideró 1,148 filas y encontró 25 elegibles. Insertó cero forecasts porque los candidatos ya estaban importados. No se presenta como primera captura nueva.
- V2 no tiene un informe generado por liquidación automática todavía. La liquidación natural siguiente es **22-nov 8:15 a. m. PR**; las congelaciones siguientes son **11:35 a. m. y 7:35 p. m. PR**.
- GOAT conserva el cron de media hora; después del corte, el siguiente turno es **21-nov 9:00 p. m. PR**. NCAAB conserva 12:00 a. m., 6:00 a. m., 12:00 p. m. y 6:00 p. m. PR. No se ejecutó ni creó ninguno.
- El lector `read_nba_decision_learning_metrics_v1` devuelve 39 grupos baseline y 30 grupos candidatos, con máximo 13 juegos independientes por comparación y cero promociones. Su intervalo es exploratorio por juego; ninguna señal cumple el requisito de 100 juegos y holdout prospectivo separado.
- GOAT: 93 V1, cero `recommended_pick`, cero `production_eligible`, cero stakes distintos de cero. NCAAB: 91, cero oficiales y cero elegibles para producción.

## Resultado posterior

Producción verificada por el agente principal en commit `a3d2a1a15ba4afa8594c933efe2a1c3de01458be`, despliegue `dpl_GYajmAvr5sZtFpVXUftPHZBRhUtB`, READY el **21 de noviembre a las 8:38:52 p. m. PR**.

La consulta posterior se ejecutó a las **8:39:10 p. m. PR** (`2026-11-22T00:39:10.711864Z`). Los seis conteos y las seis huellas SHA256 coinciden exactamente con el corte previo. `comparison.json` conserva los valores antes/después y `all_unchanged:true`.

Una lectura de conteos completos a las **8:39:28 p. m. PR** confirmó cero filas nuevas fuera de ese corte en los seis conjuntos. GOAT todavía tiene solo la cohorte V1 de 93 filas; no se afirma haber observado aún una primera emisión V1.1. El siguiente turno GOAT natural de **9:00 p. m. PR** sigue pendiente, igual que los ciclos Decision V2 del día 22. No se ejecutó ningún cron para forzar esa evidencia.

Los gates también permanecen: 40 V2 `VIGILAR`, 91 NCAAB con cero oficiales/elegibles y 93 GOAT con cero recomendados/elegibles/stakes. El lector V1 conserva el estado `EXPLORATORY_PROSPECTIVE_SHADOW`, máximo 13 juegos independientes por comparación y cero promociones. Los 15 props pendientes de más de 24 horas siguen identificados como deuda previa.

Archivos de evidencia agregada: `baseline.json`, `after-cutoff.json`, `comparison.json`, `current-totals.json`, `eligibility-baseline.json`, `eligibility-after.json`, `cycles-baseline.json` y `cycles-after.json`. Las consultas de antes/después y de ciclos/gates quedan junto a esos resultados. Los datos privados completos de pronósticos no se incluyen.
