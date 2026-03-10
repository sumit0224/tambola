import { AppError } from "../utils/AppError";

type ProxyOptions = {
  baseUrl: string;
};

export class LegacyProxyService {
  constructor(private readonly options: ProxyOptions) {}

  async forward<T>(input: {
    path: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    token?: string;
    body?: unknown;
    headers?: Record<string, string | undefined>;
  }): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };

    if (input.token) {
      headers.authorization = `Bearer ${input.token}`;
    }

    for (const [key, value] of Object.entries(input.headers ?? {})) {
      if (value) {
        headers[key] = value;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${this.options.baseUrl}${input.path}`, {
      method: input.method,
      headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    const responseBody = await response.text();
    const parsedBody = responseBody ? this.safeParse(responseBody) : null;

    if (!response.ok) {
      throw new AppError(response.status, "LEGACY_SERVICE_ERROR", {
        path: input.path,
        upstream: parsedBody
      });
    }

    return parsedBody as T;
  }

  private safeParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
