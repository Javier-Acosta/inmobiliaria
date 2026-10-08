# Tasks

## 1. Configuracion base

- [x] 1.1 Definir variables de entorno necesarias para PocketBase, Google OAuth y Google Maps, y verificar que `.env.local` quede documentado sin secretos versionados.
- [x] 1.2 Instalar dependencias necesarias para PocketBase y mapas si no existen, y verificar con `npm install` o el comando equivalente del proyecto.
- [x] 1.3 Actualizar metadatos base de la app para inmobiliaria y verificar que `npm run lint` no reporte errores por esos cambios.

## 2. Modelo y seguridad en PocketBase

- [x] 2.1 Crear o documentar la coleccion `properties` con campos de fotos, descripcion, precio, moneda, ubicacion textual, latitud, longitud, autor y estado, y verificar que el esquema pueda reproducirse localmente.
- [ ] 2.2 Configurar Google OAuth en PocketBase y verificar que un usuario pueda iniciar sesion con una cuenta Google.
- [x] 2.3 Definir reglas de acceso para lectura publica de propiedades publicadas y escritura solo del autor autenticado, y verificar create/edit/delete con usuario autor y usuario no autor.

## 3. Autenticacion Google en la app

- [x] 3.1 Implementar cliente o helper de PocketBase para la app Next.js y verificar que no exponga secretos en el cliente.
- [ ] 3.2 Implementar login/logout con Google y visualizacion de sesion actual, y verificar el flujo completo en navegador.
- [x] 3.3 Proteger las acciones de publicar, editar y eliminar para usuarios autenticados, y verificar que usuarios anonimos sean enviados a login.

## 4. Publicacion y administracion de propiedades

- [x] 4.1 Implementar formulario minimalista para crear propiedades con fotos, descripcion, precio y ubicacion, y verificar que una propiedad valida se guarde en PocketBase.
- [x] 4.2 Implementar edicion de propiedades propias, y verificar que los cambios de fotos, descripcion, precio y ubicacion se persistan.
- [x] 4.3 Implementar eliminacion de propiedades propias con confirmacion, y verificar que la propiedad deje de aparecer en listados publicos.
- [x] 4.4 Mostrar errores de validacion de forma clara y verificar que el formulario no permita guardar datos incompletos esenciales.
- [x] 4.5 Ampliar el estado de propiedades para soportar `sold`, y verificar que PocketBase acepte el nuevo valor.
- [x] 4.6 Implementar vista de vendedor con solo propiedades propias, y verificar que no muestre publicaciones de otros vendedores.
- [x] 4.7 Agregar accion de marcar como vendido para propiedades propias, y verificar que otro vendedor no pueda marcar publicaciones ajenas.
- [x] 4.8 Mostrar franja roja `VENDIDO` sobre imagenes de propiedades vendidas, y verificar que aparezca en listado y detalle.

## 5. Exploracion publica y mapa

- [x] 5.1 Reemplazar la pantalla inicial por un listado publico moderno y minimalista de propiedades, y verificar que muestre foto, precio, descripcion breve y ubicacion.
- [x] 5.2 Implementar detalle de propiedad con galeria simple, precio, descripcion y Google Map centrado en coordenadas guardadas, y verificar con una propiedad de prueba.
- [x] 5.3 Implementar fallback cuando Google Maps no cargue, y verificar que la informacion principal siga visible.

## 6. Verificacion integrada

- [x] 6.1 Ejecutar `npm run lint` y corregir errores relacionados con la implementacion.
- [x] 6.2 Ejecutar `npm run build` y verificar que la app compile correctamente.
- [ ] 6.3 Recorrer manualmente el flujo completo: login con Google, crear propiedad, verla en listado, abrir mapa, editar, guardar cambios y eliminar.

## Workflow follow-up

- Revisar la change con Javier antes de aplicar implementacion.
- Archivar la change cuando la implementacion este completa y validada.
