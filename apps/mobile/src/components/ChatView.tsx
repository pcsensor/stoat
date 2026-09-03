import { useEffect, useState, type RefObject } from "react";
import {
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboard } from "../hooks/useKeyboard";
import type { ChatMessage } from "../chat-model";
import { BrutalButton, BrutalInput, EmptyState, Label } from "../ui/primitives";
import { BORDER, PALETTE, SMALL_SHADOW } from "../ui/theme";
import { ImageViewerModal } from "./ImageViewerModal";
import { MarkdownText } from "./MarkdownText";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔"];

export interface PendingAttachmentView {
  id: string;
  url: string;
  filename?: string;
  progress?: number;
  uploading?: boolean;
}

export interface ReplyingTarget {
  id: string;
  author: string;
  content: string;
}

export function ChatView({
  channelName,
  messages,
  draft,
  pending,
  actionFor,
  editText,
  replyingTo,
  busy,
  loadingOlder,
  hasMore = true,
  searching,
  searchQuery,
  listRef,
  onDraft,
  onSend,
  onPickImage,
  onRemoveAttachment,
  onLongPress,
  onReact,
  onEditText,
  onEdit,
  onDelete,
  onCancelAction,
  onReply,
  onCancelReply,
  onLoadOlder,
  onToggleSearch,
  onSearchQuery,
  onSearch,
  resolveMention,
}: {
  channelName: string;
  messages: ChatMessage[];
  draft: string;
  pending: PendingAttachmentView[];
  actionFor: string | null;
  editText: string;
  replyingTo: ReplyingTarget | null;
  busy: boolean;
  loadingOlder: boolean;
  hasMore?: boolean;
  searching: boolean;
  searchQuery: string;
  listRef: RefObject<FlatList<ChatMessage> | null>;
  onDraft: (value: string) => void;
  onSend: () => void;
  onPickImage: () => void;
  onRemoveAttachment: (id: string) => void;
  onLongPress: (message: ChatMessage) => void;
  onReact: (id: string, emoji: string) => void;
  onEditText: (value: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onCancelAction: () => void;
  onReply: (message: ChatMessage) => void;
  onCancelReply: () => void;
  onLoadOlder: () => void;
  onToggleSearch: () => void;
  onSearchQuery: (value: string) => void;
  onSearch: () => void;
  resolveMention?: (userId: string) => string | undefined;
}) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const bottomInset = Platform.OS === "android" ? 0 : Math.max(0, keyboardHeight - insets.bottom);

  useEffect(() => {
    if (keyboardHeight > 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [keyboardHeight, listRef]);

  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      <View style={styles.tools}>
        <View style={styles.channelIntro}>
          <Label color={PALETTE.pink}>TEXT CHANNEL</Label>
          <Text style={styles.channelTitle}>#{channelName}</Text>
        </View>
        <BrutalButton
          label={searching ? "关闭搜索" : "搜索"}
          compact
          tone={searching ? "coral" : "paper"}
          onPress={onToggleSearch}
        />
      </View>
      {searching ? (
        <View style={styles.searchRow}>
          <BrutalInput
            value={searchQuery}
            onChangeText={onSearchQuery}
            placeholder="搜索消息…"
            style={styles.searchInput}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
          <BrutalButton label="GO" compact tone="cyan" disabled={!searchQuery.trim()} busy={busy} onPress={onSearch} />
        </View>
      ) : null}
      {messages.length ? (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <BrutalButton
              label={loadingOlder ? "读取中…" : !hasMore ? "已显示全部历史消息" : "↑ 读取更早消息"}
              compact
              tone="paper"
              disabled={loadingOlder || !hasMore}
              onPress={onLoadOlder}
              style={styles.loadOlder}
            />
          }
          renderItem={({ item, index }) =>
            item.isSystem ? (
              <View key={item.id} style={styles.systemWrap}>
                <View style={styles.systemBadge}>
                  <Text style={styles.systemText}>{item.content}</Text>
                  <Text style={styles.systemTime}>{item.time}</Text>
                </View>
              </View>
            ) : (
              <MessageBubble
                message={item}
                index={index}
                expanded={actionFor === item.id}
                editText={editText}
                onLongPress={onLongPress}
                onReact={onReact}
                onEditText={onEditText}
                onEdit={onEdit}
                onDelete={onDelete}
                onCancel={onCancelAction}
                onReply={onReply}
                onOpenImage={(url) => setActiveImageUrl(url)}
                resolveMention={resolveMention}
              />
            )
          }
        />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState symbol="#" title="从第一句话开始" body="这里还没有消息。说点什么，让频道活起来。" />
        </View>
      )}
      {pending.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pendingStrip}
          contentContainerStyle={styles.pendingContent}
        >
          {pending.map((attachment) => (
            <Pressable
              key={attachment.id}
              onPress={() => !attachment.uploading && onRemoveAttachment(attachment.id)}
              style={styles.pendingItem}
            >
              <Image source={{ uri: attachment.url }} style={styles.pendingImage} resizeMethod="resize" />
              <View style={styles.pendingCaption}>
                <Text style={styles.pendingText} numberOfLines={1}>
                  {attachment.uploading
                    ? `上传 ${Math.round((attachment.progress ?? 0) * 100)}%`
                    : attachment.filename ?? "图片已就绪"}
                </Text>
                {!attachment.uploading ? <Text style={styles.pendingRemove}>点击移除</Text> : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {replyingTo ? (
        <View style={styles.replyBar}>
          <Text style={styles.replyBarText} numberOfLines={1}>
            <Text style={styles.replyBarLead}>↩ 回复 </Text>@{replyingTo.author}: {replyingTo.content}
          </Text>
          <Pressable onPress={onCancelReply} style={styles.replyCancelBtn}>
            <Text style={styles.replyCancelText}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <BrutalButton label="＋" compact tone="pink" disabled={busy} onPress={onPickImage} style={styles.attachButton} />
        <BrutalInput
          value={draft}
          onChangeText={onDraft}
          placeholder={`发送到 #${channelName}`}
          multiline
          style={styles.composerInput}
        />
        <BrutalButton
          label="发送"
          compact
          tone="acid"
          disabled={
            busy ||
            pending.some((item) => item.uploading) ||
            (!draft.trim() && !pending.some((item) => !item.uploading))
          }
          onPress={onSend}
        />
      </View>
      <ImageViewerModal url={activeImageUrl} onClose={() => setActiveImageUrl(null)} />
    </View>
  );
}

function MessageBubble({
  message,
  index,
  expanded,
  editText,
  onLongPress,
  onReact,
  onEditText,
  onEdit,
  onDelete,
  onCancel,
  onReply,
  onOpenImage,
  resolveMention,
}: {
  message: ChatMessage;
  index: number;
  expanded: boolean;
  editText: string;
  onLongPress: (message: ChatMessage) => void;
  onReact: (id: string, emoji: string) => void;
  onEditText: (value: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
  onReply: (message: ChatMessage) => void;
  onOpenImage: (url: string) => void;
  resolveMention?: (userId: string) => string | undefined;
}) {
  const color = message.mine ? PALETTE.acid : index % 2 ? PALETTE.white : PALETTE.paperDeep;
  return (
    <View style={[styles.message, message.mine && styles.messageMine]}>
      <View style={styles.messageMetaRow}>
        <Text style={styles.messageAuthor}>{message.author}</Text>
        <Text style={styles.messageTime}>{message.time}</Text>
        {message.mine ? <Text style={styles.youTag}>YOU</Text> : null}
      </View>
      <Pressable
        onLongPress={() => onLongPress(message)}
        delayLongPress={350}
        style={[styles.messageBody, { backgroundColor: color }]}
      >
        {message.replyPreview ? (
          <View style={styles.replyQuote}>
            <Text style={styles.replyQuoteAuthor}>
              ↩ @{message.replyPreview.author}:{message.replyPreviews && message.replyPreviews.length > 1 ? `（等${message.replyPreviews.length}条引用）` : ""}
            </Text>
            <Text style={styles.replyQuoteText} numberOfLines={1}>
              {message.replyPreview.content}
            </Text>
          </View>
        ) : null}
        {message.content ? (
          <MarkdownText content={message.content} resolveMention={resolveMention} />
        ) : null}
        {message.attachments.length ? (
          <View style={styles.attachments}>
            {message.attachments.map((attachment) =>
              attachment.isImage ? (
                <Pressable key={attachment.id} onPress={() => onOpenImage(attachment.url)}>
                  <Image source={{ uri: attachment.url }} style={styles.messageImage} resizeMode="cover" resizeMethod="resize" />
                </Pressable>
              ) : (
                <View key={attachment.id} style={styles.fileCard}>
                  <Text style={styles.fileIcon}>↧</Text>
                  <Text style={styles.fileName}>{attachment.filename ?? attachment.id}</Text>
                </View>
              )
            )}
          </View>
        ) : null}
      </Pressable>
      {message.reactions.length ? (
        <View style={styles.reactions}>
          {message.reactions.map(([emoji, count, reactedByMe]) => (
            <Pressable
              key={emoji}
              onPress={() => onReact(message.id, emoji)}
              style={[styles.reaction, reactedByMe && styles.reactionMine]}
            >
              <Text style={styles.reactionText}>
                {emoji} {count}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {expanded ? (
        <View style={styles.actions}>
          <Text style={styles.actionHint}>快捷反应</Text>
          <View style={styles.emojiRow}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable key={emoji} onPress={() => onReact(message.id, emoji)} style={styles.emoji}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actionButtonRow}>
            <BrutalButton
              label="↩ 引用回复"
              compact
              tone="violet"
              onPress={() => onReply(message)}
              style={styles.actionButton}
            />
            {message.mine ? (
              <BrutalButton
                label="删除"
                compact
                tone="coral"
                onPress={() => onDelete(message.id)}
                style={styles.actionButton}
              />
            ) : null}
          </View>
          {message.mine ? (
            <>
              <BrutalInput value={editText} onChangeText={onEditText} placeholder="编辑消息" multiline />
              <BrutalButton
                label="保存编辑"
                compact
                tone="cyan"
                disabled={!editText.trim()}
                onPress={() => onEdit(message.id, editText)}
              />
            </>
          ) : null}
          <BrutalButton label="取消" compact tone="paper" onPress={onCancel} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.paper },
  tools: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 14,
    borderBottomWidth: BORDER,
    borderBottomColor: PALETTE.ink,
    backgroundColor: PALETTE.violet,
  },
  channelIntro: { flex: 1, alignItems: "flex-start" },
  channelTitle: { color: PALETTE.white, fontSize: 25, fontWeight: "900", marginTop: 4 },
  searchRow: {
    flexDirection: "row",
    gap: 9,
    padding: 11,
    borderBottomWidth: BORDER,
    borderBottomColor: PALETTE.ink,
    backgroundColor: PALETTE.cyan,
  },
  searchInput: { flex: 1, minHeight: 42, paddingVertical: 7 },
  list: { padding: 13, paddingBottom: 28 },
  loadOlder: { marginHorizontal: 34, marginBottom: 20 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  message: { marginBottom: 18, alignItems: "flex-start" },
  messageMine: { alignItems: "flex-end" },
  messageMetaRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
  messageAuthor: { color: PALETTE.ink, fontSize: 12, fontWeight: "900" },
  messageTime: { color: PALETTE.muted, fontSize: 10, fontWeight: "700" },
  youTag: {
    color: PALETTE.ink,
    backgroundColor: PALETTE.pink,
    borderWidth: 1,
    borderColor: PALETTE.ink,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 8,
    fontWeight: "900",
  },
  messageBody: {
    maxWidth: "91%",
    minWidth: 70,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    padding: 11,
    ...SMALL_SHADOW,
  },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: PALETTE.ink,
    paddingLeft: 7,
    marginBottom: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingVertical: 3,
  },
  replyQuoteAuthor: {
    fontSize: 11,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  replyQuoteText: {
    fontSize: 11,
    color: PALETTE.muted,
    fontWeight: "600",
  },
  attachments: { gap: 8, marginTop: 8 },
  messageImage: {
    width: 220,
    maxWidth: "100%",
    height: 170,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.fog,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.cyan,
    padding: 9,
  },
  fileIcon: { color: PALETTE.ink, fontWeight: "900", fontSize: 19 },
  fileName: { color: PALETTE.ink, fontWeight: "800" },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  reaction: {
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionMine: { backgroundColor: PALETTE.pink, ...SMALL_SHADOW, marginRight: 2, marginBottom: 2 },
  reactionText: { color: PALETTE.ink, fontWeight: "800", fontSize: 12 },
  actions: {
    width: "96%",
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.amber,
    padding: 10,
    gap: 9,
    marginTop: 10,
    ...SMALL_SHADOW,
  },
  actionHint: { color: PALETTE.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  emoji: {
    width: 40,
    height: 38,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 18 },
  actionButtonRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1 },
  pendingStrip: {
    flexGrow: 0,
    maxHeight: 98,
    borderTopWidth: BORDER,
    borderTopColor: PALETTE.ink,
    backgroundColor: PALETTE.pink,
  },
  pendingContent: { padding: 9, gap: 9 },
  pendingItem: {
    width: 150,
    height: 74,
    flexDirection: "row",
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
  },
  pendingImage: { width: 67, height: 70, borderRightWidth: 2, borderRightColor: PALETTE.ink },
  pendingCaption: { flex: 1, padding: 6, justifyContent: "center" },
  pendingText: { color: PALETTE.ink, fontSize: 10, fontWeight: "900" },
  pendingRemove: { color: PALETTE.muted, fontSize: 9, fontWeight: "700", marginTop: 4 },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: BORDER,
    borderTopColor: PALETTE.ink,
    backgroundColor: PALETTE.amber,
  },
  replyBarText: { flex: 1, fontSize: 12, fontWeight: "800", color: PALETTE.ink },
  replyBarLead: { fontWeight: "900", color: PALETTE.ink },
  replyCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    marginLeft: 8,
  },
  replyCancelText: { fontSize: 14, fontWeight: "900", color: PALETTE.ink },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    borderTopWidth: BORDER,
    borderTopColor: PALETTE.ink,
    backgroundColor: PALETTE.paperDeep,
  },
  attachButton: { width: 43, paddingHorizontal: 0 },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 110, paddingVertical: 8 },
  systemWrap: {
    alignItems: "center",
    marginVertical: 10,
    paddingHorizontal: 16,
  },
  systemBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: PALETTE.paperDeep,
    borderWidth: 1.5,
    borderColor: PALETTE.ink,
    borderRadius: 20,
    ...SMALL_SHADOW,
  },
  systemText: {
    fontSize: 12,
    fontWeight: "700",
    color: PALETTE.ink,
  },
  systemTime: {
    fontSize: 10,
    fontWeight: "600",
    color: PALETTE.muted,
  },
});
