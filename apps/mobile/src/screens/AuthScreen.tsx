import { useEffect, useRef } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboard } from "../hooks/useKeyboard";
import { BrutalButton, BrutalCard, BrutalInput, Label } from "../ui/primitives";
import { PALETTE } from "../ui/theme";

export type AuthMode = "login" | "register";

interface AuthScreenProps {
  mode: AuthMode;
  domain: string;
  email: string;
  password: string;
  invite: string;
  username: string;
  busy: boolean;
  error?: string;
  onMode: (mode: AuthMode) => void;
  onDomain: (value: string) => void;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onInvite: (value: string) => void;
  onUsername: (value: string) => void;
  onSubmit: () => void;
}

export function AuthScreen(props: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const { keyboardHeight } = useKeyboard();
  const scrollRef = useRef<ScrollView>(null);

  const bottomPadding = keyboardHeight > 0
    ? (Platform.OS === "android" ? keyboardHeight + 100 : Math.max(30, keyboardHeight - insets.bottom + 100))
    : 30;

  useEffect(() => {
    if (keyboardHeight > 0) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 200, animated: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [keyboardHeight]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={PALETTE.acid} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.page, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoText}>R!</Text></View>
          <View style={styles.heroCopy}>
            <Label color={PALETTE.pink}>SELF-HOSTED SOCIAL</Label>
            <Text style={styles.wordmark}>RADIO</Text>
            <Text style={styles.tagline}>你的社区，{`\n`}你的服务器，{`\n`}你的声音。</Text>
          </View>
        </View>

        <BrutalCard color={PALETTE.paper} style={styles.formCard}>
          <View style={styles.modeRow}>
            <BrutalButton label="登录" compact tone={props.mode === "login" ? "violet" : "paper"} onPress={() => props.onMode("login")} style={styles.modeButton} />
            <BrutalButton label="注册" compact tone={props.mode === "register" ? "cyan" : "paper"} onPress={() => props.onMode("register")} style={styles.modeButton} />
          </View>
          <Text style={styles.formTitle}>{props.mode === "login" ? "欢迎回来 👋" : "加入你的社区 ⚡"}</Text>
          <Text style={styles.formIntro}>连接兼容 Stoat 的自建实例。Radio 是独立开发的非官方客户端。</Text>

          <Text style={styles.fieldLabel}>实例地址</Text>
          <BrutalInput
            value={props.domain}
            onChangeText={props.onDomain}
            placeholder="chat.example.com"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => scrollRef.current?.scrollTo({ y: 40, animated: true })}
          />
          <Text style={styles.fieldLabel}>邮箱</Text>
          <BrutalInput
            value={props.email}
            onChangeText={props.onEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => scrollRef.current?.scrollTo({ y: 160, animated: true })}
          />
          <Text style={styles.fieldLabel}>密码</Text>
          <BrutalInput
            value={props.password}
            onChangeText={props.onPassword}
            placeholder="••••••••"
            secureTextEntry
            onSubmitEditing={props.mode === "login" ? props.onSubmit : undefined}
            onFocus={() => scrollRef.current?.scrollTo({ y: 280, animated: true })}
          />

          {props.mode === "register" ? (
            <>
              <Text style={styles.fieldLabel}>注册邀请码</Text>
              <BrutalInput
                value={props.invite}
                onChangeText={props.onInvite}
                placeholder="一次性邀请码"
                autoCapitalize="none"
                onFocus={() => scrollRef.current?.scrollTo({ y: 350, animated: true })}
              />
              <Text style={styles.fieldLabel}>用户名</Text>
              <BrutalInput
                value={props.username}
                onChangeText={props.onUsername}
                placeholder="留空则自动生成"
                onSubmitEditing={props.onSubmit}
                onFocus={() => scrollRef.current?.scrollTo({ y: 420, animated: true })}
              />
            </>
          ) : null}

          {props.error ? <View style={styles.errorBox}><Text style={styles.errorText}>{props.error}</Text></View> : null}
          <BrutalButton
            label={props.mode === "login" ? "进入 Radio →" : "创建账号 →"}
            tone={props.mode === "login" ? "acid" : "cyan"}
            onPress={props.onSubmit}
            busy={props.busy}
            style={styles.submit}
          />
        </BrutalCard>

          <View style={styles.footerStrip}>
            <Text style={styles.footerText}>VOICE FIRST</Text>
            <Text style={styles.footerDot}>◆</Text>
            <Text style={styles.footerText}>NO CLOUD LOCK-IN</Text>
            <Text style={styles.footerDot}>◆</Text>
            <Text style={styles.footerText}>COMMUNITY OWNED</Text>
          </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PALETTE.acid },
  flex: { flex: 1 },
  page: { flexGrow: 1, backgroundColor: PALETTE.acid, padding: 18, paddingBottom: 30 },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginTop: 10, marginBottom: 22 },
  logo: { width: 74, height: 74, backgroundColor: PALETTE.coral, borderWidth: 3, borderColor: PALETTE.ink, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-4deg" }] },
  logoText: { color: PALETTE.white, fontSize: 32, fontWeight: "900" },
  heroCopy: { flex: 1, alignItems: "flex-start" },
  wordmark: { color: PALETTE.ink, fontSize: 45, lineHeight: 49, fontWeight: "900", letterSpacing: -2 },
  tagline: { color: PALETTE.ink, fontSize: 17, lineHeight: 20, fontWeight: "900" },
  formCard: { gap: 2 },
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  modeButton: { flex: 1 },
  formTitle: { color: PALETTE.ink, fontSize: 25, fontWeight: "900" },
  formIntro: { color: PALETTE.muted, lineHeight: 19, fontWeight: "600", marginTop: 5, marginBottom: 12 },
  fieldLabel: { color: PALETTE.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, marginTop: 12, marginBottom: 5, textTransform: "uppercase" },
  errorBox: { borderWidth: 3, borderColor: PALETTE.ink, backgroundColor: PALETTE.coral, padding: 10, marginTop: 14 },
  errorText: { color: PALETTE.white, fontWeight: "800", lineHeight: 19 },
  submit: { marginTop: 18 },
  footerStrip: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 24 },
  footerText: { color: PALETTE.ink, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  footerDot: { color: PALETTE.violet },
});
