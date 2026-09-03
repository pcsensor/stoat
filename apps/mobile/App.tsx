import "./shims/rn-platform";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus, FlatList, Linking, LogBox, PermissionsAndroid, Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { registerGlobals } from "@livekit/react-native";
import { RTCAudioSession } from "@livekit/react-native-webrtc";
import type { Channel as SDKChannel, Message as SDKMessage, Server as SDKServer, User as SDKUser } from "stoat.js";
import * as ImagePicker from "expo-image-picker";
import { discoverInstance, isSessionInvalidError, normalizeDomain, registerAccount } from "@radio/core";
import { ActivityDrawer, type ActivityLog } from "./src/components/ActivityDrawer";
import { ChatView, type PendingAttachmentView, type ReplyingTarget } from "./src/components/ChatView";
import { VoiceView } from "./src/components/VoiceView";
import {
  ChannelDrawer,
  HomeDashboard,
  ServerRail,
  WorkspaceActionModal,
  WorkspaceHeader,
  type ActionModalKind,
} from "./src/components/WorkspaceChrome";
import { AuthScreen, type AuthMode } from "./src/screens/AuthScreen";
import { uploadAttachment } from "./src/attachment-upload";
import { reactionsOf, toChatMessage, type ChatAttachment, type ChatMessage } from "./src/chat-model";
import { StoatSession } from "./src/session";
import { clearStoredSession, loadStoredSession, saveStoredSession } from "./src/session-store";
import {
  acceptFriendRequest,
  createChannel,
  createChannelInvite,
  createServer,
  createStoatApi,
  deleteChannel,
  deleteOrLeaveServer,
  getInvite,
  isAlreadyInServer,
  joinServer,
  openDirectMessage,
  removeOrDenyFriend,
  sendFriendRequest,
  updateServer,
} from "./src/stoat-api";
import { PALETTE } from "./src/ui/theme";
import { VoiceRoomController, type VoiceSnapshot } from "./src/voice-room";
import { micForeground } from "./modules/mic-foreground/src";

registerGlobals();

LogBox.ignoreLogs([
  "error reading from signal stream",
  /error reading from signal stream/i,
]);

type Screen = "auth" | "workspace";
type PendingAttachment = ChatAttachment & PendingAttachmentView;

