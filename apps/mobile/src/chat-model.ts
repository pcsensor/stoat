import type { Message as SDKMessage } from "stoat.js";

export interface ChatAttachment {
  id: string;
  url: string;
  isImage: boolean;
  filename?: string;
}

export interface ReplyPreview {
  id: string;
  author: string;
  content: string;
}

export interface ChatMessage {
  id: string;
  author: string;
  authorId?: string;
  content: string;
  mine: boolean;
  time: string;
  reactions: Array<[emoji: string, count: number, reactedByMe: boolean]>;
  attachments: ChatAttachment[];
  replyIds?: string[];
  /** 首条引用的预览（兼容旧 UI）。 */
  replyPreview?: ReplyPreview;
  /** 全部引用的预览，与 replyIds 一一对应；缺失的消息用占位表示。 */
  replyPreviews?: ReplyPreview[];
  isSystem?: boolean;
}

/**
 * 消息时间：当天只显示时分，跨天带上月日，跨年再带年份。
 * 之前只显示时分，隔夜消息无法区分日期。
 */
export function formatMessageTime(createdAt: string | number | Date): string {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function formatSystemEvent(
  message: SDKMessage,
  resolveUser?: (id: string) => { username?: string } | undefined
): string | null {
  const sys = message.systemMessage as any;
  const rawSys = (message as any).system ?? (message as any)._system;
  const event = sys ?? (typeof rawSys === "object" ? rawSys : null);

  if (!event && typeof rawSys === "string") {
    return rawSys;
  }
  if (!event) {
    // 兼容旧实例：系统消息可能以保留账号直接下发。新实例以 systemMessage 标记为准；
    // 这里只认保留 ID，不再以用户名判断，避免冒名用户伪造系统横幅。
    if (message.authorId === "00000000000000000000000000") {
      if (message.content) return message.content;
      return "系统通知";
    }
    return null;
  }

  const type = event.type;
  const getUserName = (id?: string) => {
    if (!id) return "用户";
    return resolveUser?.(id)?.username ?? id;
  };

  switch (type) {
    case "user_joined": {
      const name = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `👉 @${name} 加入了服务器`;
    }
    case "user_left": {
      const name = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `👈 @${name} 离开了服务器`;
    }
    case "user_kicked": {
      const name = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `🚫 @${name} 被移出服务器`;
    }
    case "user_banned": {
      const name = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `⛔ @${name} 被封禁`;
    }
    case "user_added": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      const target = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `👉 @${by} 将 @${target} 添加到频道`;
    }
    case "user_remove": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      const target = event.user?.username ?? getUserName(event.userId ?? event.id);
      return `👈 @${by} 将 @${target} 移出频道`;
    }
    case "channel_renamed": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      const name = event.name ?? "频道";
      return `✏️ @${by} 将频道重命名为 "${name}"`;
    }
    case "channel_description_changed": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      return `📝 @${by} 修改了频道描述`;
    }
    case "channel_icon_changed": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      return `🖼️ @${by} 修改了频道图标`;
    }
    case "channel_ownership_changed": {
      return "👑 频道所有权已移交";
    }
    case "message_pinned": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      return `📌 @${by} 置顶了一条消息`;
    }
    case "message_unpinned": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      return `📌 @${by} 取消了一条置顶消息`;
    }
    case "call_started": {
      const by = event.by?.username ?? getUserName(event.byId ?? event.by);
      return `📞 @${by} 发起了语音通话`;
    }
    case "text": {
      return event.content ?? "系统通知";
    }
    default:
      return `${type ?? "系统"} 通知`;
  }
}

export function toChatMessage(
  message: SDKMessage,
  myUserId?: string,
  resolveMessage?: (id: string) => SDKMessage | undefined,
  resolveUser?: (id: string) => { username?: string } | undefined
): ChatMessage {
  const systemText = formatSystemEvent(message, resolveUser);
  const isSystem = Boolean(systemText);
  const replyIds = message.replyIds ?? [];
  const replyPreviews: ReplyPreview[] | undefined = replyIds.length
    ? replyIds.map((replyId) => {
        const referenced = resolveMessage?.(replyId);
        if (referenced) {
          return {
            id: replyId,
            author: referenced.author?.username ?? referenced.authorId ?? "用户",
            content: referenced.content || (referenced.attachments?.length ? "[附件]" : "[消息]"),
          };
        }
        return { id: replyId, author: "引用消息", content: "..." };
      })
    : undefined;

  return {
    id: message.id,
    author: isSystem ? "系统" : (message.author?.username ?? message.authorId ?? "未知用户"),
    authorId: message.authorId,
    content: isSystem ? systemText! : message.content,
    mine: !isSystem && message.authorId === myUserId,
    time: formatMessageTime(message.createdAt),
    reactions: reactionsOf(message, myUserId),
    attachments: (message.attachments ?? []).map((file) => ({
      id: file.id,
      url: file.previewUrl,
      isImage: (file.contentType ?? "").startsWith("image/"),
      filename: file.filename,
    })),
    replyIds: replyIds.length ? replyIds : undefined,
    replyPreview: replyPreviews?.[0],
    replyPreviews,
    isSystem,
  };
}

export function reactionsOf(message: SDKMessage, myUserId?: string): ChatMessage["reactions"] {
  return [...message.reactions.entries()].map(([emoji, users]) => [
    emoji,
    users.size,
    Boolean(myUserId && users.has(myUserId)),
  ]);
}
