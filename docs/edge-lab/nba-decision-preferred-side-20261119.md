# NBA Decision Board: solo un lado preferido por contrato (2026-11-19)

## Solicitud y alcance
El usuario solicita que Pick deje de mostrar ambos lados en las pestañas de recomendación, y los ordene por condiciones favorables. Este cambio es **solo de presentación**. No modifica los quotes inmutables, las predicciones de GOAT/HoopsAPI, las fórmulas oficiales, el registro de pronósticos SHADOW ni sus crons.

## Implementación
- \`src/lib/nba/decision-preference-core.mjs\` deriva \`preferredRows\` a partir de \`rows\`, sin mutar estos datos originales.
- Se agrupa cada contrato por partido, mercado y período. Moneyline tiene un contrato por ganador; spread compara home/away en la misma magnitud de handicap; total compara Over/Under de la misma línea; props elige un lado/línea por jugador y estadística para evitar duplicados y líneas alternativas superpuestas.
- Se muestran **únicamente** lados que superan controles: precio reciente, identidad/quote, historia >=5, partido por comenzar, ventaja numérica coherente con proyección y línea y un margen mínimo conservador por mercado. Un ML con margen insuficiente no se transforma en una jugada automáticamente.
- Ranking **descriptivo** por cantidad de condiciones favorables verificables, soporte histórico y fuerza relativa de la brecha. Factores verificables: muestra >=10, brecha, precio no extremo, L5 y L10 sobre el mismo lado de la línea (solo totales y props), aciertos históricos de props y minutos estables.
- La cotización de una casa no demuestra valor esperado. Las condiciones no son porcentajes de acierto; **probability=null, EV=null**. Los registros sin lado positivo equivalen a **PASAR** y se omiten de las listas de selección. Se muestra menos de 25 cuando menos de 25 cumplen criterios.
- En la interfaz se muestra una sola ficha por contrato con posición de ranking, cantidad de condiciones favorables, puntos de diferencia, línea/cuota FanDuel capturada, L5/L10 y explicación. Los datos reales de ambos lados siguen almacenados para análisis histórico y settlement.
- \`rows\` originales preservados para congelación y evaluación prospectiva; \`preferredRows\` y \`top25\` son **exclusivamente una capa de presentación SHADOW**. No se promocionan modelos ni se generan apuestas oficiales.
- Respetar timestamp real del proveedor, alertar por posibles ofertas regionales no confirmadas y bloquear datos posteriores al comienzo o sin identidad válida.

## Pruebas
- Fixtures con el ejemplo Warriors @ Grizzlies 1H verifican que un margen ML débil resulte PASAR, que el spread solo muestre Warriors +3.5 y que el total solo muestre Over 109.5 cuando ambas ventajas son coherentes.
- Props con Over/Under, varias líneas, cuotas extremas y jugadores distintos; no se producen dos lados del mismo mercado estadístico.
- Se preservan arrays originales para freeze, ordenamiento determinista y PASAR sin evidencia.
- Prueba real protegida en Preview y CI antes de fusionar a producción.
