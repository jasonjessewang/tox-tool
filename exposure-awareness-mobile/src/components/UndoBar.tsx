import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radiusSm } from "../theme";

/**
 * Removing an entry is one tap; taking it back is one more. The bar stays until it is used, dismissed, or another entry is removed --
 * it does not time out, so someone who reads slowly, or is using a screen reader, is not racing a clock.
 */
export function useUndo() {
  const [pending, setPending] = useState<{ what: string; restore: () => Promise<void> } | null>(null);
  return {
    pending,
    offer: (what: string, restore: () => Promise<void>) => setPending({ what, restore }),
    undo: async () => {
      const p = pending;
      setPending(null);
      if (p) await p.restore();
    },
    dismiss: () => setPending(null),
  };
}

export function UndoBar({ undo }: { undo: ReturnType<typeof useUndo> }) {
  if (!undo.pending) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert" aria-live="polite">
      <Text style={styles.text}>Removed: {undo.pending.what}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Undo: put back ${undo.pending.what}`} onPress={undo.undo} style={styles.action}>
        <Text style={styles.actionText}>Undo</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={undo.dismiss} style={styles.action}>
        <Text style={styles.dismissText}>{"×"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: radiusSm, paddingLeft: 12, marginBottom: 10 },
  text: { flex: 1, fontSize: 13, color: colors.ink, paddingVertical: 10 },
  action: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  dismissText: { fontSize: 20, color: colors.muted },
});
