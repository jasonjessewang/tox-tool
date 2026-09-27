import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Collapsible } from "./Collapsible";
import { ComparisonRow } from "./ComparisonRow";
import { colors, radius } from "../theme";
import { useContentComplexity } from "../util/complexity";
import type { Receipt } from "../engine/receipts";

/**
 * What every recorded activity comes back with: how it compares. The headline is always visible; the comparisons behind
 * it (what was measured, what it was compared with) are one tap away, so the receipt informs without crowding the screen.
 */
export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const { score } = receipt;
  const level = useContentComplexity();
  return (
    <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.headline}>{receipt.headline}</Text>
      {receipt.unscored ? (
        <Text style={styles.note}>{receipt.unscored}</Text>
      ) : (
        <>
          {receipt.lines.map((line) => (
            <Text key={line.key} style={styles.line}>
              {line.headline}
              {line.vsBefore && line.vsBefore.change !== 0 ? ` (${line.vsBefore.change > 0 ? "+" : ""}${line.vsBefore.change} against ${line.vsBefore.window} ago)` : ""}
            </Text>
          ))}
          <Text style={styles.coverage}>
            Picture filled in: {score.coverageBefore}% {"→"} {score.coverageAfter}%
          </Text>
          {receipt.lines.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Collapsible title="How this compares" teaser="What it was measured against" defaultOpen={level === "technical"}>
                {receipt.lines.map((line) => (
                  <View key={line.key} style={{ marginBottom: 4 }}>
                    <Text style={styles.partTitle}>{line.label}</Text>
                    {line.parts.map((p) => (
                      <ComparisonRow key={p.label} part={p} />
                    ))}
                  </View>
                ))}
                {receipt.notes.map((n, i) => (
                  <Text key={i} style={styles.note}>
                    {n}
                  </Text>
                ))}
              </Collapsible>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius, padding: 14, marginBottom: 12 },
  headline: { fontSize: 14, fontWeight: "700", color: colors.accent },
  line: { fontSize: 12, color: colors.ink, marginTop: 6, lineHeight: 17 },
  coverage: { fontSize: 12, color: colors.muted, marginTop: 6 },
  partTitle: { fontSize: 12, fontWeight: "700", color: colors.accent, textTransform: "uppercase", marginTop: 6 },
  note: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 16, fontStyle: "italic" },
});
