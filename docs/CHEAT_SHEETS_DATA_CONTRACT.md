# Contrato de lectura NBA

## Publicación controlada · estado de producción

Las tres migraciones están aplicadas. El escritor continúa apagado y la fusión está detenida por permisos adicionales sobre cuatro vistas. [Evidencia, procedimiento de reanudación y requisitos para NHL](NBA_CHEAT_PRODUCTION_ACL_REVIEW.md).


## Integridad de liquidación · revisión del PR #408

FT utiliza exclusivamente pts, reb, ast y fg3m normalizados. PRA, PR, PA y RA requieren todos sus componentes. Datos parciales conservan mercados independientes si el box supera la conciliación de puntos y marcador. Un punto inválido impide certificar el box completo. Ceros válidos se conservan. Un contrato pendiente cuenta en la muestra inscrita y queda fuera de aciertos, fallos, accuracy, unidades liquidadas, ganancias, pérdidas y pares. La liquidación usa evidencia recibida a más tardar en el corte de la ejecución.


## Tracker prospectivo · revisión de lanzamiento de NBA

Contrato prospectivo: primera posición, línea, precio y metodología por estrategia. La vista nba_sheet_performance_v1 publica muestras, unidades, ROI y pares equivalentes por puesto y Top acumulado. [Auditoría, fórmulas, pruebas y procedimiento de activación](NBA_CHEAT_LAUNCH_REVIEW_20261125.md).


## NBA · Revisión posterior a 747b1b66 · 25-nov-2026

Extensión NBA_SHEET_LAB_V1: cuotas prepartido, muestras por período, ocho criterios y liquidación privada. El informe detalla identidad de contrato, unidades, reloj, denominadores y muestras excluidas. [Informe de implementación, pruebas y pendientes](NBA_CHEAT_REVIEW_20261125.md).


Revisión documental 1, 25-nov-2026. La ruta de página es `/nba-cheat-sheets`. El control de acceso lo aplica `nbaManualAccess`; la lectura del rival usa la misma política, con respuesta privada sin caché HTTP. Consultar las rutas protegidas de Vercel con la sesión autorizada. Las claves de Supabase son exclusivamente del servidor.

## Fuentes y flujo vigentes

| Paso | Productor / archivo | Datos y uso |
|---|---|---|
| Cartelera y corte | `src/services/nba-decision-board.service.ts` → `readNbaDecisionBoard({forDisplay:true,withCheatSheets:true})` | Calendario archivado en `nba_market_schedules_v1`; recibos en `nba_market_snapshots_v1`. Identidad de evento/contrato y cuotas en `nba_market_event_links_v1` y `nba_market_quotes_v1` cuando corresponde al lector. Usar tiempos de recepción, registro, inicio y expiración. |
| Evidencia individual | `decision-integrity.mjs`, `decision-storage-original.mjs`, `cheat-game-history.mjs` bajo `src/lib/nba/` | Historial compacto `nba_goat_player_game_research_v1`, contexto original `nba_game_context_v2`, manifiestos y objetos privados en `nba_goat_season_archive_v1`. Vincular por IDs de partido, jugador, equipo, rival y fecha; limitar temporada y fase según la ventana. |
| Tarjeta verificada | `cheat-sheets.mjs` → `cheat-ranking.mjs` | `quoteId,gameId,playerId,name,market,side,line,odds,book,start,updated,expiresAt,matchup` y listas `five,ten,h2h`. Cada juego lleva `id,date,team,rival,minutes,value`. Lado `over/under`. Mercado en `points,rebounds,assists,threes`. |
| Tarjeta descriptiva | `cheat-projections.mjs` + `projectionHistories` | `quote,gameId,player,name,market,side,line,odds,start,captured,expires,projection,l5,l10,five,ten,edge,warnings`. Aquí `five/ten` son conteos y `side` es `Over/Under`. `trend` y `meetings` llevan valor, fecha, rival e ID. Una serie sin conciliación de los diez IDs queda vacía. |
| Rival bajo demanda | `src/app/api/nba/cheat-rival/route.js`, `cheat-rival.mjs`, `nba-manual-data.service.ts` | Archivo manual `NBA_MANUAL_DATA_V1`; finales `game_results` y marcadores conciliados; alineaciones/lesiones en `nba_pregame_context_v1`; `nba_matchup_observations_v3` para el par ataque → defensa. |
| Ranking congelado | `src/lib/nba/sheet-lab/scheduler.mjs` | Captura programada prepartido de cada ranking y primera inscripción por estrategia. Ver el contrato de lanzamiento. |

## Fórmulas, muestras y filtros

