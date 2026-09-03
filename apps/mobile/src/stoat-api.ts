import { ApiClient, ApiError, type InstanceEndpoints, type JsonObject } from "@radio/core";

export interface CreatedServer {
  server: { _id: string; name?: string };
  channels: unknown[];
}

export interface CreatedChannel {
  _id: string;
  name: string;
  voice?: { max_users?: number };
}

export interface JoinedServer {
  server: { _id: string };
  channels?: Array<{ _id: string }>;
}

export interface InviteInfo {
  server_id: string;
  channel_id?: string;
}

export function createStoatApi(endpoints: InstanceEndpoints, sessionToken: string): ApiClient {
  return new ApiClient({ baseUrl: endpoints.api, sessionToken });
}

export async function createServer(api: ApiClient, name: string): Promise<CreatedServer> {
  const body = await api.post<JsonObject>("/servers/create", { name });
  const server = asObject(body.server);
  if (typeof server._id !== "string") throw new Error("创建服务器响应缺少服务器 ID");
  return {
    server: { _id: server._id, name: typeof server.name === "string" ? server.name : undefined },
    channels: Array.isArray(body.channels) ? body.channels : [],
  };
}

export async function createChannel(
  api: ApiClient,
  serverId: string,
  type: "Text" | "Voice",
  name: string,
  options: { maxUsers?: number } = {}
): Promise<CreatedChannel> {
  // 不再硬编码 max_users：缺省时完全交给服务端默认，避免客户端藏着一条隐形上限。
  const body = await api.post<JsonObject>(`/servers/${encodeURIComponent(serverId)}/channels`, {
    type,
    name,
    ...(type === "Voice" && options.maxUsers !== undefined ? { voice: { max_users: options.maxUsers } } : {}),
  });
  if (typeof body._id !== "string" || typeof body.name !== "string") throw new Error("创建频道响应无效");
  const voice = isObject(body.voice) ? (body.voice as CreatedChannel["voice"]) : undefined;
  return { _id: body._id, name: body.name, ...(voice ? { voice } : {}) };
}

export async function updateChannel(
  api: ApiClient,
  channelId: string,
  changes: JsonObject
): Promise<JsonObject> {
  const body = await api.patch<unknown>(`/channels/${encodeURIComponent(channelId)}`, changes);
  if (!isObject(body)) throw new Error("频道更新响应无效");
  return body;
}

export async function deleteChannel(api: ApiClient, channelId: string): Promise<void> {
  await api.delete(`/channels/${encodeURIComponent(channelId)}`);
}

export async function joinServer(api: ApiClient, inviteCode: string): Promise<JoinedServer> {
  const body = await api.post<JsonObject>(`/invites/${encodeURIComponent(inviteCode)}`);
  const server = asObject(body.server);
  if (typeof server._id !== "string") throw new Error("加入服务器响应缺少服务器 ID");
  return {
    server: { _id: server._id },
    channels: Array.isArray(body.channels)
      ? body.channels
          .filter((channel): channel is { _id: string } => typeof asObject(channel)._id === "string")
          .map((channel) => ({ _id: asObject(channel)._id as string }))
      : undefined,
  };
}

export async function getInvite(api: ApiClient, inviteCode: string): Promise<InviteInfo> {
  const body = await api.get<JsonObject>(`/invites/${encodeURIComponent(inviteCode)}`);
  if (typeof body.server_id !== "string") throw new Error("邀请响应缺少服务器 ID");
  return { server_id: body.server_id, channel_id: typeof body.channel_id === "string" ? body.channel_id : undefined };
}

export async function createChannelInvite(api: ApiClient, channelId: string): Promise<string> {
  const body = await api.post<JsonObject>(`/channels/${encodeURIComponent(channelId)}/invites`, {});
  if (typeof body._id !== "string") throw new Error("创建邀请响应缺少邀请码");
  return body._id;
}

export async function searchMessages(
  api: ApiClient,
  channelId: string,
  query: string,
  before?: string
): Promise<JsonObject[]> {
  const body = await api.post<unknown>(`/channels/${encodeURIComponent(channelId)}/search`, {
    query,
    limit: 50,
    before,
    sort: "Latest",
    include_users: true,
  });
  if (Array.isArray(body)) return body.filter(isObject);
  if (isObject(body) && Array.isArray(body.messages)) return body.messages.filter(isObject);
  return [];
}

export async function fetchOlderMessages(
  api: ApiClient,
  channelId: string,
  before: string
): Promise<JsonObject[]> {
  const body = await api.get<unknown>(
    `/channels/${encodeURIComponent(channelId)}/messages?limit=50&before=${encodeURIComponent(before)}&include_users=true`
  );
  if (Array.isArray(body)) return body.filter(isObject);
  if (isObject(body) && Array.isArray(body.messages)) return body.messages.filter(isObject);
  return [];
}

export async function fetchDirectMessages(api: ApiClient): Promise<JsonObject[]> {
  const body = await api.get<unknown>("/users/dms");
  return Array.isArray(body) ? body.filter(isObject) : [];
}

export async function openDirectMessage(api: ApiClient, userId: string): Promise<JsonObject> {
  const body = await api.get<unknown>(`/users/${encodeURIComponent(userId)}/dm`);
  if (!isObject(body)) throw new Error("打开私信响应无效");
  return body;
}

export async function sendFriendRequest(api: ApiClient, username: string): Promise<JsonObject> {
  const body = await api.post<unknown>("/users/friend", { username });
  if (!isObject(body)) throw new Error("好友请求响应无效");
  return body;
}

export async function acceptFriendRequest(api: ApiClient, userId: string): Promise<JsonObject> {
  const body = await api.put<unknown>(`/users/${encodeURIComponent(userId)}/friend`);
  if (!isObject(body)) throw new Error("接受好友请求响应无效");
  return body;
}

export async function removeOrDenyFriend(api: ApiClient, userId: string): Promise<JsonObject> {
  const body = await api.delete<unknown>(`/users/${encodeURIComponent(userId)}/friend`);
  if (!isObject(body)) throw new Error("处理好友请求响应无效");
  return body;
}

export async function updateServer(api: ApiClient, serverId: string, changes: JsonObject): Promise<JsonObject> {
  const body = await api.patch<unknown>(`/servers/${encodeURIComponent(serverId)}`, changes);
  if (!isObject(body)) throw new Error("服务器更新响应无效");
  return body;
}

export async function deleteOrLeaveServer(api: ApiClient, serverId: string): Promise<void> {
  await api.delete(`/servers/${encodeURIComponent(serverId)}`);
}

export function isAlreadyInServer(error: unknown): boolean {
  return error instanceof ApiError && JSON.stringify(error.body).includes("AlreadyInServer");
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}
