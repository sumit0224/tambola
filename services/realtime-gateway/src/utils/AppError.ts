export class AppError extends Error {
  constructor(public readonly code: string, public readonly statusCode = 400, public readonly details?: object) {
    super(code);
  }
}
