# Componentes reutilizables de Cheat Sheets

## Reanudación controlada · cuarta migración

La migración 202611260903_nba_sheet_view_acl limita los permisos a las cuatro vistas identificadas. El control exige SELECT sin delegación para service_role, ausencia de permisos efectivos por tabla y columna para anon y authenticated, y security_invoker. La prueba reproduce los privilegios predeterminados de producción y comprueba un permiso heredado mediante membresía; ejecutar este control en cada futuro tracker deportivo. Continuar con la lectura de catálogo antes de fusionar y activar. Los estados siguientes describen el corte anterior a esta corrección.


## Publicación controlada · estado de producción

Las tres migraciones están aplicadas. El escritor continúa apagado y la fusión está detenida por permisos adicionales sobre cuatro vistas. [Evidencia, procedimiento de reanudación y requisitos para NHL](NBA_CHEAT_PRODUCTION_ACL_REVIEW.md).


## Integridad de liquidación · revisión del PR #408

Para reutilizar el tracker, cada adaptador deportivo debe devolver estadísticas normalizadas y exponer sus criterios de conciliación. Un componente rechazado invalida todos los mercados que lo requieren.


## Tracker prospectivo · revisión de lanzamiento de NBA

El contrato de reporting separa inscripción, liquidación y agregación. Cada deporte debe validar participación, período, cuota y liquidación antes de reutilizar la presentación. NHL queda en preparación. [Auditoría, fórmulas, pruebas y procedimiento de activación](NBA_CHEAT_LAUNCH_REVIEW_20261125.md).


## NBA · Revisión posterior a 747b1b66 · 25-nov-2026

El nuevo consumidor NBA usa SheetCard, TrendBars y los estilos compartidos. Los cálculos por período, reglas regionales y cruces SHADOW siguen en el dominio NBA. [Informe de implementación, pruebas y pendientes](NBA_CHEAT_REVIEW_20261125.md).


NBA es el único consumidor implementado. El punto de extensión es la presentación de un contrato deportivo ya resuelto por Pick.

| Capa | Responsabilidad actual | Contrato para otro consumidor |
|---|---|---|
| `src/components/cheat-sheets/presentation.jsx` | `SheetCard` renderiza el mismo article. `FilterGroup` conserva fieldset/legend, etiquetas, orden, botones y aria-pressed. `TrendBars` dibuja los valores y colores en el orden recibido. | Pasar children, opciones etiquetadas con valor seleccionado y callback, o barras `{id,value,hit,title,label}` con escala positiva. Los valores deben ser finitos y no negativos. El productor define elegibilidad, orden cronológico y significado de acierto. |
| `src/components/cheat-sheets/sheet.module.css` | Fuente única de colores, tamaños, grid, barras, tipografía, foco, tarjetas y panel expandible. Traslado íntegro desde la ruta NBA. | Reutilizar las mismas clases y jerarquía visual. Mantener controles de 44 px, gráfico legible y tarjetas sin desbordamiento. |
| `src/app/nba-cheat-sheets/page.jsx` y `sheet.jsx` | El servidor lee el Decision Board con las opciones de display. La hoja compone encabezado, metodología, filtros, tarjetas y ventanas NBA. | El siguiente deporte necesita su propia composición y contrato respaldado por su servicio canónico. Compartir un selector o una tarjeta no implica compartir reglas de mercado. |
| `rival.jsx` y `/api/nba/cheat-rival` | Carga al expandir, comparación posicional, H2H de equipo y defensa observada. | Generalizar otro panel sólo cuando un segundo consumidor tenga semántica comparable. La posición y las métricas actuales siguen siendo NBA. |
| `src/lib/nba/` y `src/services/` | Validan historial y cotizaciones, producen muestras, rankings y captura. | Un adaptador convierte la salida existente del deporte en props de presentación. Cualquier nueva adquisición, cron, motor o tabla requiere justificar un dato ausente y una responsabilidad propia. |

## Cómo añadir una función recuperada del Site

1. Elegir la fila del inventario y un caso reproducible con el mismo corte. Identificar la función de Pick que ya provee el dato o cálculo.
2. Ampliar su resultado de forma aditiva si falta evidencia. Preservar el valor, unidad, identidad, n, fecha de captura y motivo de exclusión por período. Usar el directorio de referencia como control independiente en pruebas.
3. Derivar la visualización de esa respuesta en la composición NBA. Un dato costoso de detalle se lee al abrir la tarjeta. Evitar precargar un historial por cada combinación de mercado y cuota.
4. Conectar al runtime una sola implementación del cálculo. Si incorpora funciones recuperadas, conservar pruebas de equivalencia y un enlace a la revisión congelada. No reutilizar la capa Worker, su autenticación ni su pipeline de publicación para servir tarjetas.
5. Comparar las frecuencias, el orden y los IDs de contrato antes y después. Verificar teclado, foco visible, apertura/cierre en móvil y escritorio y estado sin evidencia.

El próximo deporte se decide después de la aceptación de NBA. Las diferencias de períodos, estadísticas, posiciones y reglas de liquidación se resuelven en cada dominio. La UI compartida carece de tablas, credenciales y dependencias de proveedores.
