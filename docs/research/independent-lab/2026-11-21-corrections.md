# Correcciones de evidencia y evaluación NBA / NCAAB

Fecha de trabajo: 21 de noviembre de 2026, America/Puerto_Rico.
Base revisada: `c374aa7e45728f1019d7fc4edf5439b0cfe98519`.

## Estado y alcance

Esta rama corrige los defectos de entradas y evaluación encontrados en el laboratorio independiente. No demuestra una ventaja de apuestas. La integración y la comprobación de los siguientes ciclos en producción son fases distintas de esta verificación local.

No se han ejecutado proveedores deportivos, escritores de producción, backfills ni crons manuales. No se añaden tareas programadas, tablas, migraciones ni horarios. Los originales y resultados archivados permanecen intactos. NBA Decision Engine V2 y su estado SHADOW no se promocionan; `JUGADA` sigue bloqueada.

Los PR #394 y #395 tienen otro alcance: motivos de vistas NBA vacías y lectura de originales GOAT. Esta rama parte de `c374aa7e`; no pretende sustituirlos ni atribuirse su despliegue. Los cambios de las páginas maestras deben integrarse conservando las entradas de los otros PR.

## 1. NBA: entradas corregidas en una cohorte distinta

El laboratorio encontró 45 Moneyline de la cohorte anterior con una probabilidad idéntica de 88%. La inspección del código identificó una penalización global de cobertura aplicada como efecto direccional de lesiones con el signo incorrecto, una cuota contraria fija y estadísticas de equipo no transmitidas al motor compartido. Corregir esas entradas no transforma retrospectivamente los 45 pronósticos en aciertos ni autoriza asignarles nuevas probabilidades.

La salida nueva se identifica como `nba_prediction_engine_v1_1_inputs_shadow`. La constante histórica `nba_prediction_engine_v1` conserva su identidad. La fórmula V4 compartida y los registros anteriores no se modifican.

| Problema | Protección implementada |
|---|---|
| Menor cobertura podía elevar la probabilidad | Penalización global limitada a confianza y calidad; no se infiere una ventaja direccional de lesiones |
| Precio contrario supuesto | Se exigen las dos cuotas reales del mismo evento, operador, menú, período y momento |
| Menús retirados podían reaparecer | Se selecciona el último recibo completo antes de separar mercados; no se recupera una oferta antigua |
| Estadísticas efectivas ausentes | `teamStats` y `opponentStats` llegan a la fórmula; se comprueban fuente, equipo, temporada, temporalidad y tamaños de muestra |
| Defaults de cuotas/líneas | Se eliminan −110, ±1.5, total 225.5 y H1 sintetizado; sin evidencia no se emite ese mercado |
| Precio Under y signo spread | Cada lado usa su propia cuota; el margen y el hándicap se comparan con sus signos |
| Proyección confundida con H2H | No se usa un margen proyectado como si fuese un historial observado de enfrentamientos |
| Salida sin reproducción verificable | Se congelan estadísticas originales, evento, ambas cuotas, cobertura, inputs efectivos y pesos, con huellas; el writer reproduce el cálculo |
| Reintento podía actualizar un registro | La cohorte nueva conserva la primera inserción mediante `ignoreDuplicates:true` y cuenta únicamente filas nuevas |
| Cambio accidental de etiqueta | Cualquier marcador V1.1 activa el guard; no basta quitar `model_version` para eludirlo |
| Resultado previo a jugarse | La primera inserción exige estado pendiente, `profit:null`, stake/Kelly cero y flags SHADOW exactos |
| Colisión con el modelo anterior | Identidades y duplicados de V1.1 incluyen versión y línea; el legado conserva sus claves |

La ruta genérica `generateNbaPredictions({persist:true})` rechaza la escritura antes de leer la base. La versión nueva utiliza exclusivamente el writer SHADOW explícito. Sus salidas llevan `EXPLORATORY_UNVALIDATED`, `recommendedPick:false`, `is_current:false` y elegibilidad de producción falsa. H1 no vuelve a aparecer hasta tener entradas del período y contrato soportado.

Los indicadores de confianza, edge y EV de esta investigación no son probabilidades calibradas ni valor ejecutable certificado. El contrato de prórroga del usuario sigue sin confirmación. Las referencias de mercado no se convierten en recomendaciones por tener una probabilidad alta.

## 2. NBA: separar resultados de versiones y mercados

