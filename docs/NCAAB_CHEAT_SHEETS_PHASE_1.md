# NCAAB Cheat Sheets · revisión de la primera versión descriptiva

## Acceso y alcance

El PR documental #416 se fusionó en main. El desarrollo está en el PR #417, rama feat/ncaab-cheat-sheets-descriptive. La página /ncaab-cheat-sheets y su ruta /data requieren Preview protegido. No hay escritor, migración ni liquidación NCAAB. La revisión se limita a comparar equipos y líneas archivadas. Los PR de investigación #350 y #387 siguen su propio ciclo.

## Auditoría reproducible

Elegir la fecha explícita en Preview fija el corte a las 13:00 PR una vez transcurrida esa hora. La selección sin fecha usa el corte actual redondeado a tres minutos. No intercambiar un corte histórico con una lectura posterior del mismo día. Los recibos y contextos deben haber estado disponibles al corte.

| Fecha PR de 2026 | Partidos | Equipos del archivo | Finales | Recibos | Equipos de la jornada con L5 verificada | Equipos del archivo con L10 completa | Temporadas verificadas | Partidos con cuotas pareadas | Cruces con algún H2H |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 23 nov | 45 | 556 | 1113 | 22 | 37/89 | 0 | 203 | 29 | 0 |
| 24 nov | 87 | 562 | 1158 | 23 | 87/172 | 0 | 202 | 74 | 1 |
| 25 nov | 69 | 562 | 1244 | 24 | 67/137 | 0 | 200 | 50 | 0 |

Exclusiones del lector en esos cortes: 4, 10 y 0 eventos respectivamente. El 24 hubo 35 sedes neutrales y 52 partidos con localía registrada. La evidencia explícita permitió identificar 34 cruces DI–DI. Los 53 restantes quedaron sin división confirmada. Un identificador de conferencia por sí solo no acredita la división. El filtro de división selecciona partidos de cartelera. El cuadro de temporada muestra récord y n histórico independientes para DI–DI, otras divisiones, conflictos y desconocidos. El H2H filtra por los dos IDs antes del límite de cinco o diez. Su cobertura se limita a la temporada leída. Se muestra la muestra observada.

## Datos, lectura y presentación

- src/services/ncaab-manual-data.service.ts pagina por clave estable y conteo exacto. Verifica el total restante en cada página, el avance del cursor y la identidad de los recibos al cargar los cuerpos en lotes de tres. Un error, truncamiento o cambio de conteo invalida la lectura. Los límites de memoria y tiempo fallan de forma explícita.
- src/lib/ncaab-manual-data.ts normaliza NCAAB_MANUAL_DATA_V1 a partir de ncaab_daily_source_v1, ncaab_game_context_v2 y ncaab_daily_predictions_v1. Distingue récord publicado y observado. Los resúmenes aportan estadísticas si coinciden los IDs y la evidencia es válida.
- src/app/ncaab-cheat-sheets/archive.js conserva hasta cuatro cortes por instancia y comparte las lecturas en curso. page.jsx envía el índice de partidos y equipos y dos rankings iniciales. El cliente sheet.jsx muestra ocho partidos por lote. La ruta data/route.js carga un detalle al abrirlo o recalcula los rankings al cambiar filtros. El cliente reutiliza cada petición por corte y filtros. Las cachés de instancias independientes pueden provocar nuevas lecturas.
- Se comparten FilterGroup, SheetCard, TrendBars y los estilos NBA/NHL. Los filtros cubren conferencia, división, equipo, partido, ventana, mercado, período y banda. La comparativa incluye puntos a favor y en contra, clasificación publicada si existe, local/visitante/neutral, descanso y parciales. Los tiros usan aciertos totales entre intentos totales. La tabla muestra el número de partidos con estadística válida y los intentos. Una celda ausente no se convierte en cero.
- Las cinco carteleras del 23 al 27 de noviembre tenían 46, 87, 69, 21 y 55 eventos en los recibos examinados. Los precios encontrados correspondían a moneyline, spread y total de partido. Las mitades y los totales de equipo quedan sin tarjetas de precios. Las gráficas de mitades o prórroga proceden exclusivamente de parciales conciliados.

## Ranking y condiciones

