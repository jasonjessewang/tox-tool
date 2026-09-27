import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radiusSm } from "../theme";
import { READ_LABEL, type ComparisonPart, type ComparisonRead } from "../engine/signals/types";

export const READ_COLOR: Record<ComparisonRead, string> = {
  on_target: colors.accent,
  close: colors.accent,
  room_to_grow: colors.warn,
  not_enough_yet: colors.muted,
};

const BASIS_WORD: Record<ComparisonPart["basis"], string> = {
  guideline: "GUIDELINE",
  reference_rules: "APP RULES",
  cadence: "ROUTINE",
  curriculum: "CURRICULUM",
  own_baseline: "YOUR EARLIER SELF",
};

/** One comparison, in words and as a bar: what was measured, what it was compared with, and how it reads. */
export function ComparisonRow({ part }: { part: ComparisonPart }) {
  const color = READ_COLOR[part.read];
  const ratio = part.ratio === null ? 0 : Math.max(0, Math.min(1, part.ratio));
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.label}>{part.label}</Text>
        <Text style={[styles.read, { color }]}>{READ_LABEL[part.read]}</Text>
      </View>
      <Text style={styles.measured}>{part.measured}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color, opacity: part.read === "not_enough_yet" ? 0.35 : 1 }]} />
      </View>
      <Text style={styles.against}>
        <Text style={styles.basis}>{BASIS_WORD[part.basis]}  </Text>
        Compared with {part.against}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
  read: { fontSize: 12, fontWeight: "700" },
  measured: { fontSize: 12, color: colors.ink, marginTop: 2 },
  track: { height: 5, borderRadius: radiusSm, backgroundColor: "#eee9dd", marginTop: 6, overflow: "hidden" },
  fill: { height: 5, borderRadius: radiusSm },
  against: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 15 },
  basis: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.accent },
});
