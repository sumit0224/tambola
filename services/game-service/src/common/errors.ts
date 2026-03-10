export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(code);
    this.name = "AppError";
  }

  toResponseBody() {
    return {
      error: this.code,
      ...(this.details ?? {})
    };
  }
}
