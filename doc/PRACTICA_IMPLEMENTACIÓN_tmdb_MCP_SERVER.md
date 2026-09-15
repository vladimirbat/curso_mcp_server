# MCP Server de películas y actores con TMDB

Este documento describe una implementación completa de un **MCP Server en JavaScript / Node.js** que consulta la API de **The Movie Database (TMDB)**.

El servidor expone dos herramientas principales:

- `get_actor_movies`: recibe el nombre de un actor o actriz y devuelve películas en las que ha participado.
- `get_movie_cast`: recibe el título de una película y devuelve su reparto.

La credencial de TMDB se proporciona al proceso del servidor mediante la variable de entorno `TMDB_API_KEY`, configurada desde el cliente/host MCP. De este modo la API Key no aparece en el código fuente ni se pasa como argumento de una tool.

---

## 1. Objetivo del ejemplo

El objetivo didáctico es mostrar una arquitectura sencilla pero realista:

```text
Usuario
   |
   v
LLM / MCP Host
   |
   | MCP
   v
Movie MCP Server
   |
   | HTTPS / REST
   v
TMDB API
```

El usuario puede realizar preguntas naturales como:

```text
¿En qué películas ha participado Tom Hanks?
```

El modelo puede decidir invocar:

```text
get_actor_movies({
  "actor": "Tom Hanks"
})
```

O preguntar:

```text
¿Qué actores aparecen en Forrest Gump?
```

y el modelo puede invocar:

```text
get_movie_cast({
  "movie": "Forrest Gump"
})
```

El servidor MCP oculta al modelo los detalles de la API REST de TMDB: búsqueda de IDs, endpoints intermedios, autenticación y transformación de respuestas.

---

## 2. API de TMDB utilizada

La implementación usa la API v3 de TMDB.

### Buscar una persona

```http
GET https://api.themoviedb.org/3/search/person
```

Parámetros principales:

```text
query
language
include_adult
api_key
```

Ejemplo conceptual:

```http
GET /3/search/person?query=Tom%20Hanks&language=es-ES&api_key=...
```

La respuesta contiene candidatos. El servidor toma el primer resultado y obtiene su `id`.

---

### Obtener los créditos cinematográficos de una persona

```http
GET https://api.themoviedb.org/3/person/{person_id}/movie_credits
```

Ejemplo:

```http
GET /3/person/31/movie_credits?language=es-ES&api_key=...
```

La propiedad `cast` contiene las películas en las que la persona aparece como intérprete.

---

### Buscar una película

```http
GET https://api.themoviedb.org/3/search/movie
```

Ejemplo conceptual:

```http
GET /3/search/movie?query=Forrest%20Gump&language=es-ES&api_key=...
```

El servidor toma el primer resultado y utiliza su `id`.

---

### Obtener el reparto de una película

```http
GET https://api.themoviedb.org/3/movie/{movie_id}/credits
```

Ejemplo:

```http
GET /3/movie/13/credits?language=es-ES&api_key=...
```

La propiedad `cast` contiene los intérpretes y los personajes correspondientes.

---

## 3. Autenticación

TMDB API v3 admite una API Key mediante el parámetro `api_key`.

En este ejemplo la API Key **no se almacena en el código**.

El servidor la obtiene desde:

```javascript
process.env.TMDB_API_KEY
```

La configuración del host MCP se encargará de inyectarla en el proceso.

Ejemplo:

```json
{
  "mcpServers": {
    "tmdb-movies": {
      "command": "node",
      "args": [
        "/ruta/al/proyecto/src/index.js"
      ],
      "env": {
        "TMDB_API_KEY": "TU_API_KEY_DE_TMDB"
      }
    }
  }
}
```

Esto permite mantener separado:

```text
Código                  Configuración
-----                   -------------
Lógica MCP              API Key
Lógica TMDB             Idioma
Transformación          Opciones de ejecución
```

> No se debe subir una API Key real al repositorio Git.

TMDB también permite autenticación mediante un **API Read Access Token** enviado como `Authorization: Bearer ...`. Para mantener el ejemplo centrado en el requisito de la práctica, la implementación principal usa `TMDB_API_KEY`.

---

## 4. Requisitos

Se recomienda:

```text
Node.js >= 20
npm
Una cuenta de TMDB
Una API Key de TMDB
```

Node.js 20 incluye `fetch`, por lo que no hace falta instalar `axios` ni `node-fetch`.

---

