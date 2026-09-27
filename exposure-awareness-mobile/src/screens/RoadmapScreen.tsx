import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { getJourney } from "../engine/journeyState";
import type { Stage } from "../engine/journeyStages";
import { colors, radius, shadow } from "../theme";

export default function RoadmapScreen() {
  const [stages, setStages] = useState<Stage[]>([]);
  useEffect(() => {
    getJourney().then((j) => setStages(j.stages));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Your roadmap</Text>
      <Text style={styles.sub}>Three stages, unlocked in order. Only your next step is shown on the main Journey page.</Text>
      {stages.map((s) => (
        <View key={s.id} style={[styles.stage, !s.unlocked && { opacity: 0.55 }]}>
          <View style={styles.stageHead}>
            <Text style={styles.stageTitle}>
              {s.unlocked ? "" : "🔒 "}
              {s.title}
            </Text>
            <Text style={styles.count}>{s.done}/{s.total}</Text>
          </View>
          <Text style={styles.blurb}>{s.blurb}</Text>
          {s.steps.map((st) => (
            <View key={st.id} style={styles.step}>
              <Text style={[styles.mark, st.completed && { color: colors.accent }]}>{st.completed ? "✓" : "○"}</Text>
              <Text style={[styles.stepText, st.completed && { color: colors.muted, textDecorationLine: "line-through" }]}>{st.title}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  stage: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  stageHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stageTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
  count: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  blurb: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 8 },
  step: { flexDirection: "row", gap: 10, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  mark: { fontSize: 15, color: colors.muted, width: 18 },
  stepText: { flex: 1, fontSize: 14, color: colors.ink },
});
