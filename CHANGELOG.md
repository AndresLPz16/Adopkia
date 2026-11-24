# Changelog

Cambios notables de Adopkia. El formato de versión sigue
[Semantic Versioning](https://semver.org/).

## [v1.0.0] - 2026-11-24

Primera versión formal etiquetada del proyecto. No existía un tag anterior; se
establece `v1.0.0` como línea base. Los cambios incluidos son correcciones
compatibles, sin cambios incompatibles de API.

### Corregido

- **#33 — Orden de preguntas:** se normalizan posiciones activas duplicadas
  durante la migración y la base de datos impide que se repitan; las preguntas
  archivadas pueden reutilizar una posición.
- **#34 — Menú móvil:** el panel de notificaciones se mantiene dentro del
  viewport en pantallas estrechas.
- **#35 — Tarjetas de refugios:** las acciones se agrupan en un pie consistente
  en lugar de quedar a distintas alturas según el contenido.
- **#36 — Vacunas:** el catálogo se carga en la sección de adopciones y aparece
  como opción al programar un recordatorio de vacuna.
- **#37 — Detalle de solicitudes:** el modal usa un único contenedor de
  desplazamiento para mostrar los datos y las respuestas completas.

### Verificación

- Pruebas, tipado y build del frontend mediante CI.
- Pruebas backend y migración contra MySQL 8 mediante CI.
