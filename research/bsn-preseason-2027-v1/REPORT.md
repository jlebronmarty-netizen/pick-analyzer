# BSN 2027 — piloto histórico exploratorio

Se evaluaron **38 partidos** de **2026-06-19 a 2026-07-17**, con cuatro reglas fijas. No hay una fórmula validada ni ROI demostrable.

| Regla | Pronósticos | G–P | Accuracy | Cobertura | Local en esos mismos juegos |
|---|---:|---:|---:|---:|---:|
| HOME_BASELINE | 38 | 21–17 | 55.26% | 100.00% | 55.26% |
| ELO32_MIN3 | 13 | 8–5 | 61.54% | 34.21% | 53.85% |
| FORM5_MIN3 | 12 | 7–5 | 58.33% | 31.58% | 50.00% |
| SCORES5_MIN3 | 13 | 8–5 | 61.54% | 34.21% | 53.85% |

Los primeros partidos de cada equipo sirven de calentamiento. El modelo solo ve fechas anteriores en Puerto Rico; todos los resultados de un día se incorporan juntos. Empates de puntuación del modelo producen abstención. La regla local es un comparador, no una fórmula entrenada.

Esta muestra de 38 juegos es una selección histórica limitada, capturada después de los partidos y con fase regular/playoffs no certificada. Las horas del archivo no se presentan como inicios verificados. Ningún resultado entra al accuracy prospectivo de Pick. Las diferencias entre reglas son exploratorias y no seleccionan un campeón.

El intervalo Wilson en summary.json es descriptivo bajo un supuesto de observaciones independientes; no corrige dependencia por equipos/fechas, selección de la muestra ni comparaciones múltiples. La incertidumbre real puede ser mayor.

ROI, beneficio y número de apuestas quedan sin datos: no existen cuotas verificadas para estos contratos. El error de puntos/margen/total no equivale a acertar un mercado O/U o spread.

## Cómo reproducir

Desde el repositorio: `python research/bsn-preseason-2027-v1/evaluate.py`.
No consulta proveedores, no modifica Supabase y no emite picks.
El protocolo, receipt, export original y cada entrada de entrenamiento permanecen archivados.
Para ampliar: importar temporadas completas con licencia/permisos y fechas de juego claras; separar cronológicamente desarrollo y confirmación antes de comparar más reglas. Capturar cuotas prepartido por separado. Una franquicia trasladada en 2027 requiere una revisión de identidad, no una unión automática por nombre.
