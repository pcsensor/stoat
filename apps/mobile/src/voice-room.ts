import { Platform } from "react-native";
import { AudioSession } from "@livekit/react-native";
import { Room, RoomEvent, Track, createLocalAudioTrack, type RemoteParticipant } from "livekit-client";
import type { InstanceConfig } from "@radio/core";
import { isAlreadyConnectedError, isRetriableVoiceError, joinCall } from "@radio/voice";
import { micForeground } from "../modules/mic-foreground/src";
import { canReuseVoiceRoom, type VoiceConnectionState } from "./voice-connection-state";

export type AudioOutputDevice = "speaker" | "earpiece";

export interface VoiceMember {
  id: string;
  name: string;
  me: boolean;
  speaking: boolean;
  selfMuted: boolean;
  volume: number;
}

export type { VoiceConnectionState } from "./voice-connection-state";
export type VoiceListener = (state: VoiceSnapshot) => void;

export interface VoiceSnapshot {
  state: VoiceConnectionState;
  members: VoiceMember[];
  error?: string;
  audioOutput: AudioOutputDevice;
}

interface VoiceControllerOptions {
  instance: InstanceConfig;
  sessionToken: string;
  userId: () => string | undefined;
  resolveName: (identity: string) => string | undefined;
  fallbackMembers?: (channelId: string) => Array<{ id: string; name?: string }>;
  onLog?: (message: string, level?: "info" | "ok" | "err") => void;
}

export class VoiceRoomController {
  private readonly options: VoiceControllerOptions;
  private readonly listeners = new Set<VoiceListener>();
  private readonly volumes = new Map<string, number>();
  private readonly remoteMuted = new Set<string>();
  private room: Room | null = null;
  private channelId: string | null = null;
  private channelName = "语音频道";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private memberTimer: ReturnType<typeof setInterval> | null = null;
  private activeConnect: Promise<void> | null = null;
  private connectAbort: AbortController | null = null;
  private operation = 0;
  private reconnectAttempt = 0;
  private sdkHealing = false;
  private systemCallStarted = false;
  private wanted = false;
  private userMuted = false;
  private audioOutput: AudioOutputDevice = "speaker";
  private snapshot: VoiceSnapshot = { state: "idle", members: [], audioOutput: "speaker" };

  constructor(options: VoiceControllerOptions) {
    this.options = options;
  }

  subscribe(listener: VoiceListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async join(channelId: string, channelName: string): Promise<void> {
    await this.cancelCurrentConnection();
    this.wanted = true;
    this.channelId = channelId;
    this.channelName = channelName;
    this.reconnectAttempt = 0;
    this.sdkHealing = false;
    this.clearReconnectTimer();
    const operation = ++this.operation;
    await this.connect(operation);
  }

  async leave(): Promise<void> {
    this.wanted = false;
    this.sdkHealing = false;
    this.operation += 1;
    this.connectAbort?.abort();
    this.connectAbort = null;
    this.clearReconnectTimer();
    this.clearMemberTimer();
    const activeConnect = this.activeConnect;
    await this.disposeRoom();
    await activeConnect?.catch(() => undefined);
    await AudioSession.stopAudioSession();
    this.stopSystemCall();
    this.channelId = null;
    this.remoteMuted.clear();
    this.userMuted = false;
    this.audioOutput = "speaker";
    this.setSnapshot({ state: "idle", members: [], audioOutput: "speaker" });
  }

  async setMuted(muted: boolean): Promise<void> {
    this.userMuted = muted;
    const room = this.room;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!muted);
    micForeground.setMuted(muted);
    this.emitMembers();
  }

