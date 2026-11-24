# NHL: aporte predictivo de los datos manuales

**Resultado: todavía no hay evidencia para afirmar que estos datos mejoran las predicciones.** El archivo contiene 14 capturas de siete partidos, con cero finales disponibles al corte. Se implementó la evaluación reproducible para que la falta de muestra quede explícita y los próximos datos puedan evaluarse con el mismo protocolo.

## Corte y alcance

Datos hasta `2026-11-24T00:05:15.236207Z`: **23 de noviembre de 2026, 20:05:15 Puerto Rico**. Política fijada a las 20:13:59 PR del mismo día, después del corte de datos. El registro del protocolo no constituye una emisión de pronósticos y no convierte estos siete partidos en un holdout nuevo.

La producción inspeccionada corresponde a `4d4b4ae2d0a1fd82b31fe090f6b7a0980ec779c2`, integración del [PR #400](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/400). El trabajo está aislado en `research/nhl-manual-predictive-evaluation-20261123`. La corrección de tiros ofensivos de portero del [PR #399](https://github.com/jlebronmarty-netizen/pick-analyzer/pull/399) está integrada: VGK 27 = 26 de patinadores + 1 de Adin Hill. No se vuelve a tratar ese caso como una discrepancia pendiente.

## 1. Sistema activo y referencias

La fuente activa es **DRatings**, contrato `DRATINGS_PUBLIC_V1` y selección `DRATINGS_PUBLIC_ARGMAX_V1`. El baseline de esta investigación es el **primer original archivado**, utilizado por el historial y la liquidación. El tablero vivo puede mostrar una observación posterior de DRatings; la comparación tardía conserva el primer original y no establece superioridad frente a esa actualización contemporánea.

Poisson y V6 son referencias de investigación. Poisson usa los cinco partidos previos observados y un promedio previo de liga según localía, mezclados 75%/25%; su proxy ML reparte la masa de empate 50/50. V6 usa Circa sin margen y un residuo previo de localía con contracción. Los datos manuales no modifican ninguna de esas probabilidades. Los finales se interpretan como ganador oficial del juego completo, incluidos OT y SO; no se liquidan empates de regulación como derrotas.

## 2. Datos y unidad de observación

| Archivo | Filas al corte | Interpretación |
|---|---:|---|
| Manual | 14 | Dos versiones por cada uno de siete partidos |
| DRatings original | 137 | Pronósticos originales archivados |
| Resultados | 130 | Resultados previos, ninguno de los siete con manual |
| Poisson temprano | 57 | Congelaciones de investigación |
| V6 tardío | 31 | 24 con final previo y siete pendientes |
| Directorios NHL | 18 | Recibos archivados para verificar ID, abreviatura y nombre |

Las últimas capturas cubren 14 equipos distintos. Sus 140 referencias L10 apuntan a **108 partidos históricos distintos**; no son 140 ejemplos predictivos nuevos. Las dos actualizaciones conservan los mismos valores de equipo. Hay 42 filas de períodos y 64 apariciones de portero dentro de 14 muestras. El inventario realizó 1.254 comprobaciones internas sin inconsistencia observada. Eso prueba consistencia de lo exportado, no una recertificación independiente de todos los calendarios y fuentes originales.

El payload sí contiene temporada, L10, goles finales y físicos, tiros, períodos, récords local/visitante, descanso, PP/PK y muestras de porteros, aunque la proyección visual de Pick muestre menos campos. **H2H, lesiones, cuotas reales, líneas y reglas del mercado no están en este contrato.** Un timestamp `markets_captured_at` no equivale a una cuota utilizable.

| Corte de decisión en los siete eventos manuales | Manual disponible | Finales al corte del informe |
|---|---:|---:|
| Original DRatings | 0/7 | 0/7 |
| Poisson temprano | 0/7 | 0/7 |
| Congelación V6, 18:07:27 PR | 7/7 | 0/7 |

La última inserción manual ocurrió aproximadamente 51 minutos antes de V6. El anclaje tardío permite estudiar un método nuevo a esa hora, conservando DRatings como referencia histórica. Los datos no se atribuyen a la predicción original, emitida antes de su disponibilidad. Se selecciona una sola versión por evento, la última disponible en ese corte, con concordancia de equipos y horario.

## 3. Hipótesis fijas y resultado actual

| Hipótesis | Definición | Inputs elegibles | Resultado |
|---|---|---:|---|
| H1: goles | Diferencial de goles de temporada y cambio del diferencial L10 frente a temporada | 0/7 | `PRESERVED_SEED` y `standings_captured_at=null`; falta captura primaria oficial |
| H2: tiros | Diferencial L10 de SOG a favor menos en contra, local menos visitante | 7/7 | Siete valores distintos, de −8,5 a +6,9 SOG por partido; cero finales |
| H3: PP/PK | `[(PP_home + 1 − PK_away) − (PP_away + 1 − PK_home)] / 2` | 7/7 | Siete valores distintos; cero finales; ratios 0–1 preservados |
| H4: descanso | Días libres del local menos días libres del visitante | 7/7 | Todos valen cero; no hay variación en esta tanda |

Los porteros se incluyen en el inventario: 1 confirmado según DFO, 4 probables y 9 no confirmados. Ningún partido tiene ambos confirmados; los 14 nombres carecen de ID NHL certificado en el contrato. El estado DFO confirmado conserva `official_announcement_verified=false`. Sus muestras numéricas no ajustan las probabilidades. Períodos y récords por condición quedan descriptivos en esta versión para limitar el número de hipótesis.

**En las cuatro hipótesis: cero candidatos ajustados, cero juegos puntuados, cero probabilidades nuevas emitidas; accuracy, Brier, log loss, calibración e intervalos de mejora son `null`.** El reporte no reemplaza datos ausentes por ceros. Una variable con cobertura y variación es medible en el futuro; todavía no demuestra información predictiva incremental.

## 4. Método que queda ejecutable

Cada variante conserva `logit(p_DRatings)` como offset, aprende un intercepto y uno o dos coeficientes. Usa penalización ridge fija 10 en los coeficientes; el intercepto no se penaliza. Un control adicional aprende únicamente el intercepto sobre **los mismos datos**. Esto separa el efecto de recalibrar globalmente del aporte de la variable.

El ajuste requiere 40 eventos anteriores de la variante, ambas clases de resultado y variación. Solo entran jornadas PR anteriores a la decisión; todos los eventos elegibles de una jornada de entrenamiento deben tener final válido disponible antes del corte. La estandarización y la calibración se aprenden exclusivamente allí. Después se predice el siguiente evento y se liquida cuando exista un final. No hay partición aleatoria, búsqueda de combinaciones ni selección automática de ganadora.

Se mantienen versiones de resultados: una corrección posterior no altera la evidencia disponible en una decisión anterior. La disponibilidad, persistencia y comparación contra el manifest respetan microsegundos. Un registro futuro, duplicado en conflicto, con identidad incorrecta o una lectura incompleta no entra silenciosamente al análisis.

Las métricas se comparan en eventos idénticos dentro de cada variante; los comparadores Circa/Poisson/V6 usan la intersección exacta con sus eventos puntuados. Se incluyen intervalos Wilson, calibración por cinco bandas y bootstrap pareado de 2.000 réplicas con semilla fija, más sensibilidad por jornada PR. Los intervalos son exploratorios: ni la dependencia entre equipos ni la multiplicidad de las cuatro hipótesis desaparecen por remuestrear.

## 5. Contexto histórico separado

El archivo ya permite evaluar modelos anteriores sobre **24 juegos comunes entre el 19 y el 22 de noviembre, repartidos en tres jornadas**. Esos juegos carecen de inputs manuales disponibles en sus decisiones y no prueban el efecto de las nuevas variables.

| Referencia archivada | Aciertos | Accuracy | Brier | Log loss |
|---|---:|---:|---:|---:|
| DRatings original | 13/24 | 54,17% | 0,259496 | 0,716389 |
| Circa sin margen | 15/24 | 62,50% | 0,251252 | 0,698825 |
| Poisson tardío | 14/24 | 58,33% | 0,250802 | 0,696968 |
| V6 experimental | 14/24 | 58,33% | 0,247957 | 0,694140 |

El IC95% de Brier V6−DRatings es **[−0,044991; +0,023413]**; frente a Circa, **[−0,034250; +0,027877]**. Ambos incluyen cero. Las probabilidades locales medias fueron 52,03%, 52,36%, 49,74% y 44,52%, respectivamente; ganaron 45,83% de los locales. Esa cercanía global de V6 tampoco demuestra calibración estable. El JSON conserva las bandas y sus intervalos.

La cohorte más amplia del original DRatings contiene 130 finales del 4 al 22 de noviembre: 75 aciertos, accuracy 57,69%, Brier 0,243955 y log loss 0,682462. No se enfrenta ese denominador con los 24 juegos de V6 como si fueran comparables. Tampoco se calcula EV o ROI: faltan validación predictiva suficiente y certificación de las cuotas y sus contratos.

## 6. Artefactos y reproducción

- [Protocolo completo e inventario de 26 categorías](../../nhl-manual-ml-research-v1.md).
- [Informe JSON](report.json): dos anclajes, hipótesis, métricas nulas, comparadores, contexto, disponibilidad y límites.
- [Auditoría por partido CSV](manual-game-audit.csv): siete filas, valores seleccionados y relojes.
- [Inventario y comprobaciones](variable-inventory.json): campos, cobertura, unidades, fuentes y calidad.
- [Manifest de inputs](input-manifest.json): seis archivos, conteos y SHA-256.
- [Libro de exclusiones](exclusions.json): motivos por evento y anclaje; no se suman como eventos independientes.
- [Validación técnica](validation.json): pruebas, build, revisión, consistencia de datos y verificación de la API cuando esté disponible.

Los seis archivos de entrada completos se conservan en un paquete privado `nhl-manual-ml-inputs-2026-11-23.zip`. El manifest permite verificar que una reproducción usa los mismos bytes. El hash `source_snapshot_sha256` del manual identifica el dataset completo original del panel; no se recalculó sobre `feature_payload`, porque esos bytes no representan ese dataset entero.

Desde la raíz del repositorio y con los inputs extraídos en `INPUT_DIR`:

```bash
node scripts/nhl-manual-ml-research.mjs \
  --input INPUT_DIR \
  --output manual-ml-report.json \
  --exclusions-output manual-ml-exclusions.json
```

Para un nuevo corte, el CLI permite `--live --export-input NUEVO_DIRECTORIO --output NUEVO_INFORME`. Usa las credenciales de servidor ya configuradas; solo consulta las tablas existentes. No consulta proveedores ni escribe la base. `/api/nhl/manual-ml-research` expone el mismo análisis, con caché de tres minutos y corte explícito; está preparado en la rama del PR y no debe darse por disponible en producción antes de integrar y verificar.

## 7. Continuación basada en la evidencia

1. Continuar con las capturas del proceso existente y liquidaciones oficiales, sin retrofechar información ni añadir cron. La muestra útil se cuenta por eventos únicos y cortes elegibles.
2. Acreditar una futura captura primaria de standings para habilitar H1. Mantener separados los datos de semilla conservados. Para porteros harán falta identidad certificada y evidencia de titularidad anterior al partido.
3. Ejecutar el mismo evaluador con nuevos cortes. H2/H3/H4 necesitan al menos 40 antecedentes elegibles antes del primer ajuste; H4 necesita además variación. No basta esperar los siete finales actuales.
4. Revisar inicialmente 30 resultados posteriores al entrenamiento, repartidos en varias fechas, como diagnóstico de cobertura, Brier/log loss, calibración e incertidumbre. Es un hito práctico de revisión, no una prueba de superioridad ni potencia suficiente garantizada.
5. Si alguna señal es estable y de magnitud útil, fijar una hipótesis y un nuevo holdout temporal antes de mirar sus resultados. La emisión y persistencia de candidatos reales necesitará una etapa autorizada de escritor separado. No se habilita en este cambio.

La rama agrega evaluación de investigación, documentación y pruebas. Preserva los originales, picks, liquidaciones y capturas. No modifica el Site privado, su Dashboard, dominio, permisos, programación diaria, probabilidades de producción ni promoción de modelos.