export default function App() {
  const [screen, setScreen] = useState<Screen>("auth");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [revision, setRevision] = useState(0);
  const [serverId, setServerId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelDrawer, setChannelDrawer] = useState(false);
  const [activityDrawer, setActivityDrawer] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModalKind>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyingTarget | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [voice, setVoice] = useState<VoiceSnapshot>({ state: "idle", members: [], audioOutput: "speaker" });
  const inviteChannelRef = useRef<string | null>(null);

  const sessionRef = useRef<StoatSession | null>(null);
  const apiRef = useRef<ReturnType<typeof createStoatApi> | null>(null);
  const voiceRef = useRef<VoiceRoomController | null>(null);
  const voiceUnsubscribeRef = useRef<(() => void) | null>(null);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const channelIdRef = useRef<string | null>(null);
  const channelLoadRef = useRef(0);
  const logIdRef = useRef(0);
  const chatScroll = useRef<FlatList<ChatMessage>>(null);

  const client = sessionRef.current?.client;
  const currentServer = useMemo(() => (serverId ? sessionRef.current?.client.servers.get(serverId) : undefined), [serverId, revision]);
  const currentChannel = useMemo(() => (channelId ? sessionRef.current?.client.channels.get(channelId) : undefined), [channelId, revision]);
  const servers = useMemo<SDKServer[]>(() => (sessionRef.current ? [...sessionRef.current.client.servers.values()] : []), [revision, screen]);
  const channels = useMemo<SDKChannel[]>(() => (currentServer ? [...currentServer.channels] : []), [currentServer, revision]);
  const directMessages = useMemo<SDKChannel[]>(
    () =>
      sessionRef.current
        ? [...sessionRef.current.client.channels.values()].filter(
            (channel) => channel.type === "DirectMessage" || channel.type === "Group"
          )
        : [],
    [revision, screen]
  );
  const socialUsers = useMemo<SDKUser[]>(
    () =>
      sessionRef.current
        ? [...sessionRef.current.client.users.values()].filter((user) => ["Friend", "Incoming", "Outgoing"].includes(user.relationship))
        : [],
    [revision, screen]
  );
  const voiceActive = voice.state === "connected" || voice.state === "connecting" || voice.state === "reconnecting";
  const muted = voice.members.find((member) => member.me)?.selfMuted ?? false;
  const isServerOwner = Boolean(currentServer && client?.user && currentServer.ownerId === client.user.id);

  const resolveMessage = (id: string) => sessionRef.current?.client.messages.get(id);
  const resolveMention = (userId: string) => sessionRef.current?.client.users.get(userId)?.username;

  const addLog = (message: string, level: ActivityLog["level"] = "info") => {
    const entry = { id: logIdRef.current++, time: Date.now(), message, level };
    setLogs((items) => [...items.slice(-199), entry]);
    console.log(`[radio] ${message}`);
  };
  const bump = () => setRevision((value) => value + 1);

  const resetWorkspace = () => {
    channelLoadRef.current += 1;
    setServerId(null);
    setChannelId(null);
    channelIdRef.current = null;
    setChat([]);
    setPending([]);
    setDraft("");
    setReplyingTo(null);
    setInviteCode("");
    inviteChannelRef.current = null;
    setActionFor(null);
    setSearching(false);
    setSearchQuery("");
    setSearchResults(null);
    setChannelDrawer(false);
    setActionModal(null);
  };

  const closeSession = async () => {
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    voiceUnsubscribeRef.current?.();
    voiceUnsubscribeRef.current = null;
    try {
      await voiceRef.current?.leave();
    } catch (error) {
      console.warn("voice cleanup failed", error);
    }
    voiceRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    apiRef.current = null;
    try {
      await session?.close();
    } catch (error) {
      console.warn("session cleanup failed", error);
    }
    setVoice({ state: "idle", members: [], audioOutput: "speaker" });
    resetWorkspace();
  };

  const bindSessionEvents = (session: StoatSession) => {
    const sdk = session.client;
    const onMessageCreate = (message: SDKMessage) => {
      if (message.channelId !== channelIdRef.current) return;
      setChat((items) =>
        items.some((item) => item.id === message.id)
          ? items
          : [
              ...items,
              toChatMessage(
                message,
                sdk.user?.id,
                (id) => sdk.messages.get(id),
                (id) => sdk.users.get(id)
              ),
            ]
      );
      setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 60);
    };
    const onMessageUpdate = (message: SDKMessage) => {
      if (message.channelId !== channelIdRef.current) return;
      setChat((items) =>
        items.map((item) =>
          item.id === message.id
            ? { ...item, content: message.content, reactions: reactionsOf(message, sdk.user?.id) }
            : item
        )
      );
    };
    const onMessageDelete = (message: { id: string; channelId?: string }) => {
      if (message.channelId !== channelIdRef.current) return;
      setChat((items) => items.filter((item) => item.id !== message.id));
    };
    const onReaction = (message: SDKMessage) => {
      if (message.channelId !== channelIdRef.current) return;
      setChat((items) =>
        items.map((item) => (item.id === message.id ? { ...item, reactions: reactionsOf(message, sdk.user?.id) } : item))
      );
    };
    const refreshCollections = () => bump();
    const onSdkError = (error: unknown) => {
      console.warn("[stoat-session error]", error);
      addLog(`连接通知：${errorMessage(error)}`, "err");
    };
    const onSdkDropped = () => {
      addLog("实时连接中断，正在重连…", "err");
    };

    sdk.on("error", onSdkError);
    sdk.on("dropped", onSdkDropped);
    sdk.on("messageCreate", onMessageCreate);
    sdk.on("messageUpdate", onMessageUpdate);
    sdk.on("messageDelete", onMessageDelete);
    sdk.on("messageReactionAdd", onReaction);
    sdk.on("messageReactionRemove", onReaction);
    sdk.on("messageReactionRemoveEmoji", onReaction);
    sdk.on("channelCreate", refreshCollections);
    sdk.on("channelUpdate", refreshCollections);
    sdk.on("channelDelete", refreshCollections);
    sdk.on("serverCreate", refreshCollections);
    sdk.on("serverUpdate", refreshCollections);
    sdk.on("serverDelete", refreshCollections);
    sdk.on("serverLeave", refreshCollections);
    sdk.on("serverMemberJoin", refreshCollections);
    sdk.on("serverMemberLeave", refreshCollections);
    sdk.on("userUpdate", refreshCollections);

    return () => {
      sdk.off("error", onSdkError);
      sdk.off("dropped", onSdkDropped);
      sdk.off("messageCreate", onMessageCreate);
      sdk.off("messageUpdate", onMessageUpdate);
      sdk.off("messageDelete", onMessageDelete);
      sdk.off("messageReactionAdd", onReaction);
      sdk.off("messageReactionRemove", onReaction);
      sdk.off("messageReactionRemoveEmoji", onReaction);
      sdk.off("channelCreate", refreshCollections);
      sdk.off("channelUpdate", refreshCollections);
      sdk.off("channelDelete", refreshCollections);
      sdk.off("serverCreate", refreshCollections);
      sdk.off("serverUpdate", refreshCollections);
      sdk.off("serverDelete", refreshCollections);
      sdk.off("serverLeave", refreshCollections);
      sdk.off("serverMemberJoin", refreshCollections);
      sdk.off("serverMemberLeave", refreshCollections);
      sdk.off("userUpdate", refreshCollections);
    };
  };

  const activateSession = async (session: StoatSession, persistDomain?: string) => {
    sessionRef.current = session;
    apiRef.current = createStoatApi(session.instance.endpoints, session.token);
    const controller = new VoiceRoomController({
      instance: session.instance,
      sessionToken: session.token,
      userId: () => session.client.user?.id,
      resolveName: (identity) => session.client.users.get(identity)?.username,
      fallbackMembers: (activeChannelId) => {
        const channel = session.client.channels.get(activeChannelId);
        return channel
          ? [...channel.voiceParticipants.values()].map((participant) => ({
              id: participant.userId,
              name: session.client.users.get(participant.userId)?.username,
            }))
          : [];
      },
      onLog: addLog,
    });
    voiceRef.current = controller;
    voiceUnsubscribeRef.current = controller.subscribe(setVoice);
    sessionCleanupRef.current = bindSessionEvents(session);
    if (persistDomain) {
      await saveStoredSession({
        domain: persistDomain,
        sessionId: session.sessionId,
        userId: session.userId,
        token: session.token,
      }).catch((error) => {
        addLog(`安全保存会话失败：${errorMessage(error)}`, "err");
      });
    }
    setScreen("workspace");
    bump();
  };

  const doAuth = async () => {
    setAuthError(undefined);
    if (!domain.trim() || !email.trim() || !password) {
      setAuthError("请填写实例地址、邮箱和密码。");
      return;
    }
    let canonicalDomain: string;
    try {
      canonicalDomain = normalizeDomain(domain);
    } catch (error) {
      setAuthError(errorMessage(error));
      return;
    }
    if (canonicalDomain.startsWith("http://")) {
      addLog("当前使用明文 http 连接，登录凭证可能被窃听；请改用 https 实例。", "err");
    }
    // 邀请码选填：开放注册的实例不需要，服务端需要时会返回明确错误。
    const trimmedInvite = invite.trim();
    let desiredUsername: string | undefined;
    if (authMode === "register") {
      try {
        desiredUsername = normalizeUsername(username) ?? suggestUsername();
      } catch (error) {
        setAuthError(errorMessage(error));
        return;
      }
    }
    setBusy(true);
    try {
      await closeSession();
      const instance = await discoverInstance(canonicalDomain);
      if (!instance) throw new Error("该地址没有提供 Stoat 实例发现配置");
      addLog(`已发现实例 ${instance.endpoints.api}`, "ok");
      if (authMode === "register") {
        await registerAccount(instance.endpoints, email.trim(), password, trimmedInvite || undefined);
        addLog("注册成功，正在登录", "ok");
      }
      const session = await StoatSession.open(instance, email.trim(), password);
      // 先落会话再做 Onboarding：Onboarding 失败不再销毁已成功的登录，
      // 用户停留在工作区可重试，而不是被踢回登录页。
      await activateSession(session, canonicalDomain);
      const needsOnboarding = authMode === "register" || sessionRequiresOnboarding(session);
      if (needsOnboarding && desiredUsername === undefined) {
        desiredUsername = suggestUsername();
      }
      if (needsOnboarding && desiredUsername) {
        try {
          await session.completeOnboarding(desiredUsername);
          addLog(`已完成初始化，用户名 ${desiredUsername}`, "ok");
        } catch (error) {
          addLog(`自动初始化用户名失败：${errorMessage(error)}，请稍后重试`, "err");
          setActivityDrawer(true);
        }
      }
      addLog(`已连接为 ${session.client.user?.username ?? "用户"}`, "ok");
    } catch (error) {
      const message = errorMessage(error);
      setAuthError(message);
      addLog(message, "err");
      await closeSession();
      await clearStoredSession();
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    setBusy(true);
    try {
      // 先请求服务端注销（需要内存中的会话），再清除本地凭证，保证两边一致。
      await closeSession();
    } finally {
      await clearStoredSession();
    }
    setEmail("");
    setPassword("");
    setInvite("");
    setUsername("");
    setAuthError(undefined);
    setScreen("auth");
    setBusy(false);
  };

  const doAddFriend = async (fullUsername: string) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      const result = await sendFriendRequest(api, fullUsername);
      if (typeof result._id === "string") await sessionRef.current?.client.users.fetch(result._id).catch(() => undefined);
      setActionModal(null);
      bump();
      addLog(`已向 ${fullUsername} 发送好友请求`, "ok");
    } catch (error) {
      addLog(`好友请求失败：${errorMessage(error)}`, "err");
      setActivityDrawer(true);
    } finally {
      setBusy(false);
    }
  };

  const doAcceptFriend = async (user: SDKUser) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      await acceptFriendRequest(api, user.id);
      await sessionRef.current?.client.users.fetch(user.id).catch(() => undefined);
      bump();
      addLog(`已接受 ${user.username} 的好友请求`, "ok");
    } catch (error) {
      addLog(`接受好友失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const doDenyFriend = async (user: SDKUser) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      await removeOrDenyFriend(api, user.id);
      await sessionRef.current?.client.users.fetch(user.id).catch(() => undefined);
      bump();
      addLog(`已处理与 ${user.username} 的好友关系`, "ok");
    } catch (error) {
      addLog(`处理好友关系失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const doRemoveFriend = async (user: SDKUser) => {
    Alert.alert("解除好友", `确定要解除与 ${user.username} 的好友关系吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "解除",
        style: "destructive",
        onPress: async () => {
          const api = apiRef.current;
          if (!api) return;
          setBusy(true);
          try {
            await removeOrDenyFriend(api, user.id);
            await sessionRef.current?.client.users.fetch(user.id).catch(() => undefined);
            bump();
            addLog(`已解除与 ${user.username} 的好友关系`, "ok");
          } catch (error) {
            addLog(`解除好友失败：${errorMessage(error)}`, "err");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const doOpenUserDM = async (user: SDKUser) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      const raw = await openDirectMessage(api, user.id);
      if (typeof raw._id !== "string") throw new Error("私信频道缺少 ID");
      const channel = await sessionRef.current?.client.channels.fetch(raw._id);
      if (channel) {
        setServerId(null);
        await openChannel(channel);
        bump();
      }
    } catch (error) {
      addLog(`打开私信失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const selectServer = async (server: SDKServer) => {
    setServerId(server.id);
    setChannelId(null);
    channelIdRef.current = null;
    setChat([]);
    setReplyingTo(null);
    setInviteCode("");
    inviteChannelRef.current = null;
    setSearchResults(null);
    setChannelDrawer(true);
  };
  const goHome = async () => {
    resetWorkspace();
  };

  const doCreateServer = async (name: string) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      const result = await createServer(api, name);
      await sessionRef.current?.client.servers.fetch(result.server._id).catch(() => undefined);
      setServerId(result.server._id);
      setActionModal(null);
      setChannelDrawer(true);
      bump();
      addLog(`已创建服务器 ${name}`, "ok");
    } catch (error) {
      addLog(`创建服务器失败：${errorMessage(error)}`, "err");
      setActivityDrawer(true);
    } finally {
      setBusy(false);
    }
  };

  const doJoinServer = async (code: string) => {
    const api = apiRef.current;
    if (!api) return;
    setBusy(true);
    try {
      let targetServerId: string;
      try {
        targetServerId = (await joinServer(api, code)).server._id;
      } catch (error) {
        if (!isAlreadyInServer(error)) throw error;
        targetServerId = (await getInvite(api, code)).server_id;
      }
      await sessionRef.current?.client.servers.fetch(targetServerId).catch(() => undefined);
      setServerId(targetServerId);
      setActionModal(null);
      setChannelDrawer(true);
      bump();
      addLog("已加入服务器", "ok");
    } catch (error) {
      addLog(`加入服务器失败：${errorMessage(error)}`, "err");
      setActivityDrawer(true);
    } finally {
      setBusy(false);
    }
  };

  const doUpdateServerName = async (name: string) => {
    const api = apiRef.current;
    if (!api || !serverId) return;
    setBusy(true);
    try {
      await updateServer(api, serverId, { name });
      await sessionRef.current?.client.servers.fetch(serverId).catch(() => undefined);
      setActionModal(null);
      bump();
      addLog(`服务器名称已更新为 ${name}`, "ok");
    } catch (error) {
      addLog(`更新服务器失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const doDeleteOrLeaveServer = async () => {
    const api = apiRef.current;
    if (!api || !serverId || !currentServer) return;
    const isOwner = isServerOwner;
    const actionText = isOwner ? "删除服务器" : "退出服务器";
    Alert.alert(actionText, `确定要${actionText} "${currentServer.name}" 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "确定",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            if (voiceActive) await voiceRef.current?.leave();
            await deleteOrLeaveServer(api, serverId);
            setActionModal(null);
            resetWorkspace();
            bump();
            addLog(`已${actionText}`, "ok");
          } catch (error) {
            addLog(`${actionText}失败：${errorMessage(error)}`, "err");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const doCreateChannel = async (type: "Text" | "Voice", name: string) => {
    const api = apiRef.current;
    if (!api || !serverId) return;
    setBusy(true);
    try {
      const created = await createChannel(api, serverId, type, name);
      const channel = await sessionRef.current?.client.channels.fetch(created._id);
      setActionModal(null);
      bump();
      if (channel) await openChannel(channel);
      addLog(`已创建${type === "Text" ? "文字" : "语音"}频道 ${name}`, "ok");
    } catch (error) {
      addLog(`创建频道失败：${errorMessage(error)}`, "err");
      setActivityDrawer(true);
    } finally {
      setBusy(false);
    }
  };

  const doDeleteChannel = async (channel: SDKChannel) => {
    const api = apiRef.current;
    if (!api) return;
    Alert.alert("删除频道", `确定要删除频道 "#${channel.name}" 吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            if (channelId === channel.id && voiceActive) await voiceRef.current?.leave();
            await deleteChannel(api, channel.id);
            if (channelId === channel.id) {
              setChannelId(null);
              channelIdRef.current = null;
              setChat([]);
              setReplyingTo(null);
            }
            bump();
            addLog(`已删除频道 ${channel.name}`, "ok");
          } catch (error) {
            addLog(`删除频道失败：${errorMessage(error)}`, "err");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openChannel = async (channel: SDKChannel) => {
    const loadId = ++channelLoadRef.current;
    channelIdRef.current = channel.id;
    setChannelId(channel.id);
    setChannelDrawer(false);
    setChat([]);
    setPending([]);
    setReplyingTo(null);
    setInviteCode("");
    inviteChannelRef.current = null;
    setActionFor(null);
    setSearching(false);
    setSearchQuery("");
    setSearchResults(null);
    setHasMore(true);
    if (channel.isVoice && channel.type !== "DirectMessage") return;
    try {
      const messages = await channel.fetchMessages({ limit: 50 });
      if (loadId !== channelLoadRef.current || channel.id !== channelIdRef.current) return;
      if (messages.length < 50) setHasMore(false);
      const resolveUser = (id: string) => sessionRef.current?.client.users.get(id);
      setChat(sortAndMapMessages(messages, sessionRef.current?.client.user?.id, resolveMessage, resolveUser));
      setTimeout(() => chatScroll.current?.scrollToEnd({ animated: false }), 60);
    } catch (error) {
      addLog(`读取消息失败：${errorMessage(error)}`, "err");
    }
  };

  const loadOlderMessages = async () => {
    // 搜索结果是独立快照：不分页、不合并回时间线，关闭搜索即回到原时间线。
    if (searchResults) return;
    const channel = currentChannel;
    const before = chat[0]?.id;
    if (!channel || !before || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const older = await channel.fetchMessages({ limit: 50, before });
      if (older.length < 50) setHasMore(false);
      const resolveUser = (id: string) => sessionRef.current?.client.users.get(id);
      setChat((items) => mergeMessages(sortAndMapMessages(older, sessionRef.current?.client.user?.id, resolveMessage, resolveUser), items));
    } catch (error) {
      addLog(`读取更早消息失败：${errorMessage(error)}`, "err");
    } finally {
      setLoadingOlder(false);
    }
  };

  const searchMessages = async () => {
    const channel = currentChannel;
    const query = searchQuery.trim();
    if (!channel || !query) return;
    setBusy(true);
    try {
      const messages = await channel.search({ query, limit: 50, sort: "Latest" });
      const resolveUser = (id: string) => sessionRef.current?.client.users.get(id);
      setSearchResults(sortAndMapMessages(messages, sessionRef.current?.client.user?.id, resolveMessage, resolveUser));
      addLog(`搜索到 ${messages.length} 条消息`, "ok");
    } catch (error) {
      addLog(`搜索失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  const doPickImage = async () => {
    const instance = sessionRef.current?.instance;
    const token = sessionRef.current?.token;
    if (!instance || !token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("需要相册权限", "请允许 Radio 读取图片，才能发送附件。");
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.82,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const placeholderId = `upload-${Date.now()}`;
    const placeholder: PendingAttachment = {
      id: placeholderId,
      url: asset.uri,
      isImage: true,
      filename: asset.fileName ?? undefined,
      progress: 0,
      uploading: true,
    };
    setPending((items) => [...items, placeholder]);
    try {
      const uploaded = await uploadAttachment(instance, token, asset.uri, asset.mimeType ?? "image/jpeg", (progress) => {
        setPending((items) => items.map((item) => (item.id === placeholderId ? { ...item, progress } : item)));
      });
      setPending((items) =>
        items.map((item) =>
          item.id === placeholderId
            ? {
                id: uploaded.id,
                url: uploaded.url,
                isImage: (uploaded.contentType ?? asset.mimeType ?? "image/jpeg").startsWith("image/"),
                filename: asset.fileName ?? undefined,
                progress: 1,
                uploading: false,
              }
            : item
        )
      );
      addLog("图片上传成功", "ok");
    } catch (error) {
      setPending((items) => items.filter((item) => item.id !== placeholderId));
      addLog(`图片上传失败：${errorMessage(error)}`, "err");
      setActivityDrawer(true);
    }
  };

  const doSend = async () => {
    const channel = currentChannel;
    const readyAttachments = pending.filter((item) => !item.uploading);
    if (!channel || pending.some((item) => item.uploading) || (!draft.trim() && !readyAttachments.length)) return;
    const text = draft.trim();
    const previousPending = readyAttachments;
    const replyTarget = replyingTo;
    setDraft("");
    setPending([]);
    setReplyingTo(null);
    try {
      const message = await channel.sendMessage({
        content: text,
        attachments: readyAttachments.map((item) => item.id),
        ...(replyTarget ? { replies: [{ id: replyTarget.id, mention: true }] } : {}),
      });
      if (channel.id !== channelIdRef.current) return;
      setChat((items) =>
        items.some((item) => item.id === message.id)
          ? items
          : [
              ...items,
              toChatMessage(
                message,
                sessionRef.current?.client.user?.id,
                resolveMessage,
                (id) => sessionRef.current?.client.users.get(id)
              ),
            ]
      );
      setTimeout(() => chatScroll.current?.scrollToEnd({ animated: true }), 60);
    } catch (error) {
      setDraft(text);
      setPending(previousPending);
      setReplyingTo(replyTarget);
      addLog(`发送失败：${errorMessage(error)}`, "err");
    }
  };

  const doReply = (message: ChatMessage) => {
    setReplyingTo({
      id: message.id,
      author: message.author,
      content: message.content || "[附件]",
    });
    setActionFor(null);
  };

  const doReact = async (messageId: string, emoji: string) => {
    const message = sessionRef.current?.client.messages.get(messageId);
    const myUserId = sessionRef.current?.client.user?.id;
    if (!message || !myUserId) return;
    try {
      if (message.reactions.get(emoji)?.has(myUserId)) await message.unreact(emoji);
      else await message.react(emoji);
      setActionFor(null);
    } catch (error) {
      addLog(`反应失败：${errorMessage(error)}`, "err");
    }
  };

  const doEdit = async (messageId: string, text: string) => {
    const message = sessionRef.current?.client.messages.get(messageId);
    if (!message || !text.trim()) return;
    try {
      const content = text.trim();
      await message.edit({ content });
      setChat((items) => items.map((item) => (item.id === messageId ? { ...item, content } : item)));
      setActionFor(null);
    } catch (error) {
      addLog(`编辑失败：${errorMessage(error)}`, "err");
    }
  };

  const doDelete = async (messageId: string) => {
    const message = sessionRef.current?.client.messages.get(messageId);
    if (!message) return;
    try {
      await message.delete();
      setChat((items) => items.filter((item) => item.id !== messageId));
      setActionFor(null);
    } catch (error) {
      addLog(`删除失败：${errorMessage(error)}`, "err");
    }
  };

  const doJoinVoice = async (channel: SDKChannel) => {
    if (Platform.OS === "android") {
      const microphone = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (microphone !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert("无法加入语音", "需要麦克风权限才能加入语音频道。");
        return;
      }
      if (Platform.Version >= 33) await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const controller = voiceRef.current;
    const api = apiRef.current;
    if (!controller || !api) return;
    setBusy(true);
    try {
      // 先走 openChannel：语音分支只重置聊天/搜索等视图状态，不拉取消息。
      // 之前这里直接 setChannelId，导致旧文字频道的聊天记录配上语音频道 ID，发错地方。
      await openChannel(channel);
      await controller.join(channel.id, channel.name);
      // 邀请码只为当前语音频道生成一次：之前每次加入都新建邀请，越积越多。
      if (inviteChannelRef.current !== channel.id) {
        const textChannel = currentServer?.channels.find((item) => item.type === "TextChannel" && !item.isVoice);
        if (textChannel) {
          try {
            const code = await createChannelInvite(api, textChannel.id);
            if (channelIdRef.current === channel.id) {
              setInviteCode(code);
              inviteChannelRef.current = channel.id;
            }
          } catch (error) {
            addLog(`邀请码创建失败：${errorMessage(error)}`);
          }
        }
      }
    } catch (error) {
      addLog(`进入语音失败：${errorMessage(error)}`, "err");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (url && url.includes("voice/stop")) {
        void voiceRef.current?.leave();
      }
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const resumeVoice = (reason: string) => {
      const controller = voiceRef.current;
      if (!controller) return;
      void controller.ensureConnected().catch((error) => {
        addLog(`${reason}后恢复语音失败：${errorMessage(error)}`, "err");
      });
    };

    const callEnded = micForeground.addListener("onCallEnded", () => {
      const controller = voiceRef.current;
      if (!controller) return;
      void controller.leave().catch((error) => {
        addLog(`系统结束通话时清理失败：${errorMessage(error)}`, "err");
      });
    });
    const callMuted = micForeground.addListener("onCallMuted", ({ muted: nextMuted }) => {
      const controller = voiceRef.current;
      if (!controller) return;
      void controller.setMutedFromSystem(nextMuted).catch((error) => {
        addLog(`系统静音同步失败：${errorMessage(error)}`, "err");
      });
    });
    const audioActivated = micForeground.addListener("onAudioSessionActivated", () => {
      RTCAudioSession.audioSessionDidActivate();
      resumeVoice("音频会话恢复");
    });
    const audioDeactivated = micForeground.addListener("onAudioSessionDeactivated", () => {
      RTCAudioSession.audioSessionDidDeactivate();
    });
    const audioInterrupted = micForeground.addListener("onAudioInterrupted", ({ phase, shouldResume }) => {
      if (phase === "ended" && shouldResume) resumeVoice("系统音频中断结束");
    });

    return () => {
      callEnded.remove();
      callMuted.remove();
      audioActivated.remove();
      audioDeactivated.remove();
      audioInterrupted.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await loadStoredSession();
        if (!stored) return;
        setDomain(stored.domain);
        const instance = await discoverInstance(stored.domain);
        if (!instance) throw new Error("已保存的实例不可用");
        const session = await StoatSession.resume(instance, {
          result: "Success",
          _id: stored.sessionId,
          user_id: stored.userId,
          token: stored.token,
        });
        if (cancelled) return session.disconnect();
        await activateSession(session);
        addLog(`已恢复 ${session.client.user?.username ?? "用户"} 的会话`, "ok");
      } catch (error) {
        // 只有凭证本身失效才清除本地会话；断网/超时/服务端 500 必须保留，
        // 否则一次普通网络抖动就逼用户重新登录。
        if (isSessionInvalidError(error)) {
          await clearStoredSession();
          addLog(`已保存的会话已失效：${errorMessage(error)}，请重新登录`, "err");
        } else {
          addLog(`自动恢复失败（已保留登录信息，可重试）：${errorMessage(error)}`, "err");
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let lastState = AppState.currentState;
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (lastState.match(/inactive|background/) && nextState === "active") {
        const session = sessionRef.current;
        if (session) {
          try {
            if (!session.client.ready()) {
              console.log("[AppState] 解锁唤醒，正在恢复实时连接...");
              session.client.connect();
            }
          } catch (err) {
            console.warn("[AppState] 唤醒重连异常兜底:", err);
          }
        }
        const controller = voiceRef.current;
        if (controller) {
          void controller.ensureConnected().catch((error) => {
            addLog(`解锁唤醒后恢复语音失败：${errorMessage(error)}`, "err");
          });
        }
      }
      lastState = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => {
    sessionCleanupRef.current?.();
    voiceUnsubscribeRef.current?.();
    void voiceRef.current?.leave();
    sessionRef.current?.disconnect();
  }, []);

  if (screen === "auth") {
    return (
      <AuthScreen
        mode={authMode}
        domain={domain}
        email={email}
        password={password}
        invite={invite}
        username={username}
        busy={busy || restoring}
        error={authError}
        onMode={setAuthMode}
        onDomain={setDomain}
        onEmail={setEmail}
        onPassword={setPassword}
        onInvite={setInvite}
        onUsername={setUsername}
        onSubmit={doAuth}
      />
    );
  }

  const instanceLabel = sessionRef.current?.instance.endpoints.api.replace(/^https?:\/\//, "").replace(/\/api\/?$/, "") ?? "self-hosted";
  const isVoice = Boolean(currentChannel?.isVoice && currentChannel.type !== "DirectMessage");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.paperDeep} />
      <ServerRail servers={servers} selectedId={serverId} onHome={goHome} onSelect={selectServer} onAdd={() => setActionModal("server")} />
      <WorkspaceHeader
        server={currentServer}
        channel={currentChannel}
        userName={client?.user?.username ?? "用户"}
        instanceLabel={instanceLabel}
        voiceActive={voiceActive}
        muted={muted}
        audioOutput={voice.audioOutput}
        onOpenChannels={() => setChannelDrawer(true)}
        onOpenServerSettings={() => setActionModal("server_settings")}
        onToggleMute={() => void voiceRef.current?.setMuted(!muted)}
        onToggleAudioOutput={() => void voiceRef.current?.toggleAudioOutput()}
        onLeaveVoice={() => void voiceRef.current?.leave()}
        onOpenActivity={() => setActivityDrawer(true)}
        onLogout={doLogout}
      />
      <View style={styles.content}>
        {!serverId && !currentChannel ? (
          <HomeDashboard
            servers={servers}
            directMessages={directMessages}
            socialUsers={socialUsers}
            onSelect={selectServer}
            onOpenActions={() => setActionModal("server")}
            onOpenDM={(channel) => void openChannel(channel)}
            onOpenUserDM={(user) => void doOpenUserDM(user)}
            onAcceptFriend={(user) => void doAcceptFriend(user)}
            onDenyFriend={(user) => void doDenyFriend(user)}
            onRemoveFriend={(user) => void doRemoveFriend(user)}
            onOpenFriendActions={() => setActionModal("friend")}
          />
        ) : null}
        {serverId && !currentChannel ? (
          <HomeDashboard serverMode servers={currentServer ? [currentServer] : []} onSelect={() => setChannelDrawer(true)} onOpenActions={() => setChannelDrawer(true)} />
        ) : null}
        {currentChannel && isVoice ? (
          <VoiceView
            channel={currentChannel}
            snapshot={voice}
            inviteCode={inviteCode}
            busy={busy}
            onJoin={doJoinVoice}
            onCycleVolume={(id) => voiceRef.current?.cycleVolume(id)}
            onToggleAudioOutput={() => void voiceRef.current?.toggleAudioOutput()}
          />
        ) : null}
        {currentChannel && !isVoice ? (
          <ChatView
            channelName={currentChannel.displayName ?? currentChannel.name ?? "私信"}
            messages={searchResults ?? chat}
            draft={draft}
            pending={pending}
            actionFor={actionFor}
            editText={editText}
            replyingTo={replyingTo}
            busy={busy}
            loadingOlder={loadingOlder}
            hasMore={hasMore}
            searching={searching}
            searchQuery={searchQuery}
            listRef={chatScroll}
            onDraft={setDraft}
            onSend={doSend}
            onPickImage={doPickImage}
            onRemoveAttachment={(id) => setPending((items) => items.filter((item) => item.id !== id))}
            onLongPress={(message) => {
              setActionFor(message.id);
              setEditText(message.content);
            }}
            onReact={doReact}
            onEditText={setEditText}
            onEdit={doEdit}
            onDelete={doDelete}
            onCancelAction={() => setActionFor(null)}
            onReply={doReply}
            onCancelReply={() => setReplyingTo(null)}
            onLoadOlder={loadOlderMessages}
            onToggleSearch={() => {
              // 搜索结果与时间线隔离：关闭只丢弃快照，原时间线还在，无需重新拉取。
              setSearching((value) => !value);
              setSearchQuery("");
              setSearchResults(null);
            }}
            onSearchQuery={setSearchQuery}
            onSearch={searchMessages}
            resolveMention={resolveMention}
          />
        ) : null}
      </View>
      <ChannelDrawer
        visible={channelDrawer}
        server={currentServer}
        channels={channels}
        selectedId={channelId}
        busy={busy}
        onClose={() => setChannelDrawer(false)}
        onSelect={openChannel}
        onCreate={() => {
          setChannelDrawer(false);
          setActionModal("channel");
        }}
        onDeleteChannel={isServerOwner ? doDeleteChannel : undefined}
        onHome={goHome}
      />
      <WorkspaceActionModal
        key={actionModal ?? "closed"}
        kind={actionModal}
        server={currentServer}
        isOwner={isServerOwner}
        busy={busy}
        onClose={() => setActionModal(null)}
        onCreateServer={doCreateServer}
        onJoinServer={doJoinServer}
        onCreateChannel={doCreateChannel}
        onAddFriend={doAddFriend}
        onUpdateServer={doUpdateServerName}
        onDeleteServer={doDeleteOrLeaveServer}
        onLeaveServer={doDeleteOrLeaveServer}
      />
      <ActivityDrawer visible={activityDrawer} logs={logs} onClose={() => setActivityDrawer(false)} />
    </SafeAreaView>
  );
}

function sortAndMapMessages(
  messages: SDKMessage[],
  myUserId?: string,
  resolveMessage?: (id: string) => SDKMessage | undefined,
  resolveUser?: (id: string) => { username?: string } | undefined
): ChatMessage[] {
  return [...messages]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((message) => toChatMessage(message, myUserId, resolveMessage, resolveUser));
}

/**
 * 校验用户输入的用户名：空视为未填（由调用方生成），非空必须 3-32 位字母数字下划线。
 * 服务端对非法用户名的拒绝信息晦涩，客户端先拦一道。
 */
function normalizeUsername(input: string): string | undefined {
  const value = input.trim();
  if (!value) return undefined;
  if (!/^[A-Za-z0-9_]{3,32}$/.test(value)) {
    throw new Error("用户名需为 3-32 位字母、数字或下划线。");
  }
  return value;
}

function suggestUsername(): string {
  const suffix = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, "0");
  return `radio_${suffix}`;
}

/**
 * 登录后是否仍需 Onboarding：仅当服务端在登录响应或用户对象里明确标记时才返回 true，
 * 避免臆测字段；无标记则保持原行为（不打扰已完成初始化的用户）。
 */
function sessionRequiresOnboarding(session: StoatSession): boolean {
  const user = session.client.user as unknown as Record<string, unknown> | undefined;
  if (user && (user.onboarding === true || user.onboarded === false)) return true;
  return false;
}

function mergeMessages(first: ChatMessage[], second: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...first, ...second]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const errObj = error as Record<string, any>;
    if (typeof errObj.message === "string") return errObj.message;
    if (errObj.data && typeof errObj.data.type === "string") return `${errObj.type || "Error"}: ${errObj.data.type}`;
    if (typeof errObj.type === "string") return errObj.type;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.paper },
  content: { flex: 1 },
});
