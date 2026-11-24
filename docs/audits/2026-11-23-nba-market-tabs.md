# Mercados NBA del 23 de noviembre

La respuesta del tablero de producción del 23 de noviembre de 2026 a las 5:30:25.852 p. m. de Puerto Rico cubrió diez juegos. El alias servía `1642fbdae0687ed6fdef6603094bf337765d10f8`. En la respuesta, `evidence.readIssues` y `evidence.marketCaptureIssues` estaban vacíos. El servicio declaró cero llamadas a proveedores y cero escrituras.

| Pestaña | Lados en la respuesta | Preferencias | Evidencia al corte |
|---|---:|---:|---|
| Moneyline | 20 | 0 | Regla de prórroga sin verificar en los 20 |
| Spread | 20 | 0 | Mismo motivo en los 20 |
| Total | 22 | 0 | Mismo motivo en los 22 |
| Player props | 1,548 | 0 | Historial incompleto y prórroga sin verificar en los 1,548 |
| Cuartos / Mitades | 560 | 169 | El Top 25 tenía 21 selecciones de cuartos y cuatro de primera mitad |

A las 5:43:27 p. m. PR se volvió a leer el alias de producción después de integrar el PR #398. El despliegue `4cef87c7a8099dbcc028899e0ec8e91724bcf079` estaba READY. El tablero devolvió HTTP 200 y diez juegos, con 20 lados de Moneyline, 20 de Spread, 20 de Total y 1,566 de Props. Las cuatro pestañas conservaron cero preferencias y los mismos motivos de prórroga e historial. Cuartos / Mitades mantuvo 169 preferencias y el Top 25 mantuvo 25. El inventario CSV y las pruebas de repetición usan el corte anterior de las 5:30 p. m.

## Contratos de partido completo

El código coteja el período y la regla de la cuota normalizada. FanDuel Puerto Rico publica la regla general NBA de inclusión de prórroga, con excepciones por mercado. Para aplicar esa regla a una captura concreta sigue haciendo falta identificar su mercado exacto, región y condiciones vigentes al recibirla. Registrar esa correspondencia permitiría evaluar el contrato con su regla y conservar la evidencia temporal. La etiqueta FanDuel por sí sola es insuficiente. [Reglas de FanDuel Puerto Rico, sección de baloncesto NBA](https://www.fanduel.com/fanduel-sportsbook-house-rules-pr)

La referencia `FANDUEL_NBA_FULL_GAME_RULE` de `goat-provider-policy.mjs` apunta a Nueva Jersey y marca `sportsbookSettlementClaimed: false`. Su alcance es estadístico. Para Puerto Rico se necesita una referencia contractual con su propia procedencia.

El cruce por `quote_id` de los 60 lados GOAT de equipo con `nba_market_snapshots_v1` devolvió 60 recibos FanDuel con `FULL_GAME_LABEL_OT_UNVERIFIED`, `overtime_rule = NOT_VERIFIED` y sin región ni jurisdicción declaradas en la cuota. Los otros dos lados de Total procedían de HoopsAPI y el tablero también los marcó con `OVERTIME_RULE_UNVERIFIED`.

## Historial de jugadores

Los 1,548 lados corresponden a 121 jugadores. Se deduplicaron las incidencias `PLAYER_ROW_MISSING_AT_CUTOFF` de `historyEvidence` por partido y jugador. Los 222 pares de 71 juegos faltaban en `nba_goat_player_game_research_v1` al corte, considerando la disponibilidad de la fuente y su materialización. [Inventario por partido y jugador para cotejar con el archivo](2026-11-23-nba-player-gaps.csv).

| Evidencia disponible para cada par | Pares |
|---|---:|
| Box operacional con el jugador, partido correcto, equipo identificado y minutos positivos | 137 |
| Manifiesto archivado, sin box operacional utilizable en el cruce | 59 |
| Manifiesto y box operacional, jugador ausente del box | 20 |
| Box operacional sin el jugador y sin manifiesto | 2 |
| Sin box operacional ni manifiesto en el cruce | 4 |

Los 137 pares con minutos corresponden a 18 juegos. Se cotejaron `provider_game_id`, la clave canónica `bdl_nba_<id>`, `player_stats_captured_at <= 2026-11-23T21:30:25.852Z`, el juego y el jugador de cada fila de `player_stats.data`. La mera presencia del manifiesto no acredita participación. Para los 85 pares restantes sigue pendiente determinar participación, DNP o falta de captura. En 1,516 lados también faltaba confirmar disponibilidad.

El materializador integrado en el [PR #398](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/398) permite conciliar el box completo con el final y los minutos antes de considerar una fila derivada. Los 137 pares localizados son candidatos a esa conciliación. La aplicación de una reparación en producción requiere autorización aparte.

## Interfaz

El título de cada mercado muestra preferencias vigentes y lados capturados según los filtros. Si existen lados pendientes y ninguna preferencia, al entrar al mercado se ven hasta 30 registros del archivo, con cuota, estado y causa. El usuario puede cerrar la sección, filtrar o ver más. En el Top 25 la sección sigue cerrada inicialmente. El orden de las preferencias, su vencimiento y su clasificación proceden del motor existente.

La prueba de navegador admite una copia local de la respuesta mediante `NBA_ARCHIVED_SLATE_20261123_FILE`. El SHA-256 del texto de respuesta guardado para esta revisión es `319c8bcea1df4e0a722c586392cb67938451f56486bd1b67a568f2982a57f141`. El navegador reproduce ese archivo sin consultar proveedores.
