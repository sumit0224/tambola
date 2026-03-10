export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(code);
  }

  toResponse() {
    return {
      error: this.code,
      ...(this.details ?? {})
    };
  }
}
