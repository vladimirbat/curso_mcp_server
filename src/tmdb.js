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
      "TMDB_API_KEY no esta configurada. " +
      "Pasala al proceso mediante la configuracion del MCP Server."
    );
  }

  return apiKey;
}

function getDefaultLanguage() {
  return process.env.TMDB_LANGUAGE || "es-ES";
}

async function tmdbGet(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  const queryParams = { ...params, api_key: getApiKey() };

  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
  } catch (error) {
    throw new TmdbApiError(
      `No se ha podido conectar con TMDB: ${error.message}`
    );
  }

  if (!response.ok) {
    let details;

    try {
      const body = await response.json();
      details = body.status_message || JSON.stringify(body);
    } catch {
      details = await response.text();
    }

    throw new TmdbApiError(
      `TMDB respondio con HTTP ${response.status}: ${details}`,
      response.status
    );
  }

  return response.json();
}

async function findPerson(actor, language) {
  const data = await tmdbGet("/search/person", {
    query: actor,
    language,
    include_adult: false,
    page: 1
  });

  if (!data.results?.length) {
    throw new NotFoundError(
      `No se ha encontrado ningun actor o actriz con el nombre "${actor}".`
    );
  }

  return data.results[0];
}

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
      `No se ha encontrado ninguna pelicula con el titulo "${movie}".`
    );
  }

  return data.results[0];
}

export async function getActorMovies({
  actor,
  language = getDefaultLanguage(),
  limit = 20
}) {
  const person = await findPerson(actor, language);
  const credits = await tmdbGet(`/person/${person.id}/movie_credits`, { language });

  const movies = (credits.cast || [])
    .filter((movie) => movie.title)
    .sort((firstMovie, secondMovie) => {
      const firstDate = firstMovie.release_date || "";
      const secondDate = secondMovie.release_date || "";
      return secondDate.localeCompare(firstDate);
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

export async function getMovieCast({
  movie,
  language = getDefaultLanguage(),
  limit = 20,
  year
}) {
  const selectedMovie = await findMovie(movie, language, year);
  const credits = await tmdbGet(`/movie/${selectedMovie.id}/credits`, { language });

  const cast = (credits.cast || [])
    .slice()
    .sort((firstPerson, secondPerson) =>
      (firstPerson.order ?? 9999) - (secondPerson.order ?? 9999)
    )
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