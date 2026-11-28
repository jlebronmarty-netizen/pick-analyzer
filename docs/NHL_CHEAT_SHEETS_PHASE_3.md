# NHL Cheat Sheets · revisión contractual y de lanzamiento

27 de noviembre de 2026, Puerto Rico. Rama del PR #414, base e8c634ca. Entrega para revisión. El alcance operativo autorizado llega hasta Preview y pruebas locales. Ninguna selección histórica de las pruebas se inscribe como resultado prospectivo.

## Qué puede publicarse

La interfaz descriptiva reutiliza las tarjetas, estilos y barras NBA. La ruta privada de Preview sigue accesible. La interfaz y el tracker tienen interruptores independientes. La lista de versiones contractuales certificadas está vacía. Activar por error el interruptor del tracker en ese estado produce NO_CERTIFIED_CONTRACTS, con cero lecturas de cuotas y cero escrituras del tracker.

## Contratos auditados

El archivo research/nhl-sheet-tracker/contract-audit.sql permite consultar evento, casa, línea, lado, cuota, captura, persistencia, inicio y campos de reglas por observación. Un campo nulo conserva su significado. Al corte 27-nov 19:00 PR devolvió 948 observaciones de lado y precio por mercado principal, de 15 partidos en cada mercado, todas de Circa. Son precios repetidos en el tiempo. En ninguno se acreditó jurisdicción. Los recibos de puck line y totales incluyen la marca de contrato de partido completo sin certificar.

| Fuente y ejemplo de recibo | Datos comprobados | Evidencia pendiente para liquidar |
|---|---|---|
| Circa reportada, TOR–BOS, nhl:2026020400, 26-nov 21:07:18.825 UTC | Moneyline TOR +135, BOS −150 | Ticket de jurisdicción y etiqueta del mercado, dos o tres vías, alcance REG/OT/SO, empate y anulaciones. |
| Circa reportada, VAN–PHI, nhl:2026020405, 27-nov 10:07:18.360 UTC | VAN +1.5 a −125, PHI −1.5 a +105 | Reglas vigentes de esa oferta, inclusión de OT y gol administrativo de SO, y anulaciones. |
| Mismo evento y captura | Más de 6.5 a +102, menos de 6.5 a −122 | Jurisdicción, período, OT/SO y anulaciones; para líneas enteras hace falta además la cláusula de push. |
| FanDuel Puerto Rico | El operador y la Comisión de Juegos documentan actividad o licencia local. | Falta un recibo NHL pareado con una versión oficial aplicable de sus reglas de Puerto Rico. No importar las de otro estado. |
| Períodos, totales de equipo y props de jugador/portero | Evidencia estadística descriptiva donde hay archivo | Faltan línea, cuota, ámbito, participación mínima y tratamiento de partido incompleto/anulado para cada oferta. |

