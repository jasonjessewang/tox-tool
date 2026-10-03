import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import type { ReadingPoint } from "../engine/readings";
import { tr } from "../i18n";

const FLOOR = 0.22;

/** Height of a bar as a share of the tallest: scaled between the person's own lowest and highest reading, never below a visible stub. */
export function barShare(value: number, min: number, max: number): number {
  if (max === min) return 0.6;
  return FLOOR + (1 - FLOOR) * ((value - min) / (max - min));
}

/**
 * A person's own readings of one metric, oldest to newest. Scaled between their own lowest and highest, so it shows which way
 * the numbers have moved -- not whether any of them is good. Plain Views, like BarChart: nothing to install, nothing to trust.
 */
export function TrendStrip({ points, unit, label, maxHeight = 64 }: { points: ReadingPoint[]; unit: string; label: string; maxHeight?: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spoken = tr("{label}: {points}. Scaled to your own lowest and highest.", { label, points: points.map((p) => `${p.day} ${p.value}${unit ? ` ${unit}` : ""}`).join(", ") });
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={styles.row}>
      {points.map((p, i) => (
        <View key={`${p.day}-${i}`} style={styles.col}>
          <Text style={styles.value}>{p.value}</Text>
          <View style={[styles.track, { height: maxHeight }]}>
            <View style={[styles.bar, { height: Math.max(3, barShare(p.value, min, max) * maxHeight), opacity: i === points.length - 1 ? 1 : 0.55 }]} />
          </View>
          <Text style={styles.day}>{p.day.slice(5)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 },
  col: { alignItems: "center", flex: 1 },
  value: { fontSize: 11, color: colors.ink, fontWeight: "600", marginBottom: 3 },
  track: { justifyContent: "flex-end", width: 14 },
  bar: { width: 14, borderRadius: 3, backgroundColor: colors.accent },
  day: { fontSize: 11, color: colors.muted, marginTop: 4 },
});
