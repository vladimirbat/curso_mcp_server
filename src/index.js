import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

import { getActorMovies, getMovieCast } from "./tmdb.js";

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
      title: "Peliculas de un actor",
      description: "Busca un actor o actriz en TMDB y devuelve las peliculas en las que ha participado como interprete.",
      inputSchema: z.object({
        actor: z.string().min(2).describe("Nombre del actor o actriz, por ejemplo: Tom Hanks"),
        language: z.string().default("es-ES").describe("Idioma de TMDB, por ejemplo es-ES o en-US"),
        limit: z.number().int().min(1).max(50).default(20).describe("Numero maximo de peliculas a devolver")
      })
    },
    async ({ actor, language, limit }) => {
      try {
        const result = await getActorMovies({ actor, language, limit });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
      title: "Reparto de una pelicula",
      description: "Busca una pelicula en TMDB y devuelve los actores y actrices que forman parte de su reparto.",
      inputSchema: z.object({
        movie: z.string().min(1).describe("Titulo de la pelicula, por ejemplo: Forrest Gump"),
        year: z.number().int().min(1880).max(2200).optional().describe("Ano de estreno opcional para desambiguar peliculas con el mismo titulo"),
        language: z.string().default("es-ES").describe("Idioma de TMDB, por ejemplo es-ES o en-US"),
        limit: z.number().int().min(1).max(100).default(20).describe("Numero maximo de interpretes a devolver")
      })
    },
    async ({ movie, year, language, limit }) => {
      try {
        const result = await getMovieCast({ movie, year, language, limit });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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