# NBA Decision Engine V2 — primera fase experimental

Estado: **solo investigación**. No existe ruta a producción, endpoint, cron, migración, proveedor ni mutación de predicciones oficiales en este cambio.

## Diagnóstico real al 20 de noviembre de 2026

- El Decision Board V1 conserva proyecciones descriptivas, no probabilidades calibradas.
- Los registros congelados en `nba_decision_shadow_forecasts_v1` contienen precios y proyecciones. Las probabilidades predictivas V2 todavía no existen.
- Las liquidaciones disponibles en `nba_decision_shadow_outcomes_v1` abarcan **4 partidos independientes** por los mercados/períodos principales examinados. No cuentan como cientos de juegos porque cada encuentro puede tener múltiples selecciones.
- El control de integridad del PR #391 protege las ventanas, pero no demuestra EV ni rentabilidad.

## Primer entregable de esta rama

`src/lib/nba/decision-probability-v2.mjs` es un núcleo sin efectos:

1. Calcula la probabilidad implícita de cuotas americanas y EV **solo cuando recibe una probabilidad**. Nunca deriva probabilidad de proyección, brecha, L5 ni L10.
2. Acepta registros experimentales únicamente con probabilidad congelada antes del inicio, resultado posterior, contrato verificado, procedencia prospectiva y calidad validada.
3. Separa entrenamiento y holdout temporal usando la hora del partido; los intervalos intermedios no se reutilizan.
4. Calcula Brier primero dentro de cada juego y luego entre juegos, evitando contar props correlacionados como observaciones independientes.
5. Exige al menos 100 juegos independientes tanto de entrenamiento como de holdout para siquiera habilitar **revisión de calibración**, no aprobación.
6. No genera `JUGADA`. `researchDecision` permanece en `VIGILAR` o `PASAR` aunque alguien suministre una revisión externa; la activación futura requiere otro cambio revisado.

Las pruebas usan **fixtures sintéticas** para comprobar invariantes; no son prueba de rentabilidad ni de calibración de NBA.

## Etapas pendientes

1. Diseñar modelos específicos por mercado (Moneyline, Spread, Total, Player Props y períodos), con distribuciones realistas y métricas de incertidumbre. Comparar baseline y candidatos con datos disponibles **antes** de cada juego.
2. Crear un libro V2 separado de probabilidades congeladas, con procedencia, corte temporal, cuota, identidad, versión y motivos de abstención. Primero evaluar el presupuesto y el esquema; **no** crear tablas ni crons automáticamente.
3. Obtener resultados concordantes, sin usar liquidaciones deportivas con contratos no confirmados. Documentar pushes, DNP, tiempo extra, missingness, cobertura y grupos independientes.
4. Evaluar Brier, log loss, gráficos de calibración, intervalos por bootstrap agrupado por juego, y comparar contra la probabilidad *sin vigorish* del operador cuando exista el par de precios.
5. Usar holdout prospectivo separado, sin elegir umbrales con los mismos partidos que validan la estrategia. Auditar ROI con cuotas históricas de ejecución verificables y sensibilidad de precio.
6. Incorporar la lógica de valoración a un nuevo panel SHADOW tras pruebas; evitar alterar los seis tableros oficiales hasta validar.
7. Definir aprobación humana explícita para una versión que pueda emitir `JUGADA`, con evidencia de calibración, EV robusto y contrato/ejecución verificados.

## Condiciones del Challenge 100→1000

Cuotas preferidas -110 a -200, -300 solo excepcional; una jugada como máximo por etapa, cero apuestas es un resultado aceptable. Un desafío de reinversión completa puede acabar en $0 tras una derrota. Nunca usar el índice descriptivo del Top 25 como probabilidad.

## Revisión

Ejecutar `node --test tests/nba-decision-probability-v2.test.mjs`. No fusionar esta rama hasta revisar sus pruebas y el diseño de libro prospectivo. Ninguna métrica sintética debe mostrarse como rendimiento real.
