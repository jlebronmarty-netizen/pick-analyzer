# PR 391 en producción · 20 de noviembre de 2026

## Estado comprobado

| Protección | Evidencia |
|---|---|
| Implementada y probada antes del despliegue | La integración conserva el árbol Git exacto `8f38c229e7a72e0092b2fd16f9ebf445c9af89dd` del commit revisado `ba4d312b`. Las 811 pruebas Node y las cuatro pruebas de navegador corresponden a la validación previa. |
| Desplegada | Vercel asignó `pick-analyzer.vercel.app` al despliegue `dpl_qMqxrp2MUZigfp8d2DcbCokTCcDh` en estado READY a las **9:20:22 p. m. PR**. `GET /api/system/version` en el alias devolvió HTTP 200, entorno production y `9275118c719a7f3e19760db5bec80f50ce04300c`. |
| Verificada en producción | La página principal y el tablero se sirvieron desde ese despliegue. A las **9:25:02 p. m. PR**, la API privada devolvió HTTP 200, versión `NBA_DECISION_BOARD_SHADOW_V2_INTEGRITY`, `private, no-store` y gzip. Se cotejaron todas las exclusiones y preferencias del corte. |
| SHADOW | Lectura de métricas V2 comprobada. La primera ejecución de congelación y liquidación de la versión nueva seguía pendiente al cierre. |

