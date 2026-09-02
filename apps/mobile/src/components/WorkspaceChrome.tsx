import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Channel as SDKChannel, Server as SDKServer, User as SDKUser } from "stoat.js";
import { useKeyboard } from "../hooks/useKeyboard";
import { BrutalButton, BrutalCard, BrutalInput, EmptyState, Label, SectionTitle } from "../ui/primitives";
import { BORDER, PALETTE, SMALL_SHADOW } from "../ui/theme";

export type ActionModalKind = "server" | "channel" | "friend" | "server_settings" | null;

export function ServerRail({
  servers,
  selectedId,
  onHome,
  onSelect,
  onAdd,
}: {
  servers: SDKServer[];
  selectedId: string | null;
  onHome: () => void;
  onSelect: (server: SDKServer) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.railWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        <Pressable onPress={onHome} style={[styles.railItem, styles.homeItem, selectedId === null && styles.railSelected]}>
          <Text style={styles.homeText}>R!</Text>
        </Pressable>
        {servers.map((server, index) => (
          <Pressable
            key={server.id}
            onPress={() => onSelect(server)}
            style={[styles.railItem, { backgroundColor: serverColor(index) }, selectedId === server.id && styles.railSelected]}
          >
            <Text style={styles.railText}>{server.name.slice(0, 2).toUpperCase()}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onAdd} style={[styles.railItem, styles.addItem]}>
          <Text style={styles.addText}>＋</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function WorkspaceHeader({
  server,
  channel,
  userName,
  instanceLabel,
  voiceActive,
  muted,
  onOpenChannels,
  onOpenServerSettings,
  onToggleMute,
  onLeaveVoice,
  onOpenActivity,
  onLogout,
}: {
  server?: SDKServer;
  channel?: SDKChannel;
  userName: string;
  instanceLabel: string;
  voiceActive: boolean;
  muted: boolean;
  onOpenChannels: () => void;
  onOpenServerSettings: () => void;
  onToggleMute: () => void;
  onLeaveVoice: () => void;
  onOpenActivity: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.header}>
      {server ? (
        <Pressable onPress={onOpenChannels} style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
      ) : null}
      <View style={styles.headerCopy}>
        <Text style={styles.headerKicker}>{server ? server.name.toUpperCase() : "RADIO HOME"}</Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {channel
            ? `${channel.isVoice && channel.type !== "DirectMessage" ? "◉" : channel.type === "DirectMessage" ? "↗" : "#"} ${
                channel.displayName ?? channel.name ?? "私信"
              }`
            : server
            ? "选择频道"
            : "你的社区中心"}
        </Text>
        <Text style={styles.instanceText} numberOfLines={1}>
          {userName} · {instanceLabel}
        </Text>
      </View>
      {server ? (
        <Pressable onPress={onOpenServerSettings} style={[styles.headerIconButton, { backgroundColor: PALETTE.paperDeep }]}>
          <Text style={styles.headerIconText}>⚙</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onOpenActivity} style={styles.headerIconButton}>
        <Text style={styles.headerIconText}>↯</Text>
      </Pressable>
      {voiceActive ? (
        <>
          <Pressable
            onPress={onToggleMute}
            style={[styles.headerIconButton, { backgroundColor: muted ? PALETTE.amber : PALETTE.cyan }]}
          >
            <Text style={styles.headerIconText}>{muted ? "×" : "●"}</Text>
          </Pressable>
          <Pressable onPress={onLeaveVoice} style={[styles.headerIconButton, { backgroundColor: PALETTE.coral }]}>
            <Text style={[styles.headerIconText, { color: PALETTE.white }]}>↘</Text>
          </Pressable>
        </>
      ) : (
        <Pressable accessibilityLabel="退出登录" onPress={onLogout} style={styles.headerIconButton}>
          <Text style={styles.headerIconText}>↪</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HomeDashboard({
  servers,
  directMessages = [],
  socialUsers = [],
  onSelect,
  onOpenActions,
  onOpenDM = () => undefined,
  onOpenUserDM = () => undefined,
  onAcceptFriend = () => undefined,
  onDenyFriend = () => undefined,
  onRemoveFriend = () => undefined,
  onOpenFriendActions = () => undefined,
  serverMode = false,
}: {
  servers: SDKServer[];
  directMessages?: SDKChannel[];
  socialUsers?: SDKUser[];
  onSelect: (server: SDKServer) => void;
  onOpenActions: () => void;
  onOpenDM?: (channel: SDKChannel) => void;
  onOpenUserDM?: (user: SDKUser) => void;
  onAcceptFriend?: (user: SDKUser) => void;
  onDenyFriend?: (user: SDKUser) => void;
  onRemoveFriend?: (user: SDKUser) => void;
  onOpenFriendActions?: () => void;
  serverMode?: boolean;
}) {
  return (
    <FlatList
      data={servers}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.homeList}
      ListHeaderComponent={
        <View style={styles.homeHero}>
          <Label color={PALETTE.pink}>{serverMode ? "SERVER LOBBY" : "COMMUNITY SWITCHBOARD"}</Label>
          <Text style={styles.homeHeadline}>{serverMode ? "挑个频道，\n开始聊天。" : `去哪儿\n聊两句？`}</Text>
          <Text style={styles.homeSub}>
            {serverMode
              ? "文字频道负责沉淀内容，语音频道适合马上碰头。打开频道列表继续。"
              : "服务器像社区，频道像房间。选择一个已有社区，或者带着邀请码加入新的据点。"}
          </Text>
          <BrutalButton
            label={serverMode ? "☰ 打开 / 创建频道" : "＋ 新建 / 加入服务器"}
            tone="acid"
            onPress={onOpenActions}
            style={styles.homeAction}
          />
          {!serverMode ? (
            <View style={styles.socialBlock}>
              <View style={styles.socialHeader}>
                <SectionTitle kicker="Direct messages" title="私信与好友" aside={`${directMessages.length} 个会话`} />
                <BrutalButton label="＋ 好友" compact tone="pink" onPress={onOpenFriendActions} />
              </View>
              {directMessages.length ? (
                directMessages.map((channel) => (
                  <Pressable key={channel.id} onPress={() => onOpenDM(channel)} style={styles.dmRow}>
                    <View style={styles.dmAvatar}>
                      <Text style={styles.dmAvatarText}>{(channel.displayName ?? "DM").slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.dmCopy}>
                      <Text style={styles.dmName}>{channel.displayName ?? "私信"}</Text>
                      <Text style={styles.dmMeta}>点击继续私信</Text>
                    </View>
                    <Text style={styles.dmArrow}>→</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.socialEmpty}>还没有私信，先添加一个好友。</Text>
              )}
              {socialUsers.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                  {socialUsers.map((user) => (
                    <View key={user.id} style={styles.personCard}>
                      <Text style={styles.personName} numberOfLines={1}>
                        {user.username}
                      </Text>
                      <Text style={styles.personRelation}>{relationshipLabel(user.relationship)}</Text>
                      {user.relationship === "Incoming" ? (
                        <View style={styles.personActionRow}>
                          <BrutalButton label="接受" compact tone="cyan" onPress={() => onAcceptFriend(user)} style={{ flex: 1 }} />
                          <BrutalButton label="拒绝" compact tone="coral" onPress={() => onDenyFriend(user)} style={{ flex: 1 }} />
                        </View>
                      ) : user.relationship === "Outgoing" ? (
                        <View style={styles.personActionRow}>
                          <BrutalButton label="取消" compact tone="paper" onPress={() => onDenyFriend(user)} style={{ flex: 1 }} />
                        </View>
                      ) : (
                        <View style={styles.personActionRow}>
                          <BrutalButton label="私信" compact tone="cyan" onPress={() => onOpenUserDM(user)} style={{ flex: 1 }} />
                          <BrutalButton label="解除" compact tone="paper" onPress={() => onRemoveFriend(user)} style={{ flex: 1 }} />
                        </View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}
          <SectionTitle
            kicker={serverMode ? "Current space" : "Your spaces"}
            title={serverMode ? "当前服务器" : "你的服务器"}
            aside={`${servers.length} 个`}
          />
        </View>
      }
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => onSelect(item)}
          style={({ pressed }) => [styles.serverCardPress, pressed && styles.cardPressed]}
        >
          <BrutalCard color={serverColor(index)} style={styles.serverCard}>
            <View style={styles.serverMonogram}>
              <Text style={styles.serverMonogramText}>{item.name.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View style={styles.serverCardCopy}>
              <Text style={styles.serverCardName}>{item.name}</Text>
              <Text style={styles.serverCardMeta}>{item.channelIds.size} 个频道 · 点击进入</Text>
            </View>
            <Text style={styles.serverArrow}>→</Text>
          </BrutalCard>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListEmptyComponent={<EmptyState symbol="⌁" title="还没有服务器" body="创建一个社区，或使用朋友发来的邀请码加入。" />}
    />
  );
}

export function ChannelDrawer({
  visible,
  server,
  channels,
  selectedId,
  busy,
  onClose,
  onSelect,
  onCreate,
  onDeleteChannel,
  onHome,
}: {
  visible: boolean;
  server?: SDKServer;
  channels: SDKChannel[];
  selectedId: string | null;
  busy: boolean;
  onClose: () => void;
  onSelect: (channel: SDKChannel) => void;
  onCreate: () => void;
  onDeleteChannel?: (channel: SDKChannel) => void;
  onHome: () => void;
}) {
  const textChannels = channels.filter((channel) => !channel.isVoice || channel.type === "DirectMessage");
  const voiceChannels = channels.filter((channel) => channel.isVoice && channel.type !== "DirectMessage");
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.drawerOverlay}>
        <Pressable style={styles.drawerDismiss} onPress={onClose} />
        <View style={styles.drawer}>
          <View style={styles.drawerTop}>
            <View style={styles.drawerTitleCopy}>
              <Text style={styles.drawerKicker}>SERVER</Text>
              <Text style={styles.drawerTitle} numberOfLines={2}>
                {server?.name ?? "服务器"}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeSquare}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.drawerList}>
            <ChannelSection
              title="文字频道"
              symbol="#"
              channels={textChannels}
              selectedId={selectedId}
              onSelect={onSelect}
              onDeleteChannel={onDeleteChannel}
            />
            <ChannelSection
              title="语音频道"
              symbol="◉"
              channels={voiceChannels}
              selectedId={selectedId}
              onSelect={onSelect}
              onDeleteChannel={onDeleteChannel}
            />
          </ScrollView>
          <View style={styles.drawerActions}>
            <BrutalButton label="＋ 新频道" compact tone="cyan" busy={busy} onPress={onCreate} />
            <BrutalButton label="← 社区首页" compact tone="paper" onPress={onHome} />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function ChannelSection({
  title,
  symbol,
  channels,
  selectedId,
  onSelect,
  onDeleteChannel,
}: {
  title: string;
  symbol: string;
  channels: SDKChannel[];
  selectedId: string | null;
  onSelect: (channel: SDKChannel) => void;
  onDeleteChannel?: (channel: SDKChannel) => void;
}) {
  return (
    <View style={styles.channelSection}>
      <Text style={styles.channelSectionTitle}>{title.toUpperCase()}</Text>
      {channels.length ? (
        channels.map((channel) => (
          <View key={channel.id} style={[styles.channelRowWrap, selectedId === channel.id && styles.channelSelected]}>
            <Pressable onPress={() => onSelect(channel)} style={styles.channelRow}>
              <Text style={styles.channelSymbol}>{symbol}</Text>
              <Text style={styles.channelName} numberOfLines={1}>
                {channel.name}
              </Text>
            </Pressable>
            {onDeleteChannel ? (
              <Pressable
                onPress={() => onDeleteChannel(channel)}
                style={styles.channelDelBtn}
                hitSlop={6}
              >
                <Text style={styles.channelDelText}>×</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      ) : (
        <Text style={styles.noChannels}>暂无频道</Text>
      )}
    </View>
  );
}

export function WorkspaceActionModal({
  kind,
  busy,
  server,
  isOwner = false,
  onClose,
  onCreateServer,
  onJoinServer,
  onCreateChannel,
  onAddFriend,
  onUpdateServer,
  onDeleteServer,
  onLeaveServer,
}: {
  kind: ActionModalKind;
  busy: boolean;
  server?: SDKServer;
  isOwner?: boolean;
  onClose: () => void;
  onCreateServer: (name: string) => void;
  onJoinServer: (code: string) => void;
  onCreateChannel: (type: "Text" | "Voice", name: string) => void;
  onAddFriend: (username: string) => void;
  onUpdateServer?: (name: string) => void;
  onDeleteServer?: () => void;
  onLeaveServer?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const scrollRef = useRef<ScrollView>(null);

  const [serverName, setServerName] = useState(server?.name ?? "");
  const [inviteCode, setInviteCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"Text" | "Voice">("Text");
  const [friendName, setFriendName] = useState("");

  if (!kind) return null;

  const bottomInset = keyboardHeight > 0
    ? (Platform.OS === "android" ? keyboardHeight : Math.max(0, keyboardHeight - insets.bottom))
    : insets.bottom;

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.sheetOverlay, { paddingBottom: bottomInset }]}>
        <Pressable style={styles.sheetDismiss} onPress={onClose} />
        <BrutalCard
          color={
            kind === "server"
              ? PALETTE.acid
              : kind === "friend"
              ? PALETTE.pink
              : kind === "server_settings"
              ? PALETTE.amber
              : PALETTE.cyan
          }
          style={[
            styles.sheet,
            { maxHeight: Dimensions.get("window").height - (keyboardHeight > 0 ? bottomInset + insets.top + 20 : insets.top + 60) },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              {kind === "server"
                ? "社区入口"
                : kind === "friend"
                ? "添加好友"
                : kind === "server_settings"
                ? "服务器设置"
                : "创建频道"}
            </Text>
            <Pressable onPress={onClose} style={styles.closeSquare}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetScrollContent}
          >
            {kind === "server" ? (
              <>
                <Text style={styles.sheetLabel}>新建服务器</Text>
                <BrutalInput
                  value={serverName}
                  onChangeText={setServerName}
                  placeholder="服务器名称"
                  onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                />
                <BrutalButton
                  label="创建服务器"
                  tone="violet"
                  disabled={!serverName.trim()}
                  busy={busy}
                  onPress={() => onCreateServer(serverName.trim())}
                />
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>或者</Text>
                  <View style={styles.orLine} />
                </View>
                <Text style={styles.sheetLabel}>使用邀请码加入</Text>
                <BrutalInput
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="邀请码"
                  autoCapitalize="none"
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                />
                <BrutalButton
                  label="加入服务器"
                  tone="coral"
                  disabled={!inviteCode.trim()}
                  busy={busy}
                  onPress={() => onJoinServer(inviteCode.trim())}
                />
              </>
            ) : kind === "channel" ? (
              <>
                <View style={styles.typeRow}>
                  <BrutalButton
                    label="# 文字"
                    compact
                    tone={channelType === "Text" ? "violet" : "paper"}
                    onPress={() => setChannelType("Text")}
                    style={styles.typeButton}
                  />
                  <BrutalButton
                    label="◉ 语音"
                    compact
                    tone={channelType === "Voice" ? "coral" : "paper"}
                    onPress={() => setChannelType("Voice")}
                    style={styles.typeButton}
                  />
                </View>
                <Text style={styles.sheetLabel}>频道名称</Text>
                <BrutalInput
                  value={channelName}
                  onChangeText={setChannelName}
                  placeholder={channelType === "Text" ? "例如：聊天大厅" : "例如：一起摸鱼"}
                />
                <BrutalButton
                  label={`创建${channelType === "Text" ? "文字" : "语音"}频道`}
                  tone="acid"
                  disabled={!channelName.trim()}
                  busy={busy}
                  onPress={() => onCreateChannel(channelType, channelName.trim())}
                />
              </>
            ) : kind === "friend" ? (
              <>
                <Text style={styles.sheetLabel}>用户名与识别码</Text>
                <BrutalInput
                  value={friendName}
                  onChangeText={setFriendName}
                  placeholder="username#0000"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.friendHint}>使用 Web 端个人资料中的完整用户名，例如 alex#1234。</Text>
                <BrutalButton
                  label="发送好友请求"
                  tone="violet"
                  disabled={!friendName.includes("#")}
                  busy={busy}
                  onPress={() => onAddFriend(friendName.trim())}
                />
              </>
            ) : (
              <>
                <Text style={styles.sheetLabel}>服务器名称</Text>
                <BrutalInput value={serverName} onChangeText={setServerName} placeholder="修改服务器名称" />
                {onUpdateServer ? (
                  <BrutalButton
                    label="保存名称"
                    tone="cyan"
                    disabled={!serverName.trim()}
                    busy={busy}
                    onPress={() => onUpdateServer(serverName.trim())}
                  />
                ) : null}
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>危险区域</Text>
                  <View style={styles.orLine} />
                </View>
                {isOwner ? (
                  onDeleteServer ? (
                    <BrutalButton label="删除此服务器" tone="coral" busy={busy} onPress={onDeleteServer} />
                  ) : null
                ) : onLeaveServer ? (
                  <BrutalButton label="退出此服务器" tone="coral" busy={busy} onPress={onLeaveServer} />
                ) : null}
              </>
            )}
          </ScrollView>
        </BrutalCard>
      </View>
    </Modal>
  );
}

function serverColor(index: number) {
  return [PALETTE.violet, PALETTE.cyan, PALETTE.pink, PALETTE.amber, PALETTE.coral][index % 5];
}

function relationshipLabel(relationship: string) {
  if (relationship === "Friend") return "好友";
  if (relationship === "Incoming") return "等待你接受";
  if (relationship === "Outgoing") return "请求已发送";
  return relationship;
}

const styles = StyleSheet.create({
  railWrap: { borderBottomWidth: BORDER, borderBottomColor: PALETTE.ink, backgroundColor: PALETTE.paperDeep },
  rail: { paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  railItem: {
    width: 48,
    height: 48,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  railSelected: { transform: [{ rotate: "-4deg" }], ...SMALL_SHADOW },
  railText: { color: PALETTE.ink, fontWeight: "900", fontSize: 13 },
  homeItem: { backgroundColor: PALETTE.ink },
  homeText: { color: PALETTE.acid, fontWeight: "900", fontSize: 18 },
  addItem: { backgroundColor: PALETTE.white, borderStyle: "dashed" },
  addText: { color: PALETTE.ink, fontSize: 27, fontWeight: "700" },
  header: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: PALETTE.paper,
    borderBottomWidth: BORDER,
    borderBottomColor: PALETTE.ink,
  },
  menuButton: {
    width: 45,
    height: 45,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.acid,
    alignItems: "center",
    justifyContent: "center",
    ...SMALL_SHADOW,
  },
  menuIcon: { color: PALETTE.ink, fontSize: 22, fontWeight: "900" },
  headerCopy: { flex: 1 },
  headerKicker: { fontSize: 10, fontWeight: "900", color: PALETTE.muted, letterSpacing: 1.1 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: PALETTE.ink },
  instanceText: { fontSize: 11, fontWeight: "700", color: PALETTE.muted, marginTop: 2 },
  headerIconButton: {
    width: 42,
    height: 42,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
    ...SMALL_SHADOW,
  },
  headerIconText: { color: PALETTE.ink, fontSize: 19, fontWeight: "900" },
  homeList: { padding: 14, paddingBottom: 40 },
  homeHero: { gap: 8, marginBottom: 14 },
  homeHeadline: { color: PALETTE.ink, fontSize: 42, lineHeight: 42, fontWeight: "900", letterSpacing: -1.5 },
  homeSub: { color: PALETTE.muted, fontWeight: "700", lineHeight: 20, maxWidth: 520 },
  homeAction: { marginVertical: 10 },
  socialBlock: { gap: 9, marginTop: 6, marginBottom: 12 },
  socialHeader: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  socialEmpty: { color: PALETTE.muted, fontWeight: "700", paddingVertical: 8 },
  dmRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 3,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    padding: 8,
  },
  dmAvatar: {
    width: 42,
    height: 42,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  dmAvatarText: { color: PALETTE.ink, fontWeight: "900", fontSize: 11 },
  dmCopy: { flex: 1 },
  dmName: { color: PALETTE.ink, fontWeight: "900" },
  dmMeta: { color: PALETTE.muted, fontWeight: "700", fontSize: 10, marginTop: 2 },
  dmArrow: { color: PALETTE.ink, fontSize: 21, fontWeight: "900" },
  peopleRow: { gap: 9, paddingVertical: 3 },
  personCard: {
    width: 165,
    gap: 6,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.amber,
    padding: 9,
  },
  personName: { color: PALETTE.ink, fontWeight: "900" },
  personRelation: { color: PALETTE.ink, opacity: 0.65, fontWeight: "700", fontSize: 9 },
  personActionRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  serverCardPress: { marginRight: 5, marginBottom: 5 },
  cardPressed: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  serverCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13 },
  serverMonogram: {
    width: 46,
    height: 46,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    alignItems: "center",
    justifyContent: "center",
  },
  serverMonogramText: { color: PALETTE.ink, fontWeight: "900", fontSize: 16 },
  serverCardCopy: { flex: 1 },
  serverCardName: { color: PALETTE.ink, fontSize: 18, fontWeight: "900" },
  serverCardMeta: { color: PALETTE.ink, opacity: 0.75, fontSize: 11, fontWeight: "700", marginTop: 2 },
  serverArrow: { color: PALETTE.ink, fontSize: 24, fontWeight: "900" },
  drawerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row" },
  drawerDismiss: { flex: 1 },
  drawer: {
    width: "82%",
    maxWidth: 320,
    backgroundColor: PALETTE.paper,
    borderLeftWidth: BORDER,
    borderLeftColor: PALETTE.ink,
    padding: 14,
    gap: 12,
  },
  drawerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    borderBottomWidth: BORDER,
    borderBottomColor: PALETTE.ink,
    paddingBottom: 10,
  },
  drawerTitleCopy: { flex: 1, paddingRight: 8 },
  drawerKicker: { fontSize: 10, fontWeight: "900", color: PALETTE.muted, letterSpacing: 1 },
  drawerTitle: { fontSize: 20, fontWeight: "900", color: PALETTE.ink, marginTop: 2 },
  drawerList: { gap: 14, paddingVertical: 6 },
  channelSection: { gap: 6 },
  channelSectionTitle: { fontSize: 11, fontWeight: "900", color: PALETTE.muted, letterSpacing: 1 },
  channelRowWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    paddingRight: 6,
  },
  channelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 9,
  },
  channelSelected: { backgroundColor: PALETTE.acid },
  channelSymbol: { color: PALETTE.ink, fontWeight: "900", fontSize: 14 },
  channelName: { flex: 1, color: PALETTE.ink, fontWeight: "800", fontSize: 14 },
  channelDelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: PALETTE.coral,
    borderWidth: 1,
    borderColor: PALETTE.ink,
  },
  channelDelText: { color: PALETTE.white, fontSize: 14, fontWeight: "900" },
  noChannels: { color: PALETTE.muted, fontSize: 12, fontWeight: "700", paddingVertical: 4 },
  drawerActions: { borderTopWidth: BORDER, borderTopColor: PALETTE.ink, paddingTop: 10, gap: 8 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, gap: 10, padding: 18, borderBottomWidth: 0 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: PALETTE.ink },
  sheetLabel: { color: PALETTE.ink, fontWeight: "900", fontSize: 12, marginTop: 4 },
  closeSquare: {
    width: 38,
    height: 38,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.coral,
    alignItems: "center",
    justifyContent: "center",
    ...SMALL_SHADOW,
  },
  closeText: { color: PALETTE.white, fontSize: 22, fontWeight: "900", lineHeight: 22 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  orLine: { flex: 1, height: 2, backgroundColor: PALETTE.ink },
  orText: { color: PALETTE.ink, fontWeight: "900" },
  typeRow: { flexDirection: "row", gap: 10 },
  typeButton: { flex: 1 },
  friendHint: { color: PALETTE.ink, opacity: 0.7, fontWeight: "700", fontSize: 11, lineHeight: 16 },
  sheetScrollContent: { gap: 10, paddingBottom: 8 },
});