- La proyección de Pick usa 0.65 × L5 + 0.35 × L10 sobre la ventana elegible de juegos con al menos diez minutos. Se muestra con una decimal. Se exige muestra de diez, precio FanDuel reciente, proyección/línea/cuota/brecha finitas y ventaja favorable ≥0. Las únicas limitaciones parciales admitidas son cotejo del box, regla de OT y disponibilidad. La diferencia visible es proyección menos línea, incluso para Under.
- Para las barras, el resultado se calcula sobre cada valor real y la línea del contrato. Over gana estrictamente por encima, Under estrictamente por debajo; igualdad es push. El denominador histórico incluye los empates. Las barras aparecen de la más antigua a la más reciente.
- Bandas excluyentes con cuotas americanas enteras válidas (magnitud ≥100). `-250` incluye desde −250 hasta cuotas positivas. `-650` incluye −650…−251. Las cuotas de −651 o inferiores quedan fuera. Se filtra por mercado, banda, vencimiento y ventana antes de limitar a diez jugadores distintos.
- Ranking verificado: L5 exige 5; L10 exige 10; H2H admite de 5 a 10. Usa participaciones validadas con la política de todos los minutos; exige contrato validado y cuota prepartido vigente. Ordena por proporción de aciertos, aciertos en ventana secundaria (L5 al ordenar L10, L10 en otras ventanas), mejor cuota e ID de cuota. En proyecciones ordena por conteo de aciertos de la ventana elegida, otra ventana, cuota e ID. La sección de encuentros también enseña muestras inferiores al umbral.
- En el análisis del rival, cada promedio devuelve `{value,n,total}` en L5, L10 y temporada observada. Se toman las últimas apariciones con minutos >0 y cada métrica usa sus valores finitos no negativos. `null` indica ausencia; cero observado conserva su significado. Las faltas se cruzan por partido/jugador/equipo y los conflictos se omiten. Cambio de minutos = media L5 − media L10, sólo con ambas ventanas completas. Días libres = diferencia de fechas locales de partido menos uno; cero indica back-to-back observado. Una agenda incompleta limita la inferencia.
- La posición procede de una alineación archivada; si falta, se busca una posición previa única del mismo equipo dentro de 45 días. La contraparte requiere una coincidencia posicional única del rival en el juego objetivo. La defensa directa cuenta sólo el par histórico en la dirección seleccionada. La ausencia de reporte de lesión tampoco confirma disponibilidad.

## API, cobertura y errores

`GET /api/nba/cheat-rival?game=<id>&player=<id>&at=<ISO-UTC>`. IDs enteros positivos; usar literalmente el `asOf` del tablero, válido durante 24 horas. Respuesta 200 con `team,rival,pos,roleDate,other,own,comparison,meetings,direct,injuries,rest,lineupAt,cutoff`. En `meetings` cada fila conserva ID, fecha, estadísticas y marcador conciliado o nulo; la UI evalúa el cumplimiento con el contrato de la tarjeta. `direct` contiene fecha, segundos, puntos, FGM/FGA, asistencias y pérdidas. El orden de `rest` es equipo seleccionado y rival. Una lectura prepartido compartida por corte evita recalcular el reporte para cada tarjeta en una misma instancia caliente.

400 para parámetros inválidos o corte vencido; 401/404 según acceso, 404 para jugador/partido no vinculable y 503 si falla el archivo. La interfaz ofrece reintento. Una lista directa vacía también puede significar falta de coincidencia, duplicación o indisponibilidad de la consulta. El texto “sin registro verificable” describe ese alcance. En la hoja, verificar la captura y el tamaño de muestra antes de interpretar una lista vacía.

## Reglas recuperadas para un futuro port

- Equipo visitante estimado = (PF visitante + PC local)/2; local = (PF local + PC visitante)/2. Total = suma; margen = visitante − local. Aplicar la misma ventana y período a los cuatro términos. La brecha de spread usa margen desde la perspectiva del lado más su hándicap firmado.
- Jugador: media sobre valores finitos de la ventana seleccionada. Brecha Over = media − línea; Under = línea − media; % = 100 × brecha/línea sólo con línea positiva comparable. Mostrar cada frecuencia como conteo/n válido. Igualdad = push, incluido en ese n descriptivo. En accuracy se excluye.
- Principal: preferir línea con ambos lados, minimizar distancia de probabilidades implícitas de sus dos precios archivados. Desempatar por identificador. Nunca usar el precio implícito para afirmar probabilidad futura.
- Ocho condiciones NBA: brecha positiva L5 y L10 por separado; frecuencia L10 del lado ≥60% con n≥5; minutos L5 dentro de ±15% de L10 positivo; ≥2 juegos contra rival y mayoría estricta favorable; ≥3 juegos distintos con cruce documentado; disponibilidad explícita active/available; diez filas auditadas y diez valores válidos. Cada verdadero suma uno. La implementación registra verdadero/falso/desconocido; sin brecha L10 comparable o con out/inactive/doubtful el conteo queda sin calificar. Cruce documentado acredita cobertura, no ventaja defensiva.
- FanDuel PR, reglamento archivado con vigencia 30-jul-2026: FT generalmente incluye OT; 1H y cuartos excluyen OT; 2H incluye OT; puntos Q1 requieren participación en Q1. Primer anotador, hitos y SGP pueden tener reglas específicas. Conservar la etiqueta de OT pendiente y distinguir un cálculo descriptivo condicional de un contrato apto para liquidación. Ver versión, excepciones y enlace oficial en maintenance/NBA.md del Site V13. Revalidar el texto aplicable antes de habilitar nuevos mercados.
- Parciales individuales: orden de eventos único, cierre y acumulados por período conciliados contra box final, incluidos OT. Verificar cada métrica del jugador contra su total del juego y exigir evidencia de participación en el segmento. 2H suma Q3, Q4 y OT. Una métrica en conflicto queda ausente. No sustituir eventos pendientes por ceros ni rellenar un segmento con FT.
- Para un par prospectivo exigir mismo partido, mercado, jugador, estadística, línea equivalente, período y contrato temporal prepartido. Cada lado se liquida por su propia selección; ambos porcentajes usan exclusivamente pares decididos. No reconstruir un registro manual pasado desde una selección que el usuario pudo haber visto.