## 5. Estructura del proyecto

```text
tmdb-mcp-server/
|
|-- package.json
|-- src/
|   |-- index.js
|   |-- tmdb.js
|   `-- errors.js
|
`-- README.md
```

Responsabilidades:

```text
index.js
   Definición del servidor MCP y de sus tools.

tmdb.js
   Cliente de TMDB y lógica de búsqueda.

errors.js
   Errores de dominio sencillos.
```

Separar MCP de TMDB es útil porque evita que el código de integración con la API quede mezclado con la definición del protocolo.

---

# 6. Creación del proyecto

```bash
mkdir tmdb-mcp-server
cd tmdb-mcp-server

npm init -y
```

Instalar las dependencias:

```bash
npm install @modelcontextprotocol/server zod
```

Crear:

```bash
mkdir src
```

---

# 7. `package.json`

```json
{
  "name": "tmdb-mcp-server",
  "version": "1.0.0",
  "description": "MCP Server de ejemplo para consultar actores y películas mediante TMDB",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^2.0.0",
    "zod": "^4.0.0"
  }
}
```

`"type": "module"` permite utilizar sintaxis ES Modules:

```javascript
import ...
export ...
```

---

# 8. Gestión de errores

Crear `src/errors.js`:

```javascript
export class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class TmdbApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TmdbApiError";
    this.status = status;
  }
}
```

No es imprescindible definir clases propias, pero ayuda a explicar que un servidor MCP debería distinguir entre:

```text
Error de configuración
Error de entrada
Entidad no encontrada
Error del servicio externo
Error inesperado
```

---

# 9. Cliente TMDB

Crear `src/tmdb.js`:

```javascript
import {
  ConfigurationError,
  NotFoundError,
  TmdbApiError
} from "./errors.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getApiKey() {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    throw new ConfigurationError(
      "TMDB_API_KEY no está configurada. " +
      "Pásala al proceso mediante la configuración del MCP Server."
    );
  }

  return apiKey;
}

function getDefaultLanguage() {
  return process.env.TMDB_LANGUAGE || "es-ES";
}

/**
 * Ejecuta una petición GET contra TMDB.
 */
async function tmdbGet(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);

  const queryParams = {
    ...params,
    api_key: getApiKey()
  };

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });
  } catch (error) {
    throw new TmdbApiError(
      `No se ha podido conectar con TMDB: ${error.message}`
    );
  }

  if (!response.ok) {
    let details = "";

    try {
      const body = await response.json();
      details = body.status_message || JSON.stringify(body);
    } catch {
      details = await response.text();
    }

    throw new TmdbApiError(
      `TMDB respondió con HTTP ${response.status}: ${details}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Busca una persona por nombre.
 */
async function findPerson(actor, language) {
  const data = await tmdbGet("/search/person", {
    query: actor,
    language,
    include_adult: false,
    page: 1
  });

  if (!data.results?.length) {
    throw new NotFoundError(
      `No se ha encontrado ningún actor o actriz con el nombre "${actor}".`
    );
  }

  return data.results[0];
}

/**
 * Busca una película por título.
 */
async function findMovie(movie, language, year) {
  const data = await tmdbGet("/search/movie", {
    query: movie,
    language,
    include_adult: false,
    page: 1,
    year
  });

  if (!data.results?.length) {
    throw new NotFoundError(
      `No se ha encontrado ninguna película con el título "${movie}".`
    );
  }

  return data.results[0];
}

/**
 * Devuelve películas en las que ha participado una persona.
 */
export async function getActorMovies({
  actor,
  language = getDefaultLanguage(),
  limit = 20
}) {
  const person = await findPerson(actor, language);

  const credits = await tmdbGet(
    `/person/${person.id}/movie_credits`,
    { language }
  );

  const movies = (credits.cast || [])
    .filter((movie) => movie.title)
    .sort((a, b) => {
      const dateA = a.release_date || "";
      const dateB = b.release_date || "";
      return dateB.localeCompare(dateA);
    })
    .slice(0, limit)
    .map((movie) => ({
      id: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      character: movie.character || null,
      releaseDate: movie.release_date || null
    }));

  return {
    actor: {
      id: person.id,
      name: person.name,
      knownForDepartment: person.known_for_department || null
    },
    movies,
    totalReturned: movies.length
  };
}

/**
 * Devuelve el reparto de una película.
 */
