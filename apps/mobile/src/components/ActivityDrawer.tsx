import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrutalButton, Label } from "../ui/primitives";
import { BORDER, PALETTE } from "../ui/theme";

export type ActivityLog = { id: number; time: number; message: string; level: "info" | "ok" | "err" };

export function ActivityDrawer({ visible, logs, onClose }: { visible: boolean; logs: ActivityLog[]; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerCopy}><Label color={PALETTE.amber}>ACTIVITY</Label><Text style={styles.title}>连接活动</Text></View>
            <BrutalButton label="关闭" compact tone="coral" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.logs}>
            {logs.length ? logs.slice().reverse().map((item) => (
              <View key={item.id} style={[styles.row, item.level === "ok" && styles.rowOk, item.level === "err" && styles.rowErr]}>
                <Text style={styles.time}>{new Date(item.time).toLocaleTimeString()}</Text>
                <Text style={styles.message}>{item.message}</Text>
              </View>
            )) : <Text style={styles.empty}>暂无活动记录。</Text>}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23,23,23,0.55)" },
  dismiss: { flex: 1 },
  panel: { height: "62%", backgroundColor: PALETTE.ink, borderTopWidth: BORDER, borderTopColor: PALETTE.ink, padding: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: PALETTE.paper },
  headerCopy: { flex: 1, alignItems: "flex-start" },
  title: { color: PALETTE.white, fontSize: 24, fontWeight: "900", marginTop: 4 },
  logs: { paddingVertical: 12, gap: 8 },
  row: { flexDirection: "row", gap: 10, borderWidth: 2, borderColor: PALETTE.paper, backgroundColor: "#2B2B2B", padding: 9 },
  rowOk: { backgroundColor: "#123B22" },
  rowErr: { backgroundColor: "#4A1C1A" },
  time: { color: PALETTE.amber, fontSize: 10, fontWeight: "900" },
  message: { flex: 1, color: PALETTE.white, fontSize: 11, lineHeight: 16, fontWeight: "600" },
  empty: { color: PALETTE.fog, fontWeight: "700" },
});
