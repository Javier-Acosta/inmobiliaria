# Design

## Context

La app actual es un proyecto Next.js 16 con App Router y una pantalla inicial generada por `create-next-app`. OpenSpec ya registra que la aplicacion debe usar PocketBase como base de datos por defecto y que los artefactos se escriben en espanol. Ver `proposal.md` para motivacion y alcance funcional.

## Goals / Non-Goals

**Goals:**

- Definir una arquitectura simple para listar, crear, editar y eliminar propiedades.
- Usar PocketBase para usuarios, propiedades, imagenes y reglas de acceso.
- Usar Google OAuth como mecanismo de login.
- Usar Google Maps para mostrar ubicaciones exactas.
- Mantener una interfaz moderna, minimalista y facil de entender.

**Non-Goals:**

- No definir pagos, reservas, mensajeria entre usuarios ni administracion avanzada.
- No definir filtros complejos, tasaciones automaticas ni CRM inmobiliario.
- No implementar en esta change; este documento solo prepara el trabajo.

## Decisions

### PocketBase como backend principal

Usar PocketBase para persistencia, autenticacion y archivos reduce complejidad inicial. La coleccion principal propuesta es `properties`:

- `title` o nombre corto de la propiedad.
- `description` para descripcion breve.
- `price` como numero decimal o entero segun moneda elegida.
- `currency`, inicialmente configurable con un valor por defecto.
- `photos` como campo de archivos multiple.
- `locationLabel` para direccion o zona legible.
- `latitude` y `longitude` para Google Maps.
- `author` como relacion con el usuario autenticado.
- `status` con al menos `published` y posible `draft` futuro.

Alternativa considerada: crear API propia con base SQL desde el inicio. Se descarta por ahora porque la prioridad es velocidad y simplicidad.

### Google OAuth gestionado desde PocketBase

Configurar Google como proveedor OAuth de PocketBase para mantener una sola fuente de identidad y reglas de acceso. La app Next.js consumira el SDK o endpoints de PocketBase para iniciar sesion, leer el usuario actual y proteger operaciones.

Alternativa considerada: implementar NextAuth/Auth.js separado de PocketBase. Se pospone para evitar duplicar identidad y sincronizacion de usuarios.

### Reglas de acceso por autoria

Las publicaciones deben ser publicas para lectura cuando esten publicadas. Crear, editar y eliminar requiere sesion. Editar y eliminar solo debe permitirse si `author` coincide con el usuario autenticado.

Alternativa considerada: validar solo en UI. Se descarta porque las reglas deben vivir tambien en PocketBase para proteger el backend.

### Google Maps con coordenadas guardadas

La propiedad guardara coordenadas exactas. El detalle mostrara un mapa centrado en esas coordenadas. Si el mapa falla, la pantalla conserva fotos, precio, descripcion y ubicacion textual para no bloquear la comprension.

Alternativa considerada: guardar solo direccion textual y geocodificar siempre al renderizar. Se descarta porque agrega dependencia en tiempo de lectura y puede cambiar resultados.

### UI simple y minimalista

La primera experiencia debe priorizar tres pantallas: listado publico, detalle de propiedad y formulario de publicacion/edicion. Los controles deben ser evidentes: login con Google, subir fotos, precio, descripcion, seleccionar ubicacion, guardar, editar y eliminar.

Alternativa considerada: dashboard completo desde el inicio. Se descarta para mantener el producto inicial entendible.

## Risks / Trade-offs

- Dependencia de claves Google Maps/OAuth -> usar variables de entorno y documentar configuracion local.
- Fotos grandes pueden afectar performance -> validar tipo/tamano y generar presentacion responsive.
- Ubicacion exacta puede exponer datos sensibles -> mostrar la ubicacion porque es requisito, pero dejar claro al publicar que sera visible.
- Reglas de PocketBase mal configuradas pueden permitir ediciones indebidas -> definir reglas de coleccion como parte de la implementacion y probar autor/no autor.
- El SDK de PocketBase en Next.js puede requerir separar cliente/servidor -> encapsular acceso a PocketBase en modulos claros y evitar secretos en el cliente.

## Migration Plan

1. Configurar variables de entorno locales para PocketBase, Google OAuth y Google Maps.
2. Crear colecciones y reglas iniciales en PocketBase.
3. Implementar autenticacion Google.
4. Implementar lectura publica de propiedades.
5. Implementar formulario de crear/editar con fotos y ubicacion.
6. Implementar acciones de eliminar y validaciones de autoria.
7. Reemplazar la pantalla base de Next.js por la experiencia inmobiliaria.

Rollback: revertir la implementacion de la change y conservar las colecciones PocketBase sin exponerlas en la UI si fuera necesario.

## Open Questions

- Moneda por defecto: asumir ARS inicialmente salvo que Javier indique otra.
- Nivel de precision de direccion textual: puede resolverse al implementar el formulario.
