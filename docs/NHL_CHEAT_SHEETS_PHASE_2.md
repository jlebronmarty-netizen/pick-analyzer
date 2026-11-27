# NHL Cheat Sheets · segunda fase de revisión privada

Base bf68d85c del PR #414. El lector de archivo y la presentación viven en src/app/nhl-cheat-sheets. Los controles de ventanas están en windows.mjs. El prototipo de contabilidad está en research/nhl-sheet-tracker y carece de integración con la aplicación.

## Cobertura al corte

En la vista del 27 de noviembre, BOS y SEA tenían ocho eventos elegibles de calendario y DET, WSH, COL, LAK y NYR tenían nueve. Cada evento enumerado tenía un box comparable. El lector exige una secuencia continua de recibos diarios aceptados. Los siete equipos siguen sin L10 completo hasta acreditar la secuencia restante. La causa exacta por recibo diario sigue pendiente. H2H consulta aparte el índice de boxes finales de temporada regular 2026–27, por ambos equipos y corte histórico. El límite es de cinco o diez encuentros archivados. Los resultados son cobertura observada. No se acredita exhaustividad entre temporadas. El ranking requiere al menos cinco partidos únicos. Un error de lectura invalida el corte.

El archivo V13 del 23 de noviembre proporciona la afiliación de los 32 equipos en esta temporada. La ficha utiliza los promedios de temporada, puntos, récord por sede y ranking cuando el corte manual los conserva. Faltan standings nativos completos. El archivo de probables ESPN acredita el estado reportado. Quedan pendientes recibos prepartido para lesiones y alineaciones completas. El inventario de tablas NHL y las fuentes archivadas consultadas carecen de una serie específica de esos dos campos.

En nhl:2026020349 el box archivado marca TBL 19 y EDM 24. El PBP de reglamentario y OT suma TBL 20 y EDM 24. V13 daba 20 y 23. Se acepta EDM 24 cuando concuerdan el valor, la versión del box y las comprobaciones del normalizador. Se omite TBL y su reflejo en tiros permitidos de Edmonton.

## Condiciones descriptivas v1

Cada criterio devuelve cumple, no cumple o sin evidencia. La clasificación por condiciones cuenta cumplidos y muestra cuántos pudieron evaluarse. El desempate usa frecuencia de la línea y muestra. Ningún conteo constituye una probabilidad calibrada. En puck line se aplica el hándicap archivado a la diferencia de goles del lado elegido. En totales se evalúa el sentido de la línea.

| Criterio | Denominador y umbral |
|---|---|
| L5 y L10 | Serie completa por equipo. Al menos 60% superó la línea del mercado. El empate permanece en el denominador. |
| Sede | Submuestra por localía dentro de L10, mínimo cinco por equipo considerado. Corte 60%. |
| H2H | Hasta diez encuentros de ambos equipos, mínimo cinco y corte 60%. Para totales cada evento cuenta una vez. |
| Goles | Diez observaciones válidas por equipo. Promedio cruzado entre goles a favor y los permitidos por el rival. Margen de al menos 0.25 goles en la dirección elegida. |
| Tiros | L10 completo de ambos. Diferencia de sus diferenciales dividida por dos, mínimo dos tiros. En total, volumen medio combinado al menos dos tiros por encima o debajo de 60 según el lado. |
| Portero | Ambos confirmados, al menos tres apariciones y 60 tiros enfrentados por portero en L10. Ventaja mínima de un punto porcentual en SV%. En totales se contrasta la media de ambos con 90% en el sentido del lado. |
| PP y PK | Ambos equipos con porcentajes comparables. Ventaja de tres puntos porcentuales en la suma PP+PK. En total, media de ambos PP y tasas rivales de fallo de PK frente a 20%, con margen de tres puntos. |
| Descanso | Ambos descansos verificados. Un día adicional para el equipo elegido. Para over, al menos un back-to-back; para under, ninguno. |

Los umbrales son hipótesis descriptivas para revisión. Falta medir estabilidad fuera de muestra y distinguir los resultados según el denominador evaluable.

## Contratos y liquidación

Circa aporta precios principales de ML, puck line y totales. Se conservan casa, lado, hora, cuota y línea archivados. Para períodos, totales de equipo y props de tiros, goles, asistencias y atajadas queda pendiente unir recibo específico, ámbito y reglas vigentes. El reglamento público de Circa Nevada y las reglas publicadas para FanDuel en Massachusetts no demuestran la jurisdicción ni las condiciones de cada recibo, particularmente para FanDuel Puerto Rico. Mantener todos esos mercados fuera de liquidación. El marcador final para frecuencias incluye la decisión de shootout. Los goles de rendimiento, períodos y estadísticas individuales requieren su propio criterio. Referencias: https://www.circasports.com/house-rules y https://massgaming.com/wp-content/uploads/FanDuel-House-Rules-3.30.26.pdf.

## Laboratorio de tracker

lab.sql se ejecuta solamente en PostgreSQL desechable. Primera inscripción por método, banda y contrato, posición original, hora de servidor, precio y regla congelados. La vista con security_invoker separa posición individual y Top inclusivos 1/3/5/7/10. ROI es beneficio neto dividido por unidades liquidadas. Push devuelve la unidad. DNP, void y pendiente excluidos de stake y accuracy. Los pares requieren identidad de contrato, ámbito, inicio y pronóstico Pick prepartido. Existe prueba de permisos de lectura sin delegación, RLS, inmutabilidad, inscripción idempotente y liquidación posterior al inicio. Los datos de prueba son exclusivamente sintéticos locales. El adaptador de estadísticas finales a evidencia verificada, acreditación del recibo de reglas y escritor operativo siguen pendientes.

## Paridad con Site

Se tomó el último corte manual archivado de cada evento y su lista de IDs. Se cruzaron los dos equipos con boxes finales disponibles antes de ese mismo corte y se compararon ambas sumas de marcador. El 23 de noviembre coincidieron 2 de 2 series completas entre 14 equipos-evento. El 24 coincidió 1 de 1 entre 2 y el 25 coincidieron 3 de 3 entre 6. Son seis comparaciones completas de 22 posibles. Esta prueba mide marcador a favor y en contra en los mismos eventos. No acredita paridad de lesiones, porteros, tiros ni del calendario reconstruido independientemente. Continúan las dependencias del Site y el seguimiento NBA.
