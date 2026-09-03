import { ApiClient, ApiError, type JsonObject } from "./http.ts";

export interface InstanceEndpoints {
  /** 服务端公布的 REST API 地址。 */
  api: string;
  /** 事件网关地址。 */
  ws: string;
  /** 文件上传服务地址。 */
  autumn?: string;
  /** 媒体代理地址。 */
  january?: string;
  /** GIF 搜索代理地址。 */
  gifbox?: string;
  /** LiveKit 信令地址。 */
  livekit?: string;
}

export interface InstanceAvailability {
  /** 以下标记为 true 仅当服务端明确公布了该服务；false 表示 endpoints 中是兼容 fallback，不保证可用。 */
  ws: boolean;
  autumn: boolean;
  january: boolean;
  gifbox: boolean;
  livekit: boolean;
}

export interface InstanceConfig {
  endpoints: InstanceEndpoints;
  /** 各端点是否由服务端明确公布（false = 本地拼出的兼容地址）。 */
  availability: InstanceAvailability;
  features: JsonObject;
  version?: string;
  raw: JsonObject;
}

export interface LoginResponse extends JsonObject {
  result: "Success";
  _id: string;
  user_id: string;
  token: string;
}

export interface RegisterResponse extends JsonObject {
  result?: string;
}

/** 通过用户输入得到实例根地址。只接受 http/https，且丢弃路径和查询部分。 */
export function normalizeDomain(input: string): string {
  const value = input.trim();
  if (!value) throw new Error("实例地址不能为空");
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("实例地址必须使用 http 或 https");
  }
  if (!url.hostname) throw new Error("实例地址缺少主机名");
  return url.origin;
}

/** 发现实例并读取其完整配置。404 表示该地址不是 Stoat 实例。well-known 请求自带超时，避免冷启动无限挂起。 */
export async function discoverInstance(input: string, signal?: AbortSignal, timeoutMs = 15_000): Promise<InstanceConfig | null> {
  const base = normalizeDomain(input);
  const wellKnownUrl = `${base}/.well-known/stoat`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`实例发现超时（${timeoutMs}ms）：${base}`)), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort(signal.reason);
  try {
    const response = await fetch(wellKnownUrl, { signal: controller.signal });
    if (response.status === 404) return null;
    const wellKnown = await readJsonObject(response, wellKnownUrl);
    const api = readString(wellKnown, "api");
    if (!api) throw new Error("实例发现响应缺少 api 地址");

    const apiClient = new ApiClient({ baseUrl: api });
    const raw = await apiClient.get<JsonObject>("/", { signal });
    return parseInstanceConfig(api, raw);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

/** 从实例配置中读取服务地址；只在旧实例未公布地址时使用兼容 fallback。 */
export function parseInstanceConfig(apiUrl: string, raw: JsonObject): InstanceConfig {
  const api = trimTrailingSlash(apiUrl);
  const apiUrlObject = new URL(api);
  const origin = apiUrlObject.origin;
  const features = asObject(raw.features);
  const livekitFeature = asObject(features.livekit);
  const autumnFeature = asObject(features.autumn);
  const januaryFeature = asObject(features.january);
  const gifboxFeature = asObject(features.gifbox);
  const livekitNodes = Array.isArray(livekitFeature.nodes) ? livekitFeature.nodes : [];
  const firstLivekitUrl = livekitNodes
    .map((node) => (asObject(node).public_url ?? asObject(node).url))
    .find((value): value is string => typeof value === "string");

  const advertisedWs = readUrl(raw, "ws");
  const advertisedAutumn = readUrl(raw, "autumn") ?? readUrl(autumnFeature, "url");
  const advertisedJanuary = readUrl(raw, "january") ?? readUrl(januaryFeature, "url");
  const advertisedGifbox = readUrl(raw, "gifbox") ?? readUrl(gifboxFeature, "url");
  const advertisedLivekit = readUrl(raw, "livekit") ?? firstLivekitUrl;

  const ws = advertisedWs ?? `${toWebSocketOrigin(origin)}/ws`;
  const autumn = advertisedAutumn ?? `${origin}/autumn`;
  const january = advertisedJanuary ?? `${origin}/january`;
  const gifbox = advertisedGifbox ?? `${origin}/gifbox`;
  const livekit = advertisedLivekit ?? `${toWebSocketOrigin(origin)}/livekit`;

  return {
    endpoints: { api, ws, autumn, january, gifbox, livekit },
    availability: {
      ws: advertisedWs !== undefined,
      autumn: advertisedAutumn !== undefined,
      january: advertisedJanuary !== undefined,
      gifbox: advertisedGifbox !== undefined,
      livekit: advertisedLivekit !== undefined,
    },
    features,
    version: readString(raw, "version") ?? readString(raw, "version_string"),
    raw,
  };
}

/** 登录。登录和注册分离，调用方可据 ApiError.status 展示准确错误。 */
export async function login(
  endpoints: InstanceEndpoints,
  email: string,
  password: string,
  signal?: AbortSignal
): Promise<LoginResponse> {
  const api = new ApiClient({ baseUrl: endpoints.api });
  const data = await api.post<JsonObject>("/auth/session/login", { email, password }, { signal });
  if (data.result !== "Success" || typeof data.token !== "string") {
    throw new Error(`登录响应无效: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data as LoginResponse;
}

/**
 * 注册。invite 为空时不发送该字段，兼容开放注册的实例；
 * 需要邀请码的实例会由服务端返回明确错误。
 */
export async function registerAccount(
  endpoints: InstanceEndpoints,
  email: string,
  password: string,
  invite?: string,
  signal?: AbortSignal
): Promise<RegisterResponse> {
  const api = new ApiClient({ baseUrl: endpoints.api });
  const trimmedInvite = invite?.trim();
  return api.post<RegisterResponse>(
    "/auth/account/create",
    trimmedInvite ? { email, password, invite: trimmedInvite } : { email, password },
    { signal }
  );
}

export async function completeOnboarding(
  endpoints: InstanceEndpoints,
  sessionToken: string,
  username: string,
  signal?: AbortSignal
): Promise<JsonObject> {
  const api = new ApiClient({ baseUrl: endpoints.api, sessionToken });
  return api.post<JsonObject>("/onboard/complete", { username }, { signal });
}

async function readJsonObject(response: Response, url: string): Promise<JsonObject> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`实例响应不是有效 JSON: ${url}`);
  }
  if (!response.ok) throw new ApiError(response.status, "GET", url, body);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`实例响应不是对象: ${url}`);
  }
  return body as JsonObject;
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function readString(value: JsonObject, key: string): string | undefined {
  return typeof value[key] === "string" && value[key] ? value[key] as string : undefined;
}

function readUrl(value: JsonObject, key: string): string | undefined {
  const candidate = readString(value, key);
  if (!candidate) return undefined;
  try {
    new URL(candidate);
    return candidate.replace(/\/+$/, "");
  } catch {
    throw new Error(`实例配置中的 ${key} 不是有效 URL`);
  }
}

function toWebSocketOrigin(origin: string): string {
  return origin.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
