/** Stoat 语音 API 的移动端适配层。 */
import { ApiClient, type JsonObject } from "@radio/core";
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
