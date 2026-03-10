export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string) {
    super(code);
    this.name = "AppError";
  }
}
