import React from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { colors, radius, shadow } from "../../theme";
import { tr } from "../../i18n";

export function ToolHeader({ title, blurb, onBack, backLabel = tr("Engine") }: { title: string; blurb: string; onBack: () => void; backLabel?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={{ marginBottom: 12, paddingVertical: 8 }}>
        <Text style={styles.back}>{"‹"} {backLabel}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.h1}>{title}</Text>
      <Text style={styles.blurb}>{blurb}</Text>
    </View>
  );
}

export function ChipRow<T extends string | number>({ options, value, onChange, format }: { options: T[]; value: T; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <Pressable accessibilityRole="radio" key={String(o)} onPress={() => onChange(o)} aria-checked={!!(value === o)} style={[styles.chip, value === o && styles.chipOn]}>
          <Text style={[styles.chipText, value === o && { color: colors.onAccent }]}>{format ? format(o) : String(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

/** 1,000 people as dots: grey = would have it anyway, orange = extra from the exposure. */
export function PeopleArray({ baseline, extra, total = 1000 }: { baseline: number; extra: number; total?: number }) {
  const { width } = useWindowDimensions();
  const cols = 40;
  const gap = 2;
  // screen padding 16*2 + card padding 16*2 + border 2
  const size = Math.max(3, Math.floor((width - 66 - gap * (cols - 1)) / cols));
  const b = Math.round(baseline);
  const e = Math.round(extra);
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap, marginTop: 6 }}>
        {Array.from({ length: total }, (_, i) => {
          const isBase = i < b;
          const isExtra = !isBase && i < b + e;
          return (
            <View
              key={i}
              style={{
                width: size,
                height: size,
                borderRadius: 2,
                backgroundColor: isBase ? colors.vizNeutral : isExtra ? colors.vizAmber : colors.vizMuted,
                transform: isExtra ? [{ scale: 1.8 }] : undefined,
                zIndex: isExtra ? 2 : 0,
              }}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.vizNeutral }]} />
        <Text style={styles.legendText}>{tr("would happen anyway")}</Text>
        <View style={[styles.legendDot, { backgroundColor: colors.vizAmber, marginLeft: 14 }]} />
        <Text style={styles.legendText}>{tr("extra from the exposure")}</Text>
      </View>
    </View>
  );
}

export const cardStyle = { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginTop: 14, ...shadow } as const;

const styles = StyleSheet.create({
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  h1: { fontSize: 24, fontWeight: "700", color: colors.ink },
  blurb: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 18, marginBottom: 8 },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 4 },
  dot: { aspectRatio: 1, borderRadius: 3, backgroundColor: colors.vizMuted },
  dotBase: { backgroundColor: colors.vizNeutral },
  dotExtra: { backgroundColor: colors.vizAmber, transform: [{ scale: 1.9 }], zIndex: 2 },
  legend: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 12, color: colors.muted, marginLeft: 5 },
});
