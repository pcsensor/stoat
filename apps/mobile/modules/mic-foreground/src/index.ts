/**
 * 麦克风与系统级通话前台服务桥接（类 Jitsi Meet 通话设计）。
 * 进语音频道时 start，离开时 stop。
 * 包含 Android 系统级通话识别、WakeLock 防锁屏断网、WifiLock 与电池优化检测。
 */
import { requireOptionalNativeModule, type EventSubscription } from "expo-modules-core";
import { Platform } from "react-native";

interface MicForegroundNative {
  start(channelName: string): boolean;
  stop(): boolean;
  setMuted?(muted: boolean): boolean;
  isBatteryOptimizationIgnored(): boolean;
  requestIgnoreBatteryOptimization(): boolean;
}

interface MicForegroundEvents {
  onCallEnded: () => void;
  onCallMuted: (event: { muted: boolean }) => void;
  onAudioSessionActivated: () => void;
  onAudioSessionDeactivated: () => void;
  onAudioInterrupted: (event: { phase: "began" | "ended"; shouldResume: boolean }) => void;
}

type MicForegroundNativeModule = MicForegroundNative & {
  addListener<EventName extends keyof MicForegroundEvents>(
    eventName: EventName,
    listener: MicForegroundEvents[EventName]
  ): EventSubscription;
};

const native: MicForegroundNativeModule | null =
  Platform.OS === "android" || Platform.OS === "ios"
    ? requireOptionalNativeModule<MicForegroundNativeModule>("MicForeground")
    : null;

export const micForeground = {
  start(channelName: string): boolean {
    if (!native) return true;
    try {
      return native.start(channelName);
    } catch {
      return false;
    }
  },
  stop(): boolean {
    if (!native) return true;
    try {
      return native.stop();
    } catch {
      return false;
    }
  },
  setMuted(muted: boolean): boolean {
    if (!native || !native.setMuted) return true;
    try {
      return native.setMuted(muted);
    } catch {
      return false;
    }
  },
  isBatteryOptimizationIgnored(): boolean {
    if (!native) return true;
    try {
      return native.isBatteryOptimizationIgnored();
    } catch {
      return true;
    }
  },
  requestIgnoreBatteryOptimization(): boolean {
    if (!native) return false;
    try {
      return native.requestIgnoreBatteryOptimization();
    } catch {
      return false;
    }
  },
  addListener<EventName extends keyof MicForegroundEvents>(
    eventName: EventName,
    listener: MicForegroundEvents[EventName]
  ): EventSubscription {
    // 原生模块缺失时（Expo Go / Web）返回可安全清理的空订阅。
    if (!native) return { remove: () => undefined };
    return native.addListener(eventName, listener);
  },
};
