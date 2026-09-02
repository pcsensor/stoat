export type JsonObject = Record<string, unknown>;

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly method: string;
  readonly url: string;

  constructor(status: number, method: string, url: string, body: unknown) {
    const detail = describeApiError(body);
    super(detail ? `${method} ${url} 失败（${status}）：${detail}` : `${method} ${url} 失败（${status}）`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.method = method;
    this.url = url;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  sessionToken?: string;
  timeoutMs?: number;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "signal"> {
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  authenticated?: boolean;
}

export class ApiClient {
  readonly baseUrl: string;
  private readonly sessionToken?: string;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl);
    this.sessionToken = options.sessionToken;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = joinUrl(this.baseUrl, path);
    const headers = new Headers(options.headers);
    const body = options.body;
    const hasBody = body !== undefined;

    if (hasBody && !headers.has("Content-Type") && !(body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (hasBody && !(body instanceof FormData) && typeof body !== "string" && !(body instanceof Blob)) {
      options = { ...options, body: JSON.stringify(body) };
    }
    if (options.authenticated !== false && this.sessionToken) {
      headers.set("X-Session-Token", this.sessionToken);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? this.timeoutMs);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) controller.abort();

    try {
      const response = await fetch(url, {
        ...options,
        body: options.body as BodyInit | null | undefined,
        headers,
        signal: controller.signal,
      });
      const bodyText = await response.text();
      const parsed = parseResponseBody(bodyText);
      if (!response.ok) throw new ApiError(response.status, options.method ?? "GET", url, parsed);
      return parsed as T;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  get<T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path) || /^wss?:\/\//i.test(path)) return path;
  return `${trimTrailingSlash(base)}/${path.replace(/^\/+/, "")}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseResponseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeApiError(body: unknown): string {
  if (typeof body === "string") return body.slice(0, 200);
  if (!body || typeof body !== "object") return "";
  const value = body as JsonObject;
  for (const key of ["type", "error", "message", "result", "location"]) {
    if (typeof value[key] === "string") return value[key] as string;
  }
  return "";
}