  /**
   * 由 iOS CallKit 的系统静音按钮触发。这里不再反向调用 CallKit，避免重复
   * 的 CXSetMutedCallAction 形成事件回环。
   */
  async setMutedFromSystem(muted: boolean): Promise<void> {
    this.userMuted = muted;
    const room = this.room;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!muted);
    this.emitMembers();
  }

  async setAudioOutput(output: AudioOutputDevice): Promise<void> {
    this.audioOutput = output;
    try {
      if (Platform.OS === "android") {
        await AudioSession.selectAudioOutput(output);
      } else {
        await AudioSession.selectAudioOutput(output === "speaker" ? "force_speaker" : "default");
      }
      this.options.onLog?.(output === "speaker" ? "已切换为免提（扬声器）" : "已切换为听筒模式", "info");
    } catch (err) {
      console.warn("[voice-room] setAudioOutput error:", err);
    }
    this.emitMembers();
  }

  async toggleAudioOutput(): Promise<void> {
    const next = this.audioOutput === "speaker" ? "earpiece" : "speaker";
    await this.setAudioOutput(next);
  }

  cycleVolume(identity: string): void {
    const current = this.volumes.get(identity) ?? 1;
    const next = current === 1 ? 0.5 : current === 0.5 ? 0.2 : 1;
    this.volumes.set(identity, next);
    this.room?.remoteParticipants.get(identity)?.setVolume(next);
    this.emitMembers();
  }

  get currentRoom(): Room | null {
    return this.room;
  }

  private async connect(operation: number): Promise<void> {
    if (!this.wanted || !this.channelId || operation !== this.operation) return;
    const task = this.performConnect(operation);
    this.activeConnect = task;
    try {
      await task;
    } finally {
      if (this.activeConnect === task) this.activeConnect = null;
    }
  }

  private async performConnect(operation: number): Promise<void> {
    const channelId = this.channelId;
    if (!channelId) throw new VoiceOperationCancelled();
    this.setSnapshot({ state: "connecting", members: [], audioOutput: this.audioOutput });
    const abortController = new AbortController();
    this.connectAbort = abortController;
    let microphone: Awaited<ReturnType<typeof createLocalAudioTrack>> | null = null;
    try {
      // Android 必须在 Activity 仍可见时启动 microphone FGS；iOS 同时在此向
      // CallKit 注册持续通话。这样用户在连接阶段立即锁屏也不会错过保活窗口。
      const systemCallWasStarted = this.systemCallStarted;
      const systemCallStarted = this.startSystemCall();
      await AudioSession.startAudioSession();
      try {
        if (Platform.OS === "android") {
          await AudioSession.selectAudioOutput(this.audioOutput);
        } else {
          await AudioSession.selectAudioOutput(this.audioOutput === "speaker" ? "force_speaker" : "default");
        }
      } catch (audioErr) {
        console.warn("[voice-room] selectAudioOutput initial error:", audioErr);
      }
      this.assertCurrent(operation);
      let call: Awaited<ReturnType<typeof joinCall>>;
      try {
        call = await joinCall(this.options.instance.endpoints, this.options.sessionToken, channelId, {
          node: chooseLiveKitNode(this.options.instance),
          forceDisconnect: false,
          signal: abortController.signal,
        });
      } catch (joinErr) {
        // 服务器仍记录为已连接（快速切换频道 / App崩溃后残留）
        // 自动以 forceDisconnect=true 重试一次，接管旧会话。
        if (!isAlreadyConnectedError(joinErr)) throw joinErr;
        this.assertCurrent(operation);
        this.options.onLog?.("检测到旧语音会话，正在强制接管…", "info");
        call = await joinCall(this.options.instance.endpoints, this.options.sessionToken, channelId, {
          node: chooseLiveKitNode(this.options.instance),
          forceDisconnect: true,
          signal: abortController.signal,
        });
      }
      this.assertCurrent(operation);
      const room = new Room({ adaptiveStream: { pixelDensity: "screen" }, dynacast: true });
      this.room = room;
      this.attachListeners(room);
      await room.connect(call.url, call.token);
      this.assertCurrent(operation);
      microphone = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true });
      this.assertCurrent(operation);
      await room.localParticipant.publishTrack(microphone, { source: Track.Source.Microphone });
      this.assertCurrent(operation);
      if (this.userMuted) {
        await room.localParticipant.setMicrophoneEnabled(false);
        micForeground.setMuted(true);
      }
      if (!systemCallWasStarted) {
        this.options.onLog?.(
          systemCallStarted ? "系统级通话服务已启动（已开启防锁屏休眠与断网保护）" : "系统级通话服务启动失败，语音仍保持连接",
          systemCallStarted ? "ok" : "err"
        );
      }
      this.reconnectAttempt = 0;
      this.startMemberPoll();
      this.setSnapshot({ state: "connected", members: this.buildMembers(), audioOutput: this.audioOutput });
    } catch (error) {
      if (microphone) {
        try {
          microphone.stop();
        } catch {}
      }
      await this.disposeRoom();
      if (error instanceof VoiceOperationCancelled) return;
      const message = error instanceof Error ? error.message : String(error);
      this.setSnapshot({ state: "error", members: [], error: message, audioOutput: this.audioOutput });
      if (this.wanted && isRetriableVoiceError(error)) {
        this.scheduleReconnect();
      } else {
        this.wanted = false;
        this.stopSystemCall();
        await AudioSession.stopAudioSession().catch(() => undefined);
      }
      throw error;
    } finally {
      if (this.connectAbort === abortController) this.connectAbort = null;
    }
  }

  private attachListeners(room: Room): void {
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      micForeground.playTone("join");
      this.options.onLog?.(`成员 ${participant.name || participant.identity} 加入语音`, "ok");
      this.emitMembers();
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      micForeground.playTone("leave");
      this.options.onLog?.(`成员 ${participant.name || participant.identity} 离开语音`);
      this.remoteMuted.delete(participant.identity);
      this.emitMembers();
    });
    room.on(RoomEvent.TrackSubscribed, (_track, _publication, participant) => {
      this.options.onLog?.(`已订阅 ${participant.identity} 的音频轨道`, "ok");
      this.emitMembers();
    });
    room.on(RoomEvent.ActiveSpeakersChanged, () => this.emitMembers());
    room.on(RoomEvent.ParticipantMetadataChanged, () => this.emitMembers());
    room.on(RoomEvent.TrackMuted, (_publication, participant) => {
      if (participant?.identity) this.remoteMuted.add(participant.identity);
      this.emitMembers();
    });
    room.on(RoomEvent.TrackUnmuted, (_publication, participant) => {
      if (participant?.identity) this.remoteMuted.delete(participant.identity);
      this.emitMembers();
    });
    room.on(RoomEvent.Reconnecting, () => {
      this.sdkHealing = true;
      this.setSnapshot({ state: "reconnecting", members: this.buildMembers() });
      this.options.onLog?.("语音连接中断，正在重连…", "err");
    });
    room.on(RoomEvent.SignalReconnecting, () => {
      this.sdkHealing = true;
      this.setSnapshot({ state: "reconnecting", members: this.buildMembers() });
    });
    room.on(RoomEvent.Reconnected, () => {
      this.sdkHealing = false;
      this.reconnectAttempt = 0;
      this.clearReconnectTimer();
      this.options.onLog?.("语音连接已恢复", "ok");
      this.setSnapshot({ state: "connected", members: this.buildMembers() });
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!this.wanted || room !== this.room) return;
      this.sdkHealing = false;
      this.options.onLog?.("语音房间已断开，准备重新加入", "err");
      this.setSnapshot({ state: "reconnecting", members: this.buildMembers() });
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.wanted) return;
    this.reconnectAttempt += 1;
    const delay = reconnectDelayMs(this.reconnectAttempt);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.ensureConnected();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }
  async ensureConnected(): Promise<void> {
    if (!this.wanted || !this.channelId) return;
    if (this.activeConnect) {
      await this.activeConnect.catch(() => undefined);
      return;
    }
    // 系统分享页、权限页等都会带来 active 生命周期；健康 Room 不能因此重连。
    // SDK 内部正在自愈时同样保留，只有它已放弃的断开 Room 才由这里重建。
    if (canReuseVoiceRoom(Boolean(this.room), this.snapshot.state, this.sdkHealing)) return;
    this.sdkHealing = false;
    this.clearReconnectTimer();
    await this.disposeRoom();
    const operation = ++this.operation;
    await this.connect(operation);
  }
  private async disposeRoom(): Promise<void> {
    this.clearMemberTimer();
    const room = this.room;
    this.room = null;
    if (!room) return;
    room.removeAllListeners();
    try {
      // 停止本地推流轨道
      for (const publication of room.localParticipant.audioTrackPublications.values()) {
        try {
          publication.track?.stop();
        } catch {
          // ignore
        }
      }
      await room.disconnect();
    } catch {
      // 已死亡或已断开的房间直接释放即可。
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private startMemberPoll(): void {
    this.clearMemberTimer();
    this.memberTimer = setInterval(() => this.emitMembers(), 3_000);
  }

  private clearMemberTimer(): void {
    if (!this.memberTimer) return;
    clearInterval(this.memberTimer);
    this.memberTimer = null;
  }

  private assertCurrent(operation: number): void {
    if (!this.wanted || operation !== this.operation) throw new VoiceOperationCancelled();
  }

  private async cancelCurrentConnection(): Promise<void> {
    this.wanted = false;
    this.sdkHealing = false;
    this.operation += 1;
    this.connectAbort?.abort();
    this.connectAbort = null;
    this.clearReconnectTimer();
    this.clearMemberTimer();
    const activeConnect = this.activeConnect;
    await this.disposeRoom();
    await activeConnect?.catch(() => undefined);
    await AudioSession.stopAudioSession().catch(() => undefined);
    this.stopSystemCall();
    this.remoteMuted.clear();
  }

  private startSystemCall(): boolean {
    if (this.systemCallStarted) return true;
    this.systemCallStarted = micForeground.start(this.channelName);
    return this.systemCallStarted;
  }

  private stopSystemCall(): void {
    if (!this.systemCallStarted) return;
    micForeground.stop();
    this.systemCallStarted = false;
  }

  private emitMembers(): void {
    if (!this.room) return;
    this.setSnapshot({ state: this.snapshot.state, members: this.buildMembers(), audioOutput: this.audioOutput });
  }

  private buildMembers(): VoiceMember[] {
    const room = this.room;
    if (!room) return [];
    const local = room.localParticipant;
    const members: VoiceMember[] = [{
      id: local.identity || this.options.userId() || "me",
      name: "我",
      me: true,
      speaking: local.isSpeaking,
      selfMuted: !local.isMicrophoneEnabled,
      volume: 1,
    }];
    for (const participant of room.remoteParticipants.values()) {
      members.push(this.toMember(participant));
    }
    if (this.channelId && this.options.fallbackMembers) {
      const known = new Set(members.map((member) => member.id));
      for (const participant of this.options.fallbackMembers(this.channelId)) {
        if (known.has(participant.id) || participant.id === this.options.userId()) continue;
        members.push({
          id: participant.id,
          name: participant.name ?? this.options.resolveName(participant.id) ?? participant.id,
          me: false,
          speaking: false,
          selfMuted: false,
          volume: this.volumes.get(participant.id) ?? 1,
        });
      }
    }
    return members;
  }

  private toMember(participant: RemoteParticipant): VoiceMember {
    return {
      id: participant.identity,
      name: this.options.resolveName(participant.identity) ?? participant.name ?? participant.identity,
      me: false,
      speaking: participant.isSpeaking,
      selfMuted: this.remoteMuted.has(participant.identity) || !participant.isMicrophoneEnabled,
      volume: this.volumes.get(participant.identity) ?? 1,
    };
  }

  private setSnapshot(snapshot: Partial<VoiceSnapshot> & { state: VoiceConnectionState; members: VoiceMember[] }): void {
    const fullSnapshot: VoiceSnapshot = {
      audioOutput: this.audioOutput,
      ...snapshot,
    };
    this.snapshot = fullSnapshot;
    for (const listener of this.listeners) listener(fullSnapshot);
  }
}

class VoiceOperationCancelled extends Error {}

function reconnectDelayMs(attempt: number): number {
  const capped = Math.min(1000 * 2 ** (attempt - 1), 15_000);
  return Math.round(capped * (0.7 + Math.random() * 0.6));
}
function chooseLiveKitNode(instance: InstanceConfig): string {
  const features = instance.raw.features;
  const feature = features && typeof features === "object" && !Array.isArray(features) && "livekit" in features
    ? features.livekit
    : undefined;
  const nodes = feature && typeof feature === "object" && !Array.isArray(feature) && "nodes" in feature && Array.isArray(feature.nodes)
    ? feature.nodes
    : [];
  const node = nodes[0];
  if (node && typeof node === "object" && !Array.isArray(node) && "name" in node && typeof node.name === "string") {
    return node.name;
  }
  return "worldwide";
}