export async function getMovieCast({
  movie,
  language = getDefaultLanguage(),
  limit = 20,
  year
}) {
  const selectedMovie = await findMovie(movie, language, year);

  const credits = await tmdbGet(
    `/movie/${selectedMovie.id}/credits`,
    { language }
  );

  const cast = (credits.cast || [])
    .slice()
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .slice(0, limit)
    .map((person) => ({
      id: person.id,
      name: person.name,
      character: person.character || null,
      order: person.order ?? null
    }));

  return {
    movie: {
      id: selectedMovie.id,
      title: selectedMovie.title,
      originalTitle: selectedMovie.original_title,
      releaseDate: selectedMovie.release_date || null
    },
    cast,
    totalReturned: cast.length
  };
}
```

---

# 10. Servidor MCP

Crear `src/index.js`:

```javascript
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import {
  getActorMovies,
  getMovieCast
} from "./tmdb.js";

function toolError(error) {
  console.error(error);

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: error instanceof Error
          ? error.message
          : "Se ha producido un error desconocido."
      }
    ]
  };
}

function createServer() {
  const server = new McpServer({
    name: "tmdb-movies",
    version: "1.0.0"
  });

  server.registerTool(
    "get_actor_movies",
    {
      title: "Películas de un actor",
      description:
        "Busca un actor o actriz en TMDB y devuelve las películas " +
        "en las que ha participado como intérprete.",

      inputSchema: z.object({
        actor: z
          .string()
          .min(2)
          .describe("Nombre del actor o actriz, por ejemplo: Tom Hanks"),

        language: z
          .string()
          .default("es-ES")
          .describe("Idioma de TMDB, por ejemplo es-ES o en-US"),

        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Número máximo de películas a devolver")
      })
    },

    async ({ actor, language, limit }) => {
      try {
        const result = await getActorMovies({
          actor,
          language,
          limit
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
          structuredContent: result
        };
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "get_movie_cast",
    {
      title: "Reparto de una película",
      description:
        "Busca una película en TMDB y devuelve los actores y actrices " +
        "que forman parte de su reparto.",

      inputSchema: z.object({
        movie: z
          .string()
          .min(1)
          .describe("Título de la película, por ejemplo: Forrest Gump"),

        year: z
          .number()
          .int()
          .min(1880)
          .max(2200)
          .optional()
          .describe(
            "Año de estreno opcional para desambiguar películas con el mismo título"
          ),

        language: z
          .string()
          .default("es-ES")
          .describe("Idioma de TMDB, por ejemplo es-ES o en-US"),

        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Número máximo de intérpretes a devolver")
      })
    },

    async ({ movie, year, language, limit }) => {
      try {
        const result = await getMovieCast({
          movie,
          year,
          language,
          limit
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
          structuredContent: result
        };
      } catch (error) {
        return toolError(error);
      }
    }
  );

  return server;
}

serveStdio(createServer);
```

---

# 11. ¿Por qué usar `stdio`?

Este ejemplo utiliza MCP sobre `stdio`.

El host MCP lanza el servidor como proceso hijo:

```text
MCP Host
   |
   | crea proceso
   v
node src/index.js
   |
 stdin / stdout
   |
 protocolo MCP
```

Para una práctica local es una opción muy sencilla porque no requiere:

```text
Express
puertos
HTTP server
routing
CORS
TLS
```

El SDK se encarga del transporte MCP.

Es importante que los mensajes de depuración del servidor se escriban en:

```javascript
console.error(...)
```

y no en `console.log(...)`, porque `stdout` está reservado para la comunicación del protocolo MCP.

---

# 12. Configuración del MCP Server

La parte más importante para la credencial es la propiedad `env`.

Ejemplo genérico de configuración de un host MCP:

```json
{
  "mcpServers": {
    "tmdb-movies": {
      "command": "node",
      "args": [
        "/ruta/absoluta/tmdb-mcp-server/src/index.js"
      ],
      "env": {
        "TMDB_API_KEY": "TU_API_KEY_DE_TMDB",
        "TMDB_LANGUAGE": "es-ES"
      }
    }
  }
}
```

Cuando el host inicia el servidor, conceptualmente ejecuta algo equivalente a:

```bash
TMDB_API_KEY="..." \
TMDB_LANGUAGE="es-ES" \
node src/index.js
```

Por eso el servidor puede recuperar el valor mediante:

```javascript
process.env.TMDB_API_KEY
```

---

# 13. Por qué la API Key no debe ser un parámetro de la tool

No conviene definir una tool así:

```javascript
get_actor_movies({
  actor: "Tom Hanks",
  apiKey: "..."
})
```

La credencial no forma parte de la intención del usuario.

La separación correcta es:

```text
Usuario / LLM
     |
     | actor = "Tom Hanks"
     v
MCP Tool
     |
     | process.env.TMDB_API_KEY
     v
TMDB
```

Ventajas:

- el modelo no necesita conocer el secreto;
- la API Key no aparece repetidamente en llamadas MCP;
- la configuración puede cambiar sin modificar prompts;
- se reduce la probabilidad de exponer la credencial;
- se parece más a una integración empresarial real.

---

# 14. Ejecución manual

Para comprobar que el proceso arranca:

## macOS / Linux

```bash
export TMDB_API_KEY="TU_API_KEY"
export TMDB_LANGUAGE="es-ES"

npm start
```

## PowerShell

```powershell
$env:TMDB_API_KEY="TU_API_KEY"
$env:TMDB_LANGUAGE="es-ES"

npm start
```

El servidor se quedará esperando mensajes MCP por `stdin`.

Eso es normal: no es una aplicación interactiva de consola.

---

# 15. Ejemplo de `get_actor_movies`

Invocación lógica:

```json
{
  "actor": "Tom Hanks",
  "language": "es-ES",
  "limit": 5
}
```

Respuesta aproximada:

```json
{
  "actor": {
    "id": 31,
    "name": "Tom Hanks",
    "knownForDepartment": "Acting"
  },
  "movies": [
    {
      "id": 123,
      "title": "Ejemplo",
      "originalTitle": "Example",
      "character": "John Doe",
      "releaseDate": "2025-10-10"
    }
  ],
  "totalReturned": 1
}
```

Los datos reales dependen de TMDB y cambian con el tiempo.

---

# 16. Ejemplo de `get_movie_cast`

Invocación lógica:

```json
{
  "movie": "Forrest Gump",
  "year": 1994,
  "language": "es-ES",
  "limit": 10
}
```

Respuesta aproximada:

```json
{
  "movie": {
    "id": 13,
    "title": "Forrest Gump",
    "originalTitle": "Forrest Gump",
    "releaseDate": "1994-06-23"
  },
  "cast": [
    {
      "id": 31,
      "name": "Tom Hanks",
      "character": "Forrest Gump",
      "order": 0
    }
  ],
  "totalReturned": 1
}
```

---

# 17. Desambiguación de películas

Una búsqueda por título puede devolver varias películas.

Por ejemplo:

```text
King Kong
```

puede referirse a películas de años diferentes.

Por eso `get_movie_cast` acepta opcionalmente:

```json
{
  "movie": "King Kong",
  "year": 2005
}
```

El servidor transmite el año a `/search/movie`.

Esto mejora bastante la precisión sin complicar demasiado la interfaz MCP.

---

# 18. Una decisión de diseño importante: tools semánticas

Podríamos exponer directamente los endpoints REST:

```text
search_person
person_movie_credits
search_movie
movie_credits
```

pero para este ejemplo no es lo recomendable.

El servidor expone capacidades orientadas a la intención:

```text
get_actor_movies
get_movie_cast
```

La tool:

```text
get_actor_movies("Tom Hanks")
```

realiza internamente dos operaciones TMDB:

```text
/search/person
      |
      v
person_id
      |
      v
/person/{id}/movie_credits
```

Esto permite explicar que un MCP Server no tiene por qué ser un wrapper 1:1 de una API.

Una tool puede representar una **capacidad de negocio o de dominio**.

---

# 19. Secuencia completa: actor -> películas

```text
1. Usuario
   "¿En qué películas aparece Tom Hanks?"

2. LLM
   Decide llamar get_actor_movies.

3. MCP
   get_actor_movies({
     actor: "Tom Hanks"
   })

4. Servidor
   GET /search/person?query=Tom%20Hanks

5. TMDB
   Devuelve person_id.

6. Servidor
   GET /person/{person_id}/movie_credits

7. TMDB
   Devuelve cast[].

8. Servidor
   Filtra, ordena y transforma.

9. MCP
   Devuelve structuredContent.

10. LLM
    Redacta una respuesta natural.
```

---

# 20. Secuencia completa: película -> reparto

```text
1. Usuario
   "¿Quién aparece en Forrest Gump?"

2. LLM
   Decide llamar get_movie_cast.

3. MCP
   get_movie_cast({
     movie: "Forrest Gump"
   })

4. Servidor
   GET /search/movie?query=Forrest%20Gump

5. TMDB
   Devuelve movie_id.

6. Servidor
   GET /movie/{movie_id}/credits

7. TMDB
   Devuelve cast[].

8. Servidor
   Ordena por el orden del reparto.

9. MCP
   Devuelve structuredContent.

10. LLM
    Presenta la respuesta.
```

---

# 21. `content` y `structuredContent`

Las tools devuelven:

```javascript
return {
  content: [
    {
      type: "text",
      text: JSON.stringify(result, null, 2)
    }
  ],
  structuredContent: result
};
```

Esto resulta útil didácticamente.

`content` proporciona una representación textual estándar.

`structuredContent` conserva la estructura JSON y facilita que un cliente MCP pueda tratar los datos como información estructurada.

---

# 22. Validación con Zod

El SDK MCP utiliza un schema para describir los parámetros de una tool.

Ejemplo:

```javascript
inputSchema: z.object({
  actor: z.string().min(2),
  language: z.string().default("es-ES"),
  limit: z.number().int().min(1).max(50).default(20)
})
```

El schema cumple dos funciones importantes:

```text
Descripción para el LLM
        +
Validación en ejecución
```

El modelo puede saber qué argumentos acepta la tool y el servidor puede rechazar entradas inválidas.

---

# 23. Manejo de errores como resultado MCP

Si TMDB no encuentra un actor:

```text
No se ha encontrado ningún actor o actriz con el nombre "..."
```

Si falta la configuración:

```text
TMDB_API_KEY no está configurada.
```

Si TMDB responde con un error HTTP:

```text
TMDB respondió con HTTP 401: ...
```

El handler convierte el error a:

```javascript
{
  isError: true,
  content: [
    {
      type: "text",
      text: "..."
    }
  ]
}
```

Así el cliente MCP sabe que la ejecución de la tool ha fallado.

---

# 24. Seguridad

Para un ejemplo educativo conviene recalcar varias prácticas.

## No incluir secretos en Git

No hacer:

```javascript
const API_KEY = "abc123...";
```

Tampoco:

```json
{
  "TMDB_API_KEY": "una-api-key-real"
}
```

en un archivo que se vaya a publicar.

---

## No devolver la API Key

Las respuestas MCP nunca deben contener:

```text
TMDB_API_KEY
```

---

## No registrar la URL completa si contiene `api_key`

Este código evita registrar las peticiones.

Si se añadiera logging, no convendría hacer:

```javascript
console.error(url.toString());
```

porque la API Key aparece en el query string.

---

# 25. Alternativa: Bearer token

TMDB recomienda también el uso de su **API Read Access Token**.

Una variante del cliente podría utilizar:

```javascript
const token = process.env.TMDB_ACCESS_TOKEN;

const response = await fetch(url, {
  headers: {
    Accept: "application/json",
    Authorization: `Bearer ${token}`
  }
});
```

La configuración MCP sería:

```json
{
  "mcpServers": {
    "tmdb-movies": {
      "command": "node",
      "args": [
        "/ruta/absoluta/tmdb-mcp-server/src/index.js"
      ],
      "env": {
        "TMDB_ACCESS_TOKEN": "TU_API_READ_ACCESS_TOKEN"
      }
    }
  }
}
```

Para la práctica propuesta, sin embargo, `TMDB_API_KEY` es suficiente y hace explícito el requisito planteado.

---

# 26. Posibles mejoras

Una vez implementadas las dos tools básicas, el MCP puede crecer fácilmente.

### `get_movie_details`

```text
get_movie_details(movie, year?)
```

Podría devolver:

```text
sinopsis
fecha de estreno
duración
géneros
valoración
presupuesto
recaudación
```

---

### `get_actor_details`

```text
get_actor_details(actor)
```

Podría devolver:

```text
nombre
biografía
fecha de nacimiento
lugar de nacimiento
popularidad
```

---

### `get_movie_recommendations`

```text
get_movie_recommendations(movie)
```

Permitiría preguntas como:

```text
Recomiéndame películas similares a Interstellar.
```

---

### `find_common_movies`

```text
find_common_movies(actor1, actor2)
```

Esta tool podría reutilizar internamente `getActorMovies` dos veces e intersectar los IDs de película.

Esto permite mostrar cómo una tool MCP puede implementar lógica propia encima de una API externa.

Ejemplo:

```text
¿En qué películas han trabajado juntos
Tom Hanks y Meg Ryan?
```

---

# 27. Variante avanzada: separar búsqueda y consulta

Una evolución didáctica consiste en comparar dos diseños.

## Diseño A: tools de alto nivel

```text
get_actor_movies(actor_name)
get_movie_cast(movie_title)
```

Ventaja:

```text
El modelo expresa intenciones del dominio.
```

---

## Diseño B: tools próximas al REST API

```text
search_actor(name)
get_actor_movie_credits(person_id)

search_movie(title)
get_movie_credits(movie_id)
```

Ventaja:

```text
El modelo puede encadenar operaciones.
```

Pero aumenta:

```text
número de tools
número de llamadas
acoplamiento con TMDB
complejidad para el LLM
```

Para una introducción a MCP, el diseño A suele ser más claro.

---

# 28. Resumen de la arquitectura

```text
                         MCP
+----------------+     protocol     +----------------------+
|                |  ------------->  |                      |
|   LLM / Host   |                  |   TMDB MCP Server    |
|                |  <-------------  |                      |
+----------------+                  +----------+-----------+
                                               |
                                               | HTTPS
                                               |
                                    +----------v-----------+
                                    |                      |
                                    |      TMDB API        |
                                    |                      |
                                    +----------------------+
```

Tools:

```text
get_actor_movies
    |
    +--> search/person
    |
    `--> person/{id}/movie_credits


get_movie_cast
    |
    +--> search/movie
    |
    `--> movie/{id}/credits
```

Configuración:

```text
MCP Host
   |
   +--> command = node
   |
   +--> args = src/index.js
   |
   `--> env
         |
         +--> TMDB_API_KEY
         `--> TMDB_LANGUAGE
```

---

# 29. Código mínimo imprescindible

Si se quiere enseñar únicamente la esencia del ejercicio, se puede resumir en tres ideas.

### Configuración

```javascript
const apiKey = process.env.TMDB_API_KEY;
```

### API externa

```javascript
const response = await fetch(
  `https://api.themoviedb.org/3/search/person` +
  `?query=${encodeURIComponent(actor)}` +
  `&api_key=${encodeURIComponent(apiKey)}`
);
```

### Tool MCP

```javascript
server.registerTool(
  "get_actor_movies",
  {
    description: "Devuelve las películas de un actor",
    inputSchema: z.object({
      actor: z.string()
    })
  },
  async ({ actor }) => {
    const result = await getActorMovies({ actor });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result)
        }
      ]
    };
  }
);
```

A partir de ahí se pueden introducir progresivamente:

```text
schemas
errores
structuredContent
variables de entorno
desambiguación
composición de APIs
diseño de tools
seguridad
```

---

# 30. Referencias

Documentación oficial:

- TMDB API Getting Started: https://developer.themoviedb.org/reference/getting-started
- TMDB Application Authentication: https://developer.themoviedb.org/docs/authentication-application
- TMDB Search Person: https://developer.themoviedb.org/reference/search-person
- TMDB Person Movie Credits: https://developer.themoviedb.org/reference/person-movie-credits
- TMDB Search Movie: https://developer.themoviedb.org/reference/search-movie
- TMDB Movie Credits: https://developer.themoviedb.org/reference/movie-credits
- MCP TypeScript SDK: https://ts.sdk.modelcontextprotocol.io/v2/
- MCP first server: https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server

---

# 31. Conclusión

Este ejemplo muestra un patrón muy habitual de MCP:

```text
LLM
 |
 v
Tool orientada a una capacidad
 |
 v
Adaptador / lógica del MCP
 |
 v
API externa
 |
 v
Datos estructurados
```

La principal idea que conviene transmitir es que el MCP Server no se limita a exponer una API REST existente.

Su función es ofrecer al modelo **capacidades con significado**, ocultando detalles técnicos como:

```text
autenticación
IDs internos
endpoints
secuencias de llamadas
transformación de datos
manejo de errores
```

En este caso:

```text
"Quiero conocer las películas de un actor"
```

se convierte en:

```text
get_actor_movies
```

y:

```text
"Quiero conocer el reparto de una película"
```

se convierte en:

```text
get_movie_cast
```

mientras que la API Key de TMDB permanece en la configuración del servidor y nunca necesita ser conocida por el modelo.