Los reportes GOAT, tarjetas, auditoría y aprendizaje exponen la versión y el mercado de cada cohorte. El reporte compatible principal se limita a `selectedModelVersion`; el selector permite consultar las demás. La portada no suma la accuracy de dos modelos que hayan observado los mismos partidos.

Para diagnósticos estadísticos se selecciona el primer contrato congelado por **versión, mercado y juego**, antes de filtrar por resultado. Un contrato posterior ganado no sustituye a uno anterior perdido, pendiente, inválido o con devolución. Los grupos pueden compartir partidos y sus tamaños no se suman como evidencia independiente.

La unidad de `prediction_history.model_probability` NBA se declara como porcentaje 0–100 y se convierte explícitamente a 0–1 para Brier/log loss. Una división retrospectiva 60/20/20 no acredita el holdout prospectivo independiente requerido por este proyecto. Los lectores no presentan como validado un candidato NBA que carezca de esa evidencia.

Los consumidores heredados de performance/health conservan un alcance explícito de V1; la nueva cohorte se consulta en el reporte GOAT por versión. Los liquidadores genéricos no deben apropiarse de V1.1: su resultado estadístico corresponde al reconciliador GOAT existente y a su evidencia de contrato.

## 3. NCAAB: reproducción completa del entrenamiento

Corte de evidencia: **21 de noviembre de 2026, 7:00 p. m. PR / 23:00 UTC**. Se reprodujo tanto el código original de la base como el core endurecido de esta rama contra los mismos archivos privados.

| Comprobación | Resultado |
|---|---:|
| Pronósticos originales leídos | 902 |
| Resultados archivados leídos | 830 |
| Resultados aceptados por el verificador temporal e identidad exactos | 790 |
| Resultados excluidos | 40 |
| Pronósticos SHADOW reproducidos | 91 |
| Coincidencias de baseline, candidato y evidencia | 91/91 |
| Coincidencias de `historicalSourceDigest` | 91/91 |
| Coincidencias de `source_hash` | 91/91 |
| Diferencias | 0 |

Los resultados de entrenamiento precedían a la emisión original. Se reprodujeron 50 pronósticos con 713 juegos previos, 2 con 723, 37 con 766 y 2 con 770. Los 40 excluidos incluyen motivos superpuestos: 16 discrepancias de orden de equipos, 26 de horario y un recibo anterior al inicio originalmente archivado.

Los 790 no son el mismo filtro que la cohorte exploratoria de 813: este verificador exige igualdad exacta del horario de original y resultado. No se corrige una identidad o un horario por inferencia para aumentar la muestra.

El digest heredado no cubría todos los campos que influyen en el entrenamiento. Las próximas congelaciones incorporan `evidenceSchemaVersion:2`, un digest de entradas completas y del original, el corte, la última etiqueta conocida y un enlace adicional verificable. Se preservan el hash heredado, las fórmulas y las 91 filas existentes. El replay completo se ejecutó como verificación separada; la API ordinaria no afirma haber reproducido todo el entrenamiento en cada lectura.

### Resultado pareado al mismo corte

| Métrica | Original | Candidato que conserva el lado |
|---|---:|---:|
| Partidos válidos con resultado | 22 | 22 |
| Ganadores correctamente clasificados | 15 | 15 |
| Brier | 0.22543 | 0.21385 |
| Log loss | 0.64037 | 0.61106 |
| MAE del margen | 15.040 puntos | 15.889 puntos |

Había 68 pendientes y un final incompatible excluido. El delta Brier es −0.01158, con intervalo descriptivo pareado por juego de **[−0.051665, +0.034371]**. El MAE del margen empeora +0.849 puntos. Solo hay dos fechas PR representadas.

El lector devuelve incertidumbre pareada por juego y por fecha PR, tamaño de muestra, equipos/días, exclusiones y corte explícito. Identifica la evaluación como `PROSPECTIVE_SEQUENTIAL`: resultados anteriores pueden entrenar predicciones posteriores. Exige al menos 100 juegos únicos y un holdout prospectivo separado antes de cualquier declaración de validación. Cumplir únicamente el umbral de 100 nunca levanta el bloqueo.

La lectura usa paginación con límite explícito; ya no corta silenciosamente a 250 congelaciones. Un archivo truncado, duplicado contradictorio, resultado tardío o original incompatible produce un estado de revisión o indisponibilidad, no métricas de cero.

