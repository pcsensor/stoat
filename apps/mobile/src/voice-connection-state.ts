/** 语音控制器对现有 LiveKit Room 的最小连接状态判断。 */
export type VoiceConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

/**
 * 已连接的 Room 不应因为应用重新获得前台而被销毁；系统分享页、权限页等都可能
 * 触发该生命周期。SDK 正在自行重连时也要保留它。只有没有 Room，或 SDK 已放弃
 * 重连的断开 Room，才交给控制器重建。
 */
export function canReuseVoiceRoom(
  hasRoom: boolean,
  state: VoiceConnectionState,
  sdkHealing: boolean
): boolean {
  return hasRoom && (state === "connected" || sdkHealing);
}