[Integración #391](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/391) · [Despliegue de Vercel](https://vercel.com/pick-analyzer/pick-analyzer/qMqxrp2MUZigfp8d2DcbCokTCcDh) · [Informe previo y reversión](production-review.md)

## Pantallas, selección y exclusión

La portada devolvió HTTP 200 con el título, navegación por deporte, actividad y rendimiento. Su enlace NBA redirige de `/nba` al board y luego al host privado del despliegue. Un acceso anónimo al host privado redirigió a Vercel SSO. Las lecturas autenticadas del HTML, del board y del aprendizaje devolvieron HTTP 200.

| Vista NBA | Lados del archivo en el corte | Preferencias verificadas |
|---|---:|---:|
| Top 25 | Selección entre los mercados | 25 contratos distintos de tres partidos |
| Moneyline | 18 | 0 |
| Spread | 18 | 0 |
| Total | 18 | 0 |
| Player Props | 1,562 | 0 |
| Cuartos / Mitades | 504 | 43 |

De los **2,120 lados**, 150 pasaron los controles de datos. Los otros 1,970 tenían una razón de exclusión. Por primer estado hubo 498 INCOMPLETE_HISTORY, 1,016 PARTIAL, 372 STALE, 48 IDENTITY_MISMATCH y 36 CONTRACT_UNVERIFIED. Las 498 filas incompletas quedaron en PASAR con L5, L10 y proyección nulos. Entre ellas había **122 lados de partidos que aún no habían empezado**. Ninguno entró en las preferencias ni en el Top. Seis menús principales rechazados por fase correspondían a juegos cuya hora de inicio ya había pasado. La API no reportó errores de lectura.

Los 43 contratos preferidos tenían historia validada, cuota con operador y hora anterior al corte, vigencia pregame y clasificación VIGILAR. Los IDs de los 25 destacados pertenecían a esas preferencias. El cotejo por juego, período, mercado y línea no encontró duplicados ni lados opuestos en los contratos preferidos. Se emitieron **cero JUGADA**. La respuesta reportó cero llamadas deportivas y cero escrituras.

- **Exclusión visible.** Keyonte George, puntos, Over 23.5. La interfaz mostró PASAR e INCOMPLETE_HISTORY, y en el detalle `PLAYER_ROW_MISSING_AT_CUTOFF` para el juego `21718078`. La consulta de Supabase encontró un manifiesto del juego con 28 filas, pero ninguna fila compacta de este jugador al corte. No se dedujo participación, DNP ni cero a partir del manifiesto.
- **Preferencia válida.** Phoenix–Utah, total del cuarto período, línea 53.5. Una consulta independiente de lectura combinó el archivo estacional y los calendarios diarios disponibles al corte. Ordenó los finales y recuperó las mismas diez identidades de juego por equipo. L5 sumado 61.60, L10 sumado 57.20 y proyección 56.54 coincidieron con el tablero. El estado fue VIGILAR y la disponibilidad regional seguía sin verificar.
- **Pantallas.** En Chromium a 1440×900 y 390×844 se recorrieron las seis pestañas, el orden de brecha, el filtro por jugador, los motivos de exclusión, el filtro de período y la paginación de 30 a 43 filas. El documento cabía en ambos anchos. Se usaron los HTML, 13 recursos estáticos y respuestas API reales del despliegue. Para probar las interacciones se entregaron a Chromium las respuestas ya obtenidas, conservando los mismos datos en ambos tamaños. Se excluyeron el panel auxiliar `/api/dashboard` y la precarga de ajustes. La sesión SSO del usuario final quedó fuera de esta prueba.

## SHADOW, horarios y errores

El archivo desplegado conserva `35 15,23 * * *` UTC para congelación y `15 12 * * *` UTC para liquidación. Los últimos tres ciclos en logs, anteriores al despliegue, terminaron satisfactoriamente con cero llamadas deportivas. Las congelaciones de las 11:35 a. m. y 7:35 p. m. PR registraron 234 intentos idempotentes cada una. La liquidación de las 8:15 a. m. PR registró 119 intentos.

Después de READY, el servicio de aprendizaje devolvió `NBA_DECISION_STATISTICAL_SHADOW_V2` con **708 forecasts, 119 outcomes, 31 grupos con peso por juego, 14 comparaciones y cero promociones**. Supabase confirmó 708/119, cero forecasts V2 emitidos y cero nuevas liquidaciones desde READY al corte de las 9:25:44 p. m. La fila congelada de Shead conservaba su huella `55eb0c114238577d4e8023f29b3968af`.

El contador de Vercel no reportó errores de ejecución y los logs del despliegue no registraron warnings, errores ni fallos fatales entre 9:20:22 y 9:30:54 p. m. PR. El log `NBA_DECISION_DATA_QUALITY` de las 9:25:05 p. m. reprodujo los conteos de la API. Solicitud de referencia `sf9qr-1795224302435-dca352818625`.

**Pendiente prospectivo.** El sábado 21 de noviembre, los siguientes ciclos son 8:15 a. m. PR (liquidación) y 11:35 a. m. / 7:35 p. m. PR (congelaciones). Para verificarlos, cotejar los logs de cada ruta con los nuevos IDs y su versión en Supabase. Un ciclo sin candidatos puede terminar correctamente sin emitir filas. Confirmar que las disputas y el DNP permanezcan pendientes cuando corresponda. No se invocaron crons manualmente. El cotejo se limita a esta ventana de producción.

## Consultas reproducibles

La siguiente consulta usa la hora exacta del corte y el histórico tal como estaba disponible entonces. La línea, el contrato y la vigencia se comprobaron por separado en el JSON autenticado del board.

```sql
with archive as (select summary->'history_capture' cap
  from nba_market_sync_runs_v1
  where run_id='569d3e7c-8378-448b-9679-a4ffbcf86fe7' and completed_at<='2026-11-21T01:25:02.753Z'),
days as (select distinct on(date_local) date_local,source_received_at,payload
  from nba_market_schedules_v1
  where date_local between '2026-11-17' and '2026-11-20' and recorded_at<='2026-11-21T01:25:02.753Z' and source_received_at<='2026-11-21T01:25:02.753Z'
  order by date_local,source_received_at desc),
receipts as (select (cap->>'received_at')::timestamptz ts,g
  from archive
  cross join lateral jsonb_array_elements(cap->'raw_provider_responses') p
  cross join lateral jsonb_array_elements(p->'data') g
  union all
  select source_received_at,g
  from days
  cross join lateral jsonb_array_elements(payload#>'{data,games}') g),
games as (select distinct on ((g->>'id')::bigint) g
  from receipts
  order by (g->>'id')::bigint,ts desc),
target as (select g#>>'{home_team,id}' h,g#>>'{visitor_team,id}' a
  from games
  where g->>'id'='21718153'),
seq as (select team, row_number() over (partition by team
  order by (g->>'datetime')::timestamptz desc) n,g->>'id' gid, (case when g#>>'{home_team,id}'=team then g->>'home_q4' else g->>'visitor_q4' end)::numeric scored,(case when g#>>'{home_team,id}'=team then g->>'visitor_q4' else g->>'home_q4' end)::numeric allowed
  from games
  cross join target
  cross join lateral (values (h),(a)) s(team)
  where team in(g#>>'{home_team,id}',g#>>'{visitor_team,id}') and g->>'status_state'='final' and g->>'season'='2026' and (g->>'datetime')::timestamptz<'2026-11-21T01:25:02.753Z' and coalesce((g->>'postseason')::boolean,false)=false),
agg as (select team,array_agg(gid
  order by n) ids,count(*) samples,avg(scored) filter(where n<=5) l5,avg(scored) l10,0.4*avg(scored) filter(where n<=5)+0.6*avg(scored) offense,0.4*avg(allowed) filter(where n<=5)+0.6*avg(allowed) defense
  from seq
  where n<=10 group by team) select h.samples home_games,a.samples away_games,h.ids home_ids,a.ids away_ids,round(h.l5+a.l5,2) l5_sum,round(h.l10+a.l10,2) l10_sum,round((h.offense+a.defense+a.offense+h.defense)/2,2) projected_total_q4
  from target join agg h on h.team=target.h join agg a on a.team=target.a;
```

```sql
select count(*) as filas_del_jugador_al_corte
from public.nba_goat_player_game_research_v1
where provider_game_id = 21718078 and player_id = 56677834
  and materialized_at <= '2026-11-21T01:25:02.753Z';

select count(*) as filas, min(md5(to_jsonb(f)::text)) as huella_shead
from public.nba_decision_shadow_forecasts_v1 f
where forecast_id = '687c202e313d6ca8f9beffe660d1d645f16df1af53e910c08501441d1fe78c79';
```