## 4. NCAAB: distinguir cuotas archivadas de precio ejecutable

El archivo ESPN existente contiene referencias identificadas como DraftKings. La pantalla anterior no conectaba esa evidencia. Ahora `/ncaab` y su API de lectura pueden mostrar Moneyline, Spread y Total del último recibo de la ventana de ayer/hoy/mañana PR. No se realizan peticiones a ESPN ni a casas de apuestas para abrir la vista.

La lectura está acotada a tres fechas y dos recibos por fecha para detectar empates de captura; conserva los límites de tamaño y tiempo. La portada multideporte no descarga esos cuerpos adicionales. Se muestran:

- Operador real, ambos lados y líneas compatibles; nunca se cambia DraftKings por FanDuel.
- Hora de captura de Pick e indicación de si el recibo ya existía al emitirse el pronóstico.
- Hora propia del operador como desconocida cuando el archivo no la aporta.
- Sede neutral, no neutral o sin verificar. `home` por sí solo no confirma ventaja física de cancha.
- Identificador del recibo, ventana consultada, cobertura parcial y motivos de exclusión.

El campo de la fuente llamado `close` no acredita que sea la cuota de cierre. La vigencia de ejecución y las reglas de prórroga siguen sin certificación. `validatedProbability` y `expectedValue` permanecen `null`; `eligible`, `currentExecutable` y `contractVerified` permanecen `false`.

La protección rechaza precios nulos, pares incompletos, líneas contradictorias, identidad/horario ambiguos, recibos posteriores al inicio y datos que no pueden ordenarse con timestamps válidos. Si un mercado o evento desaparece del último recibo, no se rescata uno anterior. Un historial fuera de la ventana no se describe como inexistente en toda la base.

La pantalla explica que el modelo de pretemporada usa historial congelado y no incorpora lesiones, quintetos ni forma reciente del día. La información nueva no altera la predicción original.

## 5. Verificación y límites de la entrega

Las pruebas incluyen escenarios adversariales de identidad, tiempo, precio, duplicados, reintentos y aislamiento de modelos; se conservan regresiones NBA Decision V1/V2 y de otros deportes. Los detalles del árbol final y comandos quedan en `verification.json`. Los tests de navegador NCAAB usan componentes de producción renderizados con una fixture sintética y el CSS compilado; comprueban lectura, accesibilidad del disclosure y ausencia de desbordamiento en escritorio y móvil. No equivalen a un acceso autenticado contra producción ni a una prueba de los filtros hidratados del panel.

La comprobación autenticada de la previsualización detectó además un fallo real en el transporte de datos de Next: la API respondía 200, pero `/ncaab` devolvía 500 porque el mapa de evidencia usaba un prototipo nulo. Se corrigió a un objeto plano, conservando la validación estricta de las claves `espn:<dígitos>`. La regresión comprueba el prototipo de las props antes de serializarlas, la conservación exacta del DTO y el rechazo de claves especiales. El control de entrega incluye volver a consultar la página real; una prueba SSR aislada no cubre esa frontera servidor/cliente.

Las consultas y replays de producción fueron de solo lectura. Los datos privados completos no se publican en Git; `verification.json` incluye conteos y huellas de los archivos de análisis. Para repetirlos deben conservarse los timestamps ISO de `to_jsonb`, tal como los devuelve PostgREST: cambiar su representación textual puede dar un desacuerdo de hash falso.

Pendientes que requieren evidencia futura o una decisión separada:

1. Revisión/integración de esta rama y comprobación de respuestas reales y primeros ciclos existentes después del despliegue.
2. Incorporar los arreglos independientes de #394/#395 conservando documentación y contratos.
3. Resolver los casos de datos en disputa con originales suficientes; no reescribir pronósticos para acomodar un resultado.
4. Confirmar reglas y precio ejecutable del contrato antes de recomendar apuestas.
5. Acumular juegos independientes, fijar y observar el holdout prospectivo separado, evaluar calibración y EV con precio trazable. Ninguna corrección de código sustituye estos requisitos.

### Reversión

Revertir el código de esta rama no requiere borrar filas. Si ya se han creado registros V1.1, conservarlos y mantener los lectores separados por versión. Nunca renombrarlos como V1 ni borrar sus resultados para recuperar estadísticas anteriores. Una reversión de código/operación debe realizarse como cambio revisado; no se ha ejecutado en esta entrega.
