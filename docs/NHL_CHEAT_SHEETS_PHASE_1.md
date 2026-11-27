# NHL Cheat Sheets · revisión descriptiva del 27 de noviembre de 2026

Ruta privada de Preview `/nhl-cheat-sheets`. El selector de jornada usa Puerto Rico. Para revisar las tarjetas históricas, abrir `/nhl-cheat-sheets?date=2026-11-23`. La entrada está en el panel NHL de Preview. Base visual NBA #413. El seguimiento de la liquidación NBA continúa en su tarea existente.

## Fuentes y límites de la vista

- `src/app/nhl-cheat-sheets/archive.js` lee el contrato de cortes manuales de Pick, boxes individuales y cruces PBP. Reutiliza el normalizador NHL de #399, el lector de cortes y el resolvedor de identidad de portero. Cada box final debe haber estado archivado antes del corte del partido seleccionado. La abreviatura del equipo se vincula al ID NHL observado y el precio tiene que concordar con ambos IDs y la hora del partido.
- Los cortes con equipos y porteros encontrados al revisar Supabase corresponden al 23, 24 y 25 de noviembre (14, 1 y 3 partidos). Puede existir una cuota archivada el día 27 sin la ficha manual correspondiente. Las lesiones, el puesto de liga y las alineaciones requieren un corte que los sustente. El nombre reportado de un portero sólo tiene el estatus que aporta la fuente.
- `nhl_free_quote_observations_v1` y `nhl_free_runs_v1.detail.marketQuoteObservations` suministran precios históricos Circa de moneyline, puck line y totales. Se conserva el último lado con hora de captura y persistencia prepartido. Un conflicto en el último precio lo excluye. Props, totales por equipo y mercados de período quedan sin tarjetas de cuota mientras falte el recibo correspondiente.
- `windows.mjs` exige IDs únicos en el corte manual con secuencia completa y coincidencia con IDs esperados. L5 y L10 son juegos del equipo. H2H se restringe a encuentros contra el rival dentro de esa secuencia. Un periodo tiene su propio denominador. Las aperturas y apariciones de un portero son conceptos diferentes. La muestra de atajadas se refiere a apariciones dentro de la ventana del equipo. SV% = suma de atajadas / tiros recibidos. GAA = goles recibidos × 3600 / segundos en hielo.
- Top 10 descriptivo por mercado y banda: frecuencia estricta sobre el marcador final con desempate, al menos cinco juegos. En totales cuenta la unión de juegos de ambos equipos, una vez cada ID. Igualar la línea cuenta en la muestra y se muestra por separado. Se desempata por muestra y después por evento y lado. Los goles realmente marcados excluyen el gol administrativo del shootout. Ninguna frecuencia habilita liquidación, probabilidad predictiva ni ROI.
- `sheet.jsx` usa directamente SheetCard, FilterGroup, TrendBars y el CSS NBA. `page.jsx` requiere Preview y la protección del panel privado. No hay endpoint de escritura, programación, registros personales ni migración.

## Paridad con V13

Semilla V13 del 23 de noviembre y CSV por equipo del informe Pick #399. Se cruzaron ID del juego, equipo, sede y hora de captura del box; el último juego fue el 22. Los 284 registros equipo–partido coinciden en marcador final. En tiros coinciden 282/284. Para nhl:2026020349 V13 muestra TBL 20 y EDM 23 frente a 19 y 24 en Pick. La vista excluye esos tiros de sus medias hasta conciliar el recibo. Sobre secuencias con todos los boxes comunes, coinciden las sumas de goles L5 en 32/32 equipos y L10 en 8/8. En tiros coinciden 30/32 y 6/8. Las fechas de generación de los dos informes difieren: este cotejo valida los boxes comunes, no la hora de disponibilidad del productor.

El Site todavía produce la secuencia reciente, cobertura de calendario, récord por sede, integración de PP/PK y estados de disponibilidad. El detalle por jugador ya usa Pick. Siguen pendientes la sustitución independiente del productor, la paridad de períodos y porteros por corte y la disponibilidad de lesiones, clasificación y reglas por contrato. #372 y #402 conservan su alcance predictivo independiente.

## Revisión

Pruebas locales de ventanas, deduplicación H2H, bandas y empates junto con regresión NBA y lector NHL. El tracker NHL queda fuera de esta fase. Para retirar la vista previa basta cerrar la rama de revisión. No se modificó infraestructura.
