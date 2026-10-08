# Proposal

## Why

La aplicacion necesita definir su primera experiencia util: publicar y explorar propiedades de forma simple, visual y confiable. El objetivo es que una persona pueda cargar una propiedad con fotos, precio, descripcion y ubicacion exacta, y que otros usuarios puedan entender rapidamente la oferta desde una interfaz moderna y minimalista.

## What Changes

- Crear una experiencia publica para explorar propiedades con fotos, descripcion breve, precio y ubicacion en Google Maps.
- Permitir que usuarios autenticados con Google publiquen propiedades.
- Permitir que el autor de una propiedad edite, elimine y guarde cambios de sus publicaciones.
- Guardar la informacion de propiedades, fotos, ubicacion y autoria en PocketBase.
- Definir una base visual moderna, minimalista y facil de entender para pantallas de listado, detalle y formulario.

## Capabilities

### New Capabilities

- `property-listings`: Cubre la publicacion, visualizacion, edicion, eliminacion y persistencia de propiedades inmobiliarias.
- `google-auth`: Cubre el inicio de sesion con Google requerido para publicar y administrar propiedades propias.
- `property-map-discovery`: Cubre la visualizacion de ubicaciones exactas de propiedades mediante Google Maps.

### Modified Capabilities

- Ninguna.

## Impact

- Afecta la app Next.js actual, que hoy conserva la pantalla base de `create-next-app`.
- Introduce integracion con PocketBase para datos, autenticacion y almacenamiento de imagenes.
- Introduce integracion con Google OAuth para login rapido.
- Introduce integracion con Google Maps para mostrar ubicaciones exactas.
- Requiere variables de entorno para PocketBase y Google Maps/OAuth, sin versionar secretos.
