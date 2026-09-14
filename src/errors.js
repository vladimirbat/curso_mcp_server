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