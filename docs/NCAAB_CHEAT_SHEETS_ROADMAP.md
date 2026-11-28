# NCAAB Cheat Sheets · inventario y plan de desarrollo

## Fuentes que ya comparten Pick y V13

El contrato NCAAB_MANUAL_DATA_V1 de /api/ncaab/manual-data combina ncaab_daily_source_v1 (scoreboards archivados), ncaab_game_context_v2 (resúmenes de equipo) y ncaab_daily_predictions_v1 (emisiones originales). En V13, src/ncaab-panel-service.mjs valida, lee y conserva la respuesta. src/ncaab-ui.js presenta los datos. Reutilizar en Pick los lectores y las validaciones de identidad. La copia privada conserva procedencia y hora de lectura, pero por sí sola no acredita disponibilidad prepartido. Ver [contrato existente](ncaab-manual-data-v1.md).

| Área | Evidencia y trabajo propuesto |
| --- | --- |
| Equipos, L5/L10 y H2H | Derivar L5 y L10 de finales únicos por ID ESPN, temporada y corte. Para H2H, buscar por el par de IDs fuera de la ventana general. Mostrar fechas, secuencia y tamaño observado. |
| Sede, conferencias y clasificación | Usar local, visitante o neutral explícitos. Conservar sede desconocida y distinguir récord publicado de récord observado. Validar conferencia, sistema de clasificación y fecha del ranking antes de usar posiciones. |
| Ataque y defensa | Media de puntos anotados y permitidos por juego comparable. En FG%, 3P% y FT%, sumar aciertos e intentos. Para eficiencia por posesión, exigir componentes, fórmula y denominador documentados. |
| Mitades y descanso | Leer 1H y 2H de parciales verificados. Registrar OT aparte. Calcular descanso sólo con calendario completo y fecha local identificada. |
| ML, spread y totales | Exigir casa, evento, lado, línea cuando corresponda, cuota y captura previa compatibles. Para habilitar liquidación se requieren reglas por casa, jurisdicción, período, OT, empate, push, aplazamiento y anulación. |
| Condiciones favorables | Evaluar por separado ML (récord y diferencial por sede), spread (cobertura a la línea archivada) y total (producción conjunta y anotación por mitad). Probar ritmo, descanso y sede neutral con denominador propio. Congelar umbrales y muestras mínimas antes de cualquier evaluación prospectiva. Mostrar cumple, no cumple o sin evidencia. |

## Secuencia

1. Cotejar V13 y Pick para varias fechas PR con el mismo corte. Verificar horario, IDs de equipos, liga/división, revisiones, sede neutral, mitades, OT y cobertura. Registrar cuántos partidos, ventanas, recibos y líneas sobreviven por mercado.
2. Preparar un Preview privado que reutilice FilterGroup, SheetCard, TrendBars y los detalles expandibles de NBA/NHL. Mostrar L5, L10, H2H, filtros por partido y mercado y ambos rangos de cuotas. Permitir hasta diez tarjetas elegibles por mercado y rango. Validar 390 y 1440 px y regresiones NBA/NHL.
3. Revisar las condiciones con jornadas reservadas y validar cada contrato en su jurisdicción antes de proponer seguimiento prospectivo. Preservar la primera captura, excluir pendientes de decisiones y unidades y comparar con Pick sólo pares equivalentes. Requerirá revisión independiente.

Esta entrega cubre inventario y planificación. Permanecen pendientes el conteo actualizado por mercado, el cotejo multijornada y la certificación contractual.

## NCAAB Cheat Sheets · Preview descriptivo

El PR #417 implementa la primera fase sobre NCAAB_MANUAL_DATA_V1. La auditoría por corte, los denominadores por división y sede, la carga bajo demanda, las reglas de clasificación y los pendientes de cobertura se documentan en la [revisión técnica de NCAAB](NCAAB_CHEAT_SHEETS_PHASE_1.md). El tracker queda pendiente de certificación por contrato.

La [segunda revisión NCAAB](NCAAB_CHEAT_SHEETS_PHASE_2.md) documenta las causas del L10 incompleto, simetría de totales, ordenación y rendimiento por corte, certificación pendiente y el tracker aislado probado en PostgreSQL. Sigue en Preview, PR #417.


## Jornadas y navegación · PR #417

El PR #417 prepara el acceso privado mediante NCAAB_CHEAT_SHEETS_ENABLED. El escritor sigue sin integrarse. La procedencia de los 31.022 box scores, su cuarentena y el proceso pendiente de recuperación se documentan en [Jornadas multideporte](CHEAT_SHEETS_JORNADAS.md).
