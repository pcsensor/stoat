import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import type { Channel as SDKChannel } from "stoat.js";
import type { VoiceSnapshot } from "../voice-room";
import { BrutalButton, BrutalCard, Label } from "../ui/primitives";
import { BORDER, PALETTE, SHADOW, SMALL_SHADOW } from "../ui/theme";

export function VoiceView({
  channel,
  snapshot,
  inviteCode,
  busy,
  onJoin,
  onCycleVolume,
}: {
  channel: SDKChannel;
  snapshot: VoiceSnapshot;
  inviteCode: string;
  busy: boolean;
  onJoin: (channel: SDKChannel) => void;
  onCycleVolume: (id: string) => void;
}) {
  const active = snapshot.state === "connecting" || snapshot.state === "connected" || snapshot.state === "reconnecting";
  if (!active) {
    return (
      <ScrollView contentContainerStyle={styles.joinPage}>
        <View style={styles.voiceMark}><Text style={styles.voiceMarkText}>◉</Text></View>
        <Label color={PALETTE.pink}>LIVE VOICE</Label>
        <Text style={styles.joinTitle}>进来坐坐，{`\n`}声音比文字快。</Text>
        <Text style={styles.joinBody}>加入「{channel.name}」，连接后会发布麦克风。Android 会显示常驻通话通知，以保证切到后台后音频不中断。</Text>
        {snapshot.error ? <BrutalCard color={PALETTE.coral} style={styles.errorCard}><Text style={styles.errorText}>{snapshot.error}</Text></BrutalCard> : null}
        <BrutalButton label={busy ? "正在连接…" : "加入语音频道 →"} tone="acid" busy={busy} onPress={() => onJoin(channel)} style={styles.joinButton} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.roomPage}>
      <View style={styles.roomHero}>
        <View style={styles.roomHeroCopy}>
          <Label color={snapshot.state === "reconnecting" ? PALETTE.amber : PALETTE.cyan}>{snapshot.state === "reconnecting" ? "RECONNECTING" : snapshot.state === "connecting" ? "CONNECTING" : "ON AIR"}</Label>
          <Text style={styles.roomTitle}>{channel.name}</Text>
          <Text style={styles.roomMeta}>{snapshot.members.length} 人在房间 · 点击成员调节音量</Text>
        </View>
        <View style={[styles.pulse, snapshot.state === "reconnecting" && { backgroundColor: PALETTE.amber }]}><Text style={styles.pulseText}>{snapshot.state === "connected" ? "●" : "…"}</Text></View>
      </View>
      {snapshot.state === "reconnecting" ? <BrutalCard color={PALETTE.amber} style={styles.banner}><Text style={styles.bannerText}>网络信号不稳，正在尝试重新加入房间。</Text></BrutalCard> : null}
      {inviteCode ? (
        <Pressable onPress={() => Share.share({ message: `Radio 服务器邀请码：${inviteCode}` })} style={({ pressed }) => [styles.invite, pressed && styles.pressed]}>
          <View><Text style={styles.inviteKicker}>邀请朋友</Text><Text style={styles.inviteCode}>{inviteCode}</Text></View>
          <Text style={styles.inviteShare}>分享 ↗</Text>
        </Pressable>
      ) : null}
      <Text style={styles.membersTitle}>房间成员</Text>
      <View style={styles.membersGrid}>
        {snapshot.members.map((member, index) => (
          <Pressable
            key={member.id}
            disabled={member.me}
            onPress={() => onCycleVolume(member.id)}
            style={({ pressed }) => [styles.memberCard, { backgroundColor: member.speaking ? PALETTE.acid : member.me ? PALETTE.violet : index % 2 ? PALETTE.white : PALETTE.cyan }, member.me && styles.memberMe, pressed && styles.pressed]}
          >
            <View style={[styles.avatar, member.speaking && styles.avatarSpeaking]}><Text style={styles.avatarText}>{member.name.slice(0, 2).toUpperCase()}</Text></View>
            <View style={styles.memberCopy}>
              <Text style={[styles.memberName, member.me && styles.memberNameLight]} numberOfLines={1}>{member.name}</Text>
              <Text style={[styles.memberState, member.me && styles.memberNameLight]}>{member.speaking ? "正在说话" : member.selfMuted ? "麦克风已静音" : member.me ? "这是你" : "正在收听"}</Text>
            </View>
            {!member.me && member.volume < 1 ? <View style={styles.volumeTag}><Text style={styles.volumeText}>{Math.round(member.volume * 100)}%</Text></View> : null}
          </Pressable>
        ))}
      </View>
      <BrutalCard color={PALETTE.paperDeep} noShadow style={styles.tipCard}>
        <Text style={styles.tipTitle}>操作提示</Text>
        <Text style={styles.tipBody}>点击远端成员：100% → 50% → 20% → 100%。静音和挂断按钮在顶部工具栏。</Text>
      </BrutalCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PALETTE.paper },
  joinPage: { flexGrow: 1, justifyContent: "center", alignItems: "flex-start", padding: 22, backgroundColor: PALETTE.violet },
  voiceMark: { width: 86, height: 86, borderWidth: BORDER, borderColor: PALETTE.ink, backgroundColor: PALETTE.coral, alignItems: "center", justifyContent: "center", marginBottom: 18, transform: [{ rotate: "5deg" }], ...SHADOW },
  voiceMarkText: { color: PALETTE.white, fontSize: 46, fontWeight: "900" },
  joinTitle: { color: PALETTE.white, fontSize: 39, lineHeight: 40, letterSpacing: -1.4, fontWeight: "900", marginTop: 11 },
  joinBody: { color: PALETTE.white, opacity: 0.85, fontWeight: "700", lineHeight: 21, marginTop: 12, maxWidth: 540 },
  joinButton: { alignSelf: "stretch", marginTop: 22 },
  errorCard: { marginTop: 16 },
  errorText: { color: PALETTE.white, fontWeight: "800", lineHeight: 19 },
  roomPage: { padding: 15, paddingBottom: 40 },
  roomHero: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  roomHeroCopy: { flex: 1, alignItems: "flex-start" },
  roomTitle: { color: PALETTE.ink, fontSize: 32, fontWeight: "900", marginTop: 5 },
  roomMeta: { color: PALETTE.muted, fontSize: 11, fontWeight: "800", marginTop: 3 },
  pulse: { width: 62, height: 62, borderWidth: BORDER, borderColor: PALETTE.ink, backgroundColor: PALETTE.acid, alignItems: "center", justifyContent: "center", ...SMALL_SHADOW },
  pulseText: { color: PALETTE.ink, fontSize: 29, fontWeight: "900" },
  banner: { marginBottom: 14, padding: 11 },
  bannerText: { color: PALETTE.ink, fontWeight: "900" },
  invite: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: BORDER, borderColor: PALETTE.ink, backgroundColor: PALETTE.pink, padding: 12, marginRight: 5, marginBottom: 20, ...SMALL_SHADOW },
  inviteKicker: { color: PALETTE.ink, fontSize: 9, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  inviteCode: { color: PALETTE.ink, fontSize: 22, fontWeight: "900", marginTop: 2 },
  inviteShare: { color: PALETTE.ink, fontWeight: "900" },
  membersTitle: { color: PALETTE.ink, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 9 },
  membersGrid: { gap: 11 },
  memberCard: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: BORDER, borderColor: PALETTE.ink, padding: 10, marginRight: 4, marginBottom: 4, ...SMALL_SHADOW },
  memberMe: { backgroundColor: PALETTE.violet },
  avatar: { width: 49, height: 49, borderWidth: 2, borderColor: PALETTE.ink, backgroundColor: PALETTE.paper, alignItems: "center", justifyContent: "center" },
  avatarSpeaking: { backgroundColor: PALETTE.coral },
  avatarText: { color: PALETTE.ink, fontWeight: "900" },
  memberCopy: { flex: 1 },
  memberName: { color: PALETTE.ink, fontSize: 15, fontWeight: "900" },
  memberNameLight: { color: PALETTE.white },
  memberState: { color: PALETTE.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  volumeTag: { borderWidth: 2, borderColor: PALETTE.ink, backgroundColor: PALETTE.amber, paddingHorizontal: 7, paddingVertical: 4 },
  volumeText: { color: PALETTE.ink, fontSize: 10, fontWeight: "900" },
  tipCard: { marginTop: 18, padding: 12 },
  tipTitle: { color: PALETTE.ink, fontWeight: "900" },
  tipBody: { color: PALETTE.muted, fontWeight: "700", fontSize: 11, lineHeight: 17, marginTop: 4 },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 0, height: 0 }, elevation: 0 },
});
