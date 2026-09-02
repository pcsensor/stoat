import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View,
} from "react-native";
import { BORDER, PALETTE, SHADOW, SMALL_SHADOW } from "./theme";

type ButtonTone = "acid" | "violet" | "cyan" | "coral" | "pink" | "paper" | "ink";

const BUTTON_COLORS: Record<ButtonTone, string> = {
  acid: PALETTE.acid,
  violet: PALETTE.violet,
  cyan: PALETTE.cyan,
  coral: PALETTE.coral,
  pink: PALETTE.pink,
  paper: PALETTE.paper,
  ink: PALETTE.ink,
};

export function BrutalButton({
  label,
  onPress,
  tone = "acid",
  disabled = false,
  busy = false,
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}) {
  const lightText = tone === "ink" || tone === "violet" || tone === "coral";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: BUTTON_COLORS[tone] },
        pressed && styles.pressed,
        (disabled || busy) && styles.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={lightText ? PALETTE.white : PALETTE.ink} />
      ) : (
        <Text style={[styles.buttonText, lightText && styles.buttonTextLight]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function BrutalCard({
  children,
  color = PALETTE.white,
  style,
  noShadow = false,
}: PropsWithChildren<{ color?: string; style?: StyleProp<ViewStyle>; noShadow?: boolean }>) {
  return <View style={[styles.card, { backgroundColor: color }, !noShadow && SHADOW, style]}>{children}</View>;
}

export function BrutalInput({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={PALETTE.muted}
      selectionColor={PALETTE.violet}
      {...props}
      style={[styles.input, style]}
    />
  );
}

export function Label({ children, color = PALETTE.acid }: PropsWithChildren<{ color?: string }>) {
  return (
    <View style={[styles.label, { backgroundColor: color }]}>
      <Text style={styles.labelText}>{children}</Text>
    </View>
  );
}

export function SectionTitle({ kicker, title, aside }: { kicker: string; title: string; aside?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {aside ? <Text style={styles.aside}>{aside}</Text> : null}
    </View>
  );
}

export function EmptyState({ symbol, title, body }: { symbol: string; title: string; body: string }) {
  return (
    <BrutalCard color={PALETTE.cyan} style={styles.emptyCard}>
      <Text style={styles.emptySymbol}>{symbol}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </BrutalCard>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    paddingHorizontal: 17,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    ...SMALL_SHADOW,
  },
  buttonCompact: { minHeight: 39, paddingVertical: 7, paddingHorizontal: 12 },
  pressed: { transform: [{ translateX: 3 }, { translateY: 3 }], shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  disabled: { opacity: 0.45 },
  buttonText: { color: PALETTE.ink, fontWeight: "900", fontSize: 14, letterSpacing: 0.4 },
  buttonTextLight: { color: PALETTE.white },
  card: { borderWidth: BORDER, borderColor: PALETTE.ink, padding: 16 },
  input: {
    minHeight: 50,
    borderWidth: BORDER,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.white,
    color: PALETTE.ink,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "700",
  },
  label: { alignSelf: "flex-start", borderWidth: 2, borderColor: PALETTE.ink, paddingHorizontal: 8, paddingVertical: 4 },
  labelText: { color: PALETTE.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  sectionTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionTitleCopy: { flex: 1 },
  kicker: { color: PALETTE.muted, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: PALETTE.ink, fontSize: 25, lineHeight: 29, fontWeight: "900", marginTop: 3 },
  aside: { color: PALETTE.muted, fontSize: 11, fontWeight: "800" },
  emptyCard: { margin: 18, alignItems: "flex-start" },
  emptySymbol: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: PALETTE.ink, fontSize: 20, fontWeight: "900" },
  emptyBody: { color: PALETTE.ink, lineHeight: 20, fontWeight: "600", marginTop: 6 },
});
