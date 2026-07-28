export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class DuplicateFlagKeyError extends AppError {
  constructor(key: string) {
    super(409, "FLAG_KEY_EXISTS", `A flag with key "${key}" already exists.`);
  }
}

export class FlagNotFoundError extends AppError {
  constructor(key: string) {
    super(404, "FLAG_NOT_FOUND", `No flag with key "${key}" exists.`);
  }
}
