# PocketBase

Esta app usa PocketBase como base de datos, autenticacion y almacenamiento de fotos.

## Variables locales

Copiar `.env.example` a `.env.local` y completar los valores reales:

```env
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_DEFAULT_CURRENCY=USD
POCKETBASE_SUPERUSER_EMAIL=
POCKETBASE_SUPERUSER_PASSWORD=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`.env.local` no debe versionarse.

## Coleccion `properties`

Crear una coleccion base llamada `properties` con estos campos:

| Campo | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `title` | text | si | Nombre corto de la propiedad. |
| `description` | editor o text | si | Descripcion breve visible en listado y detalle. |
| `propertyType` | select | no | Valores recomendados: `Casa`, `Departamento`, `Terreno`, `Local`, `Quinta`, `Duplex`. |
| `contactPhone` | text | no | Telefono o WhatsApp visible para consultas. |
| `price` | number | si | Precio publicado. |
| `currency` | select | si | Valor inicial recomendado: `USD`. |
| `photos` | file | si | Multiple, solo imagenes. |
| `locationLabel` | text | si | Direccion, barrio o zona legible. |
| `latitude` | number | si | Coordenada para Google Maps. |
| `longitude` | number | si | Coordenada para Google Maps. |
| `author` | relation | si | Relacion a `_pb_users_auth_`. |
| `status` | select | si | Valores iniciales: `published`, `draft`, `sold`. |

## Reglas recomendadas

Lectura publica solo de propiedades publicadas:

```txt
status = "published" || status = "sold"
```

Creacion solo con usuario autenticado y autoria propia:

```txt
@request.auth.id != "" && author = @request.auth.id
```

Actualizacion solo del autor:

```txt
@request.auth.id != "" && author = @request.auth.id
```

Eliminacion solo del autor:

```txt
@request.auth.id != "" && author = @request.auth.id
```

## Google OAuth

En PocketBase, configurar Google como proveedor OAuth con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. La app Next.js inicia el login contra PocketBase para que PocketBase conserve la identidad y aplique reglas de autoria.

Redirect URI para Google Cloud:

```txt
https://inmobiliaria-pocketbase-95d45a-187-77-225-53.sslip.io/api/oauth2-redirect
```

Cuando tengas `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, podes cargarlos en `.env.local` y ejecutar:

```bash
node scripts/configure-pocketbase.mjs
```

El script habilita OAuth2 en la coleccion `users` y registra el provider `google` en PocketBase.

## Verificacion manual

1. Iniciar PocketBase.
2. Confirmar que `NEXT_PUBLIC_POCKETBASE_URL` apunta al servidor.
3. Crear la coleccion `properties` con los campos anteriores.
4. Configurar Google OAuth en PocketBase.
5. Crear una propiedad con un usuario autenticado.
6. Confirmar que otro usuario no puede editar ni eliminar esa propiedad.
