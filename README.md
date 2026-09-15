# TMDB MCP Server

Servidor **Model Context Protocol (MCP)** en JavaScript y Node.js que conecta a un cliente/host MCP (como GitHub Copilot en Visual Studio Code) con la API REST de **The Movie Database (TMDB)** mediante el transporte local `stdio`.

---

## Prácticas del proyecto

- [doc/PRACTICA_IMPLEMENTACIÓN_tmdb_MCP_SERVER.md](doc/PRACTICA_IMPLEMENTACIÓN_tmdb_MCP_SERVER.md): Guía paso a paso sobre la implementación técnica del servidor MCP, manejo de errores y conexión con la API de TMDB.

---

## Requisitos

- Node.js 20 o posterior
- Una API Key válida de TMDB

## Instalación y ejecución local
Para depuración local se puede iniciar el proyecto de la siguiente forma:
```powershell
npm install
$env:TMDB_API_KEY="TU_API_KEY_DE_TMDB"
$env:TMDB_LANGUAGE="es-ES"
npm start
```
Pero para usarlo desde el chat de VS Code e instalarlo como un MCP para un proyecto en este IDE, no es necesario arrancarlo (npm start), ya que será el propio IDE el que arranque el servidor MCP.

El proceso utiliza `stdio` y queda a la espera de mensajes JSON-RPC de MCP. No escribe registros ni trazas en `stdout` para no corromper el protocolo.

## Tools expuestas

- `get_actor_movies`: Busca un actor o actriz en TMDB y devuelve sus películas. Argumentos: `actor` (requerido), `language` (opcional), `limit` (opcional).
- `get_movie_cast`: Busca una película en TMDB y devuelve los intérpretes de su reparto. Argumentos: `movie` (requerido), `year` (opcional), `language` (opcional), `limit` (opcional).

---

## Uso desde Visual Studio Code

La configuración para VS Code se declara en `.vscode/mcp.json`. Al iniciar el servidor desde VS Code, se solicita interactivamente la API Key mediante un diálogo seguro sin almacenarla en el repositorio.

---

## Proyectos del curso

Este repositorio forma parte de los tres proyectos del curso:
1. **curso_mcp**: Material docente, presentaciones y práctica con Chrome DevTools MCP.
2. **curso_mcp_server** (este repositorio): Servidor MCP de TMDB.
3. **web_peliculas**: Aplicación web estática generada por Copilot consumiendo las tools de este servidor.
