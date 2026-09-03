/** Stoat 语音 API 的移动端适配层。 */
import { ApiClient, ApiError, type JsonObject } from "@radio/core";
import type { InstanceEndpoints } from "@radio/core";

export interface JoinCallResponse {
  token: string;
  url: string;
}

export interface JoinCallOptions {
  node?: string;
  forceDisconnect?: boolean;
  recipients?: string[];
  signal?: AbortSignal;
}

/** 获取短时 LiveKit 凭据；返回后必须立即交给 LiveKit 连接。 */
export async function joinCall(
  endpoints: InstanceEndpoints,
  sessionToken: string,
  channelId: string,
  options: JoinCallOptions = {}
): Promise<JoinCallResponse> {
  const api = new ApiClient({ baseUrl: endpoints.api, sessionToken });
  const body = {
    node: options.node ?? "worldwide",
    force_disconnect: options.forceDisconnect ?? false,
    ...(options.recipients ? { recipients: options.recipients } : {}),
  };
  const response = await api.post<JsonObject>(`/channels/${encodeURIComponent(channelId)}/join_call`, body, {
    signal: options.signal,
  });
  if (typeof response.token !== "string" || typeof response.url !== "string") {
    throw new Error(`join_call 响应无效: ${JSON.stringify(response).slice(0, 200)}`);
  }
  return { token: response.token, url: response.url };
}

/** 结束私聊或群组频道中的指定用户振铃。 */
export async function stopRing(
  endpoints: InstanceEndpoints,
  sessionToken: string,
  channelId: string,
  targetUser: string,
  signal?: AbortSignal
): Promise<void> {
  const api = new ApiClient({ baseUrl: endpoints.api, sessionToken });
  await api.put<void>(
    `/channels/${encodeURIComponent(channelId)}/end_ring/${encodeURIComponent(targetUser)}`,
    undefined,
    { signal }
  );
}

/**
 * 服务端仍保留着旧语音会话（快速切换频道 / 崩溃残留），需要 forceDisconnect 接管。
 * 优先读 ApiError body 的结构化类型，文案匹配只做兜底。
 */
export function isAlreadyConnectedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (/already.?connected|already.?in.?call|already.?in.?voice/i.test(JSON.stringify(error.body ?? ""))) return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /already.?connected|already.?in.?call|already.?in.?voice/i.test(message);
}

/**
 * 语音连接失败是否值得指数退避重试。
 * 401/403/404、权限与房间满员不重试；token 过期、断网、超时、5xx 都重试
 * （重连会重新请求 join_call 短时凭据，过期 token 可自愈）。
 */
export function isRetriableVoiceError(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403 || error.status === 404) return false;
    if (error.status === 408 || error.status === 429 || error.status >= 500) return true;
    return !/permission|not authorized|forbidden|room.{0,12}full|denied|not found/i.test(
      `${error.message} ${JSON.stringify(error.body ?? "")}`
    );
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/token|expired|expiring|disconnected|socket.?closed|network|timeout|timed.?out|unavailable|ECONN|EPIPE/i.test(message)) {
    return true;
  }
  if (/not supported|unsupported|未公布|未提供|not advertised/i.test(message)) return false;
  return !/permission|not authorized|forbidden|room.{0,12}full|microphone|denied|not found/i.test(message);
}
