import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import { tr } from "../i18n";

export interface BarChartDatum {
  label: string;
  value: number;
}

/**
 * Deliberately plain-View bars, not a charting library. A simple comparison chart
 * doesn't need react-native-svg's native-module surface (and the extra unverified-
 * dependency risk that comes with it in an environment where nothing can be tested on
 * a real device yet) -- flexbox heights are enough and are fully verified by
 * screenshotting the running app.
 */
export function BarChart({
  data,
  barColor = colors.accent,
  maxHeight = 120,
  suffix = "",
  label = tr("Chart"),
}: {
  data: BarChartDatum[];
  barColor?: string;
  maxHeight?: number;
  suffix?: string;
  /** what the chart shows, for anyone who cannot see it: read out ahead of the values */
  label?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={`${label}: ${data.map((d) => `${d.label} ${d.value}${suffix}`).join(", ")}`}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * maxHeight);
        return (
          <View key={i} style={styles.col}>
            <Text style={styles.value}>
              {d.value}
              {suffix}
            </Text>
            <View style={[styles.barTrack, { height: maxHeight }]}>
              <View style={[styles.bar, { height: h, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.label}>{d.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8 },
  col: { alignItems: "center", flex: 1 },
  value: { fontSize: 12, color: colors.ink, marginBottom: 4, fontWeight: "600" },
  barTrack: { justifyContent: "flex-end", width: 20 },
  bar: { width: 20, borderRadius: 4, minHeight: 2 },
  label: { fontSize: 12, color: colors.muted, marginTop: 6 },
});
