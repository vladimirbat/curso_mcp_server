# TMDB MCP Server

MCP Server en JavaScript y Node.js para consultar peliculas y reparto con TMDB.

## Requisitos

- Node.js 20 o posterior
- Una API Key de TMDB

## Instalacion

```powershell
npm install
$env:TMDB_API_KEY="TU_API_KEY_DE_TMDB"
$env:TMDB_LANGUAGE="es-ES"
npm start
```

El proceso usa stdio y queda a la espera de mensajes MCP. No escribe mensajes de protocolo manuales ni registros en stdout.

## Tools

- `get_actor_movies`: recibe `actor`, `language` opcional y `limit` opcional.
- `get_movie_cast`: recibe `movie`, `year` opcional, `language` opcional y `limit` opcional.

La configuracion de VS Code se encuentra en `.vscode/mcp.json`. Al iniciar el servidor desde VS Code se solicita la API Key sin almacenarla en el repositorio.