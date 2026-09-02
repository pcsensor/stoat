import React from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BrutalButton } from "../ui/primitives";
import { BORDER, PALETTE } from "../ui/theme";

interface ImageViewerModalProps {
  url: string | null;
  onClose: () => void;
}

export function ImageViewerModal({ url, onClose }: ImageViewerModalProps) {
  if (!url) return null;

  return (
    <Modal visible={Boolean(url)} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            图片查看
          </Text>
          <View style={styles.headerActions}>
            <BrutalButton
              label="原图 ↗"
              compact
              tone="cyan"
              onPress={() => Linking.openURL(url).catch(() => undefined)}
            />
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.imageContainer} onPress={onClose}>
          <Image source={{ uri: url }} style={styles.image} resizeMode="contain" resizeMethod="resize" />
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: BORDER,
    borderBottomColor: PALETTE.ink,
    backgroundColor: PALETTE.paper,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: PALETTE.ink,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: PALETTE.ink,
    backgroundColor: PALETTE.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 22,
    fontWeight: "900",
    color: PALETTE.white,
    lineHeight: 24,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
