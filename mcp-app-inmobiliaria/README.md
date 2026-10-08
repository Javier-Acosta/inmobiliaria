# mcp-app-inmobiliaria

MCP local de Codex para el proyecto Inmobiliaria.

## Herramientas

- `inmobiliaria_context`: contexto general del proyecto.
- `inmobiliaria_openspec`: lectura de artefactos OpenSpec iniciales.
- `inmobiliaria_env_keys`: variables de entorno esperadas, sin valores.
- `inmobiliaria_pocketbase_health`: health check de PocketBase.
- `inmobiliaria_list_collections`: lista colecciones de PocketBase.
- `inmobiliaria_get_collection`: obtiene una coleccion por nombre o id.
- `inmobiliaria_list_records`: lista registros de una coleccion.
- `inmobiliaria_get_record`: obtiene un registro por coleccion e id.
- `inmobiliaria_raw_get`: GET de solo lectura contra rutas `/api/` de PocketBase.

## Variables locales

El servidor usa `.env.local`, que esta ignorado por Git:

```env
POCKETBASE_URL=
POCKETBASE_SUPERUSER_EMAIL=
POCKETBASE_SUPERUSER_PASSWORD=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Comandos

```bash
node mcp-app-inmobiliaria/server.mjs --setup
node mcp-app-inmobiliaria/server.mjs --test
node mcp-app-inmobiliaria/server.mjs --install
```

`--install` registra el servidor en `C:\Users\Usuario2\.codex\config.toml` como `mcp-app-inmobiliaria`.