src/app/ncaab-cheat-sheets/evidence.mjs ordena por frecuencia histórica, tamaño de muestra y desempate determinista. Por cada mercado o en general muestra hasta diez por banda: −250 o mejor y −650 a −251 inclusive. Requiere línea y cuota pareadas, casa y hora de captura previa al inicio. Cada lado se evalúa a su propia línea. Las reglas de la casa sobre OT, push y anulaciones continúan pendientes de certificación. La frecuencia descriptiva cuenta márgenes positivos sobre todos los juegos de la muestra, incluidos empates con la línea. Carece de usos de liquidación.

Para ML el margen es PF menos PC, para spread se añade la línea del lado y para totales se compara la suma de ambos equipos con la línea respetando Over/Under. L5 y L10 requieren secuencia verificada y ventana completa. Para H2H se requieren al menos cinco cruces observados. Para el total en L5/L10 se requieren ambas ventanas y se deduplican partidos compartidos por ID.

| Criterio | Umbral y denominador |
| --- | --- |
| L5, L10, sede y H2H | Al menos 60 % de márgenes positivos con cinco juegos. Para L10 se exigen diez. Se presenta n por criterio. |
| Margen medio | Al menos dos puntos en el sentido del lado sobre la muestra del ranking. |
| Mitades | Con cinco juegos conciliados, ML/spread requieren diferencial agregado positivo en cada mitad. Totales requieren cinco por equipo y ambas medias del total en el lado correspondiente respecto a media línea. OT queda fuera. |
| Descanso ML/spread | Ambos calendarios verificados y más días libres que el rival. |
| Eficiencia y ritmo | Posesiones por equipo estimadas con FGA − ORB + TO + 0.475 × FTA. Se promedian ambos equipos por juego. Ritmo por 40 min ajustado por OT. Eficiencia por 100 posesiones. Mínimo cinco juegos válidos por equipo. Para ML/spread, ventaja neta de tres puntos por 100 posesiones. Para totales, ritmo medio por la suma de las cuatro eficiencias entre 200 y margen de dos puntos en el sentido seleccionado. |
| ATS histórico | Sin evidencia mientras falten líneas originales por partido anterior. Superar la línea de referencia de hoy no acredita un acierto ATS histórico. |

Los estados son Cumple, No cumple y Sin evidencia. Cada tarjeta indica cuántos criterios se evaluaron. El conteo no está calibrado como probabilidad.

## Paridad y dependencias de V13

Se ejecutó el lector recuperado src/ncaab-panel-service.mjs del paquete V13 contra la misma respuesta de Pick y el mismo readAt. La igualdad del contenido normalizado se verificó en tres jornadas. Fechas de lectura UTC del 28 de noviembre y huella SHA-256:

| Jornada | Corte UTC | Partidos | SHA-256 |
| --- | --- | ---: | --- |
| 23 nov | 00:57:51.234 | 45 | 58d73360246f7dec13717b8ac62c751fb6069c2ccd8f3e9f59fe025287786ae5 |
| 24 nov | 00:57:25.496 | 86 | 20c8137a770d0cacf2e46b785e801e0bde2dda24361a8fbcf7c4e9cd156a1ff4 |
| 25 nov | 00:57:50.646 | 69 | 5450df5c9026985f496ba0aa6fd6c09716eb3b9e3de6f318e1ddfdf9d7376bc9 |

El número del día 24 cambia de 87 a 86 entre los dos cortes. La comprobación acredita la interpretación por el servicio V13 del mismo contenido. Falta un contraste independiente con sus originales publicados en almacenamiento privado. Persistencia de archivos, puntero vigente, programación, actualización manual y acceso del Site continúan allí. Pick genera las comparativas usando sus archivos propios.

## Evidencia de revisión

El corte del 24 de noviembre a las 13:00 PR produjo estas cantidades de tarjetas L5 en la banda estándar y la de −251 a −650: general 10/7, ML 10/7, spread 10/0, total 10/0 y total de equipo 0/0. Son tarjetas visibles después del límite de diez. El documento HTML del tablero bajó de 1.858.352 caracteres a 123.579 en el mismo corte. Las regresiones locales NBA/NHL/NCAAB registraron 368 aprobaciones y el build de Next terminó correctamente. El Preview anónimo redirige a Vercel Authentication.
