# Primera integración de V2 en producción

El servicio V1 completa su operación habitual y entrega su resultado original. El adaptador V2 toma el mismo tablero de congelación. Sin configuración, el modo efectivo es `off`. Las rutas y horarios de cron conservan sus controles anteriores.

El operador instala `storage-proposal.sql` y `observe-only.sql` en una sola transacción. El segundo archivo retira los permisos de escritura del rol de aplicación sobre V2, incluidas las secuencias y las dos funciones que persisten datos. El dueño importa los dos lotes y sus liquidaciones desde `seed-proposal.mjs`. Deben coincidir los seis SHA-256 de origen y todos los objetos JSON almacenados, identificadores y precios asociados. El esquema V2 es privado.

## Observación de ambos procesos

El operador verifica que el hostname único del despliegue de producción tiene Vercel Deployment Protection, abre en la tabla privada `observation_window` un permiso de hasta diez minutos para ese hostname y SHA, y realiza una sola lectura autenticada de `/api/operations/nba-v2-observe`. El dominio público, la preview y una ventana vencida o cerrada quedan excluidos. El rol del servidor solo puede consultar el permiso. El operador cierra la ventana al recibir la respuesta, incluidos los casos de error.

La prueba usa el reloj real y las funciones de planificación de congelación y liquidación. El tablero se carga una sola vez. Un cliente exclusivo restringe la red a consultas de archivos y funciones de lectura del propio Supabase. El resultado mide tiempos, CPU y bytes de respuesta decodificados e identifica exclusiones, duplicados y resultados pendientes. Los bytes de respuesta son una medida de la carga de trabajo. La factura del proveedor tiene sus propias unidades. La prueba no invoca el escritor V1 ni el V2. La próxima ejecución natural de cada cron se distingue de esta observación manual.

Al cerrar, verificar que los 40 pronósticos, las 15 liquidaciones y ambos hashes de las cohortes V1 al corte sean idénticos a los anteriores, y que el endpoint responda 404. La autorización de noviembre 21 termina en esta observación. Habilitar escrituras del rol de servicio o configurar `shadow` requiere una autorización posterior.