Circa Nevada publica que GAME/GM incluye el desempate aplicable. En hockey acredita el gol de desempate al ganador y describe el mínimo de juego, el plazo para jugar y las excepciones específicas de la oferta. El archivo de precios no conserva la prueba de que la oferta se regía por ese texto. Las reglas actuales no sustituyen las condiciones vigentes en la fecha del ticket. Referencias: [Circa Nevada](https://www.circasports.com/house-rules), [FanDuel Puerto Rico](https://www.fanduel.com/about/news/fanduel-brings-america-s-1-sportsbook-to-puerto-rico), [licencias de PR](https://docs.pr.gov/files/ComJuegos/Licencias/Apuestas%20Deportivas/Listado%20Licencias%20%20Empresas%20-%20Proveedor%20de%20Plataforma%20-%20Apuestas%20Deportivas-1.pdf).

## Verificación final

final.mjs y settlement.mjs leen una fila única de nhl_game_context_v2. Exigen identidad del juego y de ambos equipos, inicio, procedencia aceptada, box y PBP finales, capturas posteriores al inicio y versión disponible al momento de la consulta. Se comprueban los cierres de los períodos reglamentarios, los IDs de jugada, los goles incrementales, el periodo terminal, el marcador y el ganador de SO. Se distingue P1/P2/P3, REG, OT jugada, goles realmente marcados y marcador oficial. Un SO no añade gol individual.

Para cada jugador el verificador exige identidad única y minutos positivos válidos. Concilia goles, asistencias, tiros y atajadas con el total individual del box. Cada componente conciliado conserva su desglose por período. Las atajadas exigen también SA = GA + SV y tiros rivales conciliados. El tiempo en hielo acredita participación en el partido. Un cero en la estadística de un período no demuestra participación en ese período. Una omisión, un suplente con 00:00 o minutos inválidos quedan sin dictamen de participación. Los props individuales siguen descriptivos. Las suspensiones, anulaciones y DNP requieren evidencia administrativa individualizada antes de escribir un resultado.

| Juego archivado | REG local–visitante | Oficial | Goles realmente anotados |
|---|---|---|---|
| nhl:2026020236, REG | 2–3 | 2–3 | 2–3 |
| nhl:2026020237, OT | 4–4 | 4–5 | 4–5 |
| nhl:2026020239, SO | 3–3 | 4–3 | 3–3 |
| nhl:2026020349, REG | 3–1 | 3–1 | 3–1 |

## Comparación y contabilidad

La migración propuesta 202611270901_nhl_sheet_tracker_review.sql crea únicamente el esquema privado nhl_sheet_v1. receipts conserva fuente, estrategia, posición, condiciones evaluadas, precio y corte. La identidad del nombre de estrategia debe incorporar versión, universo del ranking y ventana. La primera inscripción prevalece en cada estrategia y banda. Una posición puede corresponder a varios contratos durante una jornada.

La comparación considera ambos lados. Se exige igualdad de evento, equipos, inicio, casa, jurisdicción, versión contractual, etiqueta, mercado, período y línea económica. Para lados opuestos de puck line se invierte el signo del hándicap. Cada estrategia de Pick se compara por separado con su primera inscripción compatible ya congelada al corte de la tarjeta. Empates ambiguos de identidad y originales que llegan después se excluyen. Se conserva el precio de cada lado. Cada recibo se liquida independientemente. Una pareja entra en la muestra cuando ambos tienen victoria o derrota.

Las vistas outcomes, pairs, cohorts, performance y paired_performance son security_invoker. Posiciones 1–10 y Tops inclusivos 1/3/5/7/10 usan jornada del inicio en Puerto Rico, semana desde lunes, mes y acumulado. Las dimensiones son mercado, período, lado, cuota y número de condiciones evaluadas. grouping_mask=0 selecciona el detalle completo y 31 el total de la estrategia. Nunca sumar distintos masks, Tops solapados ni metodologías. Accuracy = aciertos / decisiones. ROI = beneficio neto / unidades liquidadas con una unidad por recibo. Push devuelve la unidad; pendiente, void y DNP quedan fuera de stake y decisiones. Cuando no hay decisiones o stake, accuracy o ROI quedan nulos.

## Seguridad y ejecución aislada

Supabase de producción reportó PostgreSQL 17.6. Los privilegios predeterminados de public incluyen concesiones de tabla, secuencia o ejecución a roles de plataforma según el propietario, incluida la capacidad MAINTAIN. Se reproduce una configuración amplia en PostgreSQL aislado. La migración revoca concesiones en su esquema y verifica permisos efectivos de tabla y columna, SELECT sin grant option, RLS y vistas invoker. Las pruebas inyectan un INSERT heredado y un UPDATE de columna heredado y exigen rechazo. El reloj del servidor sustituye el proporcionado por el cliente. La clave única controla reintentos. Los triggers bloquean UPDATE, DELETE y TRUNCATE.

El flujo aislado congela recibos y usa el archivo final para producir liquidaciones con referencia de evidencia. El primer intento sin acta válida queda pendiente. El siguiente puede liquidarlo. El control nhl-research-audit de GitHub ahora ejecuta tests/nhl-sheet-v1.postgres.mjs en PostgreSQL 17 y las regresiones NHL. research/nhl-sheet-tracker/lab.sql sigue como prototipo histórico; el objeto de revisión para un lanzamiento es la nueva migración.

## Cobertura e independencia

- En nhl_game_context_v2 hay 171 finales de temporada regular observados desde el 3 de noviembre. La consulta de partidos regulares anteriores al 3 devolvió cero filas. Para el corte histórico de la fase 2 siguen faltando dos partidos a BOS/SEA y uno a COL/DET/LAK/NYR/WSH. Un final posterior no repara un L10 prepartido anterior.
- Pick puede operar por sí mismo para calendario con secuencia aceptada, boxes, H2H disponible de temporada regular, períodos conciliados, tiros/ataques observados, descanso, PP/PK y candidatos ESPN a portero. Entre 66 eventos con recibo ESPN prepartido consultado, ninguno contenía confirmación expresa. El Site aporta una confirmación de portero el 23. El portero que jugó no acredita un anuncio previo.
- La clasificación completa por sede/división/conferencia y los partes parciales de lesiones siguen dependiendo de V13 para los cruces acreditados. La alineación completa continúa pendiente. El archivo de H2H cubre la temporada disponible; la muestra se muestra por separado.
- Paridad de los más recientes cortes manuales prepartido del 23/24/25 y boxes de los mismos IDs disponibles al mismo corte: 14/2/6 series candidatas respectivamente, 2/1/3 series completas. Goles a favor/en contra coinciden en las seis. Medias de tiros a favor/en contra coinciden en cinco de seis. La excepción es EDM el 24: V13 23.0/27.0 y box 23.1/26.9. Incluye nhl:2026020349. Para ese partido Edmonton tiene 24 tiros en box y PBP, Tampa Bay 19 en box y 20 en PBP. El dato de Tampa y las atajadas dependientes permanecen excluidos.

## Activación y reversión

1. Revisar PR, pruebas, protección de Vercel y Preview. Tras una autorización independiente, la UI privada puede habilitarse con NHL_CHEAT_SHEETS_ENABLED=true en el despliegue protegido, sujeto también a la protección privada compartida con NBA. Comprobar acceso autorizado, denegación anónima y hostname canónico. La publicación descriptiva no necesita migración.
2. Para revertir la UI, apagar sólo su flag y desplegar la revisión aprobada. El Site y el seguimiento NBA continúan por separado.
3. Antes de activar almacenamiento, acreditar cada casa, jurisdicción, etiqueta original y vigencia de sus reglas; contrastar ticket y reglas para suspensión, empate, OT y SO. Aprobar dichas versiones, preparar la conexión limitada del escritor y el lector de entradas prospectivas con recibos equivalentes de Pick. Esta rama no instala credenciales ni concede escritura a service_role. La migración, si se autoriza, debe ejecutarse en una transacción con parada ante el primer error. Verificar el catálogo y ACL desde las identidades reales después de aplicarla.
4. El gancho preparado en el cron NHL existente corre después del archivo. Con flag apagado retorna DISABLED. Con catálogo vacío retorna NO_CERTIFIED_CONTRACTS. Incluso con catálogo aprobado debe existir una conexión de escritor revisada y un lector de entradas certificadas: sin ellos retorna WRITER_NOT_CONFIGURED. El laboratorio proporciona el adaptador de PostgreSQL y el lector archivado. Vincular la identidad de ejecución a ambos y auditar una captura natural antes de considerar el tracker operativo.
5. Solamente tras autorización habilitar NHL_CHEAT_TRACKER_ENABLED, observar dos ciclos naturales, cotejar primera captura y primera liquidación real y recalcular contabilidad desde los recibos. Ante discrepancia, apagar el escritor y conservar el esquema, recibos y evidencia. Investigar antes de reintentar. No reconstruir posiciones ni borrar tablas como reversión.

El seguimiento horario NBA continúa en su automatización independiente. Las pruebas del tracker NHL descritas aquí no representan rendimiento prospectivo real.

### Recuperación del historial anterior al 3 de noviembre

El archivo de transición V13 sí contiene resúmenes anteriores. Encontré tres para Boston, cuatro para Seattle, dos para Colorado, Detroit, Washington y NY Rangers, y tres para Los Ángeles. Para la secuencia corta del 27, los candidatos más recientes que cubrirían el déficit son BOS 2026020232 y 2026020217, SEA 2026020216 y 2026020202, COL 2026020234, DET 2026020233, WSH 2026020228, NYR 2026020230 y LAK 2026020221. La consulta directa de esos nueve IDs devolvió cero filas en nhl_game_context_v2. Las nueve referencias V13 indican un resumen oficial consultado el 23 y tienen captured_at nulo. Sirven para localizar las actas; falta una copia archivada conciliable y la secuencia del calendario para incorporarlas al L10 nativo. Ninguna se usó para reconstruir una inscripción.

Validación local: build Next completo, 206 pruebas de NHL y regresión NBA, pruebas PostgreSQL del nuevo ledger y de regresión de contabilidad y ACL NBA. Chromium a 390 y 1440 px sobre el archivo reproducido de MIN–SJS permitió comprobar barras, filtros, expansión, hidratación y acceso privado.
