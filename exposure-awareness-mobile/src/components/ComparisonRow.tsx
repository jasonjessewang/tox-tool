import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radiusSm } from "../theme";
import { READ_LABEL, type ComparisonPart, type ComparisonRead } from "../engine/signals/types";
import { msg, tr } from "../i18n";

export const READ_COLOR: Record<ComparisonRead, string> = {
  on_target: colors.accent,
  close: colors.accent,
  room_to_grow: colors.warn,
  not_enough_yet: colors.muted,
};

const BASIS_WORD: Record<ComparisonPart["basis"], string> = {
  guideline: msg("GUIDELINE"),
  reference_rules: msg("APP RULES"),
  cadence: msg("ROUTINE"),
  curriculum: msg("CURRICULUM"),
  own_baseline: msg("YOUR EARLIER SELF"),
};

/** One comparison, in words and as a bar: what was measured, what it was compared with, and how it reads. */
export function ComparisonRow({ part }: { part: ComparisonPart }) {
  const color = READ_COLOR[part.read];
  const ratio = part.ratio === null ? 0 : Math.max(0, Math.min(1, part.ratio));
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.label}>{tr(part.label)}</Text>
        <Text style={[styles.read, { color }]}>{tr(READ_LABEL[part.read])}</Text>
      </View>
      <Text style={styles.measured}>{tr(part.measured)}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color, opacity: part.read === "not_enough_yet" ? 0.35 : 1 }]} />
      </View>
      <Text style={styles.against}>
        <Text style={styles.basis}>{tr(BASIS_WORD[part.basis])}  </Text>
        {tr("Compared with {against}", { against: tr(part.against) })}
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
  track: { height: 5, borderRadius: radiusSm, backgroundColor: colors.track, marginTop: 6, overflow: "hidden" },
  fill: { height: 5, borderRadius: radiusSm },
  against: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 15 },
  basis: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.accent },
});
