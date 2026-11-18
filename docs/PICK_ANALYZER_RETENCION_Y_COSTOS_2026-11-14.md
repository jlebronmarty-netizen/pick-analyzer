# Auditoría de retención y capacidad — Pick Analyzer — 2026-11-14

**Estado: análisis y propuesta, SIN borrados, sin cambios en modelos ni crons.**

## Decisión de diseño acordada
- Para cada deporte, conservar la temporada activa y la temporada inmediatamente anterior como **HOT** (acceso rápido en Postgres).
- Conservar temporadas más antiguas como **COLD ARCHIVE** inmutable en archivos comprimidos privados con manifest SHA256, inventario de cobertura, timestamp, identidad y reglas de restauración. NO es autorización para borrar datos históricos.
- Preservar **sin fecha de caducidad**: predicciones realmente emitidas, precios pregame congelados, decisiones, versiones y features necesarias para reproducibilidad, recibos liquidados, resultados, fuentes, conciliación, etiquetas de DNP, cohortes/holdouts y manifiestos.
- Separar ligas con temporadas que cruzan años (NBA/NHL 2026–27 y 2025–26) de ligas anuales (MLB/NFL 2026 y 2025), y definir cada competencia de soccer por calendario, no por el texto season=2026 de forma genérica.
- Documentar qué versiones entrenan modelos con 2024–25 y anteriores. Backtests/validación histórica se invalidan si se borra data que utilizaron.

## Infraestructura confirmada
- Supabase Pro, Pick Analyzer Micro 1 GB, disco provisionado 27 GB y uso real 15.44 GB; cuota incluida: 8 GB. Smart Shopping es otro proyecto y NO debe tocarse.
- Supabase compute Small 2 GB a $0.0206/h vs Micro 1 GB $0.01344/h (aprox +$5.23 por 730 h), cambiar cómputo exige procedimiento en Dashboard y posible reinicio/downtime. NO ajusta automáticamente el tamaño del disco o Spend Cap.
- Private bucket nba-goat-2026-private y tabla de índice nba_goat_season_archive_v1 preparadas con RLS. En el PR #340 la captura masiva comprime JSON en Storage en vez de Postgres.

## Tamaños de tablas actuales (read-only, los totales incluyen índices/TOAST)
| Tabla | Tamaño total observado |
|---|---:|
| pick2_raw_mlb_statcast_pitches | 4700 MB |
| sports_odds_snapshots | 3452 MB |
| sport_player_stats | 1469 MB |
| historical_raw_records | 703 MB |
| historical_feature_snapshots | 563 MB |
| nba_market_quotes_v1 | 138 MB |

Una muestra probabilística de páginas con TABLESAMPLE SYSTEM(0.15–0.3) sugiere:
- MLB Statcast grande ya corresponde en gran parte a 2025/2026: retención de solo dos temporadas NO libera una fracción importante de esa tabla.
- sports_odds_snapshots mayormente MLB 2026, también actual y no elegible para archivo por antigüedad.
- sport_player_stats contiene NBA 2022–23, 2023–24, 2024–25 y otros deportes: candidato a COLD ARCHIVE **sujeto a revisión de dependencias**, no a borrado directo.
Muestreo no es recuento exacto ni sirve para inferir cantidades por temporada; debe obtenerse inventario determinista por lotes antes de mover filas.

## Otros candidatos de optimización
- Hay un índice UNIQUE y otro no-unique sobre (game_pk,at_bat_number,pitch_number) en pick2_raw_mlb_statcast_pitches, cada uno ~73 MB. El no-unique podría ser redundante si no tiene dependencias; revisar planes de consulta, restricciones y rendimiento antes de proponer su baja. **No ejecutar DROP**.
- Revisar el crecimiento de los snapshots de odds MLB 2026, comprimir capturas históricas repetidas o archivar versiones frías únicamente tras preservar originales de apertura, cierre y cada snapshot pregame necesario para CLV/ROI.
- No ejecutar VACUUM FULL, REINDEX grande ni borrados masivos sobre Micro en producción sin un maintenance window, espacio y backup.

## Secuencia exigida antes de mutaciones destructivas
1. Validar backup reciente restaurable de Pick Analyzer. No tocar datos de Smart Shopping.
2. Capturar inventario exacto por deporte, temporada y tipo, con tamaños y dependencias de claves/queries/modelos.
3. Definir dataset COLD de candidatos; exportar comprimido con checksum, row count, timestamps, manifest y pruebas de restauración en un entorno aislado.
4. Confirmar requisitos regulatorios y que no afectará cohortes de backtesting ni datos originales congelados.
5. Solicitar autorización explícita de la lista exacta de tablas, temporadas, filas y fechas que se eliminarían. Esta nota **no** concede esa autorización.
6. Solo después, lotes idempotentes pequeños y medición de uso antes/después.
7. Si se persigue reducir *disco provisionado*, planear procedimiento de reducción física separado: borrar filas no reduce necesariamente los 27 GB asignados.

## No-go
- NO desactivar Spend Cap ni aumentar disk allocation automáticamente.
- NO fusionar ni desplegar PR #340 por esta política.
- NO modificar Official Picks, modelos congelados, predicciones, crons, settles ni data de otros proyectos.
