import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import * as quests from "../engine/quests";
import * as trends from "../engine/trends";
import type { StarterQuest } from "../data/starterJourney";
import { Card, SectionTitle, Subtitle } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { BarChart } from "../components/BarChart";
import { colors } from "../theme";

type StarterRow = StarterQuest & { completed: boolean };

/** The tick box. Said aloud it names the step and whether it is done; a done step stays ticked (there is nothing to undo). */
function StepCheckbox({ completed, label, onPress }: { completed: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={completed} aria-disabled={completed} accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.checkboxHit}>
      <View style={[styles.checkbox, completed && styles.checkboxDone]}>
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  );
}

/**
 * The first steps as a plain checklist, biggest sources first. Calm by design (engine/calm.ts): no points, levels,
 * daily or weekly quests -- a step is done or not yet, and the list can be taken at any pace.
 */
export default function JourneyScreen() {
  const [starter, setStarter] = useState<{ quests: StarterRow[]; done: number; total: number } | null>(null);
  const [history, setHistory] = useState<trends.WeeklyPoint[]>([]);

  const load = useCallback(async () => {
    setStarter(await quests.getStarterJourneyStatus());
    setHistory(await trends.getWeeklyHistory(6));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStarter(id: string, completed: boolean) {
    if (completed) return;
    await quests.completeStarterQuest(id);
    load();
  }

  if (!starter) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const nextStep = starter.quests.find((q) => !q.completed);
  const progress = starter.done / Math.max(1, starter.total);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Journey</Text>

      <Card style={{ borderColor: colors.accent }}>
        <Text style={styles.progressText}>
          {starter.done} of {starter.total} first steps done
        </Text>
        <View style={styles.progressTrack} accessibilityLabel={`${starter.done} of ${starter.total} first steps done`}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>
      </Card>

      <SectionTitle>First steps, biggest sources first</SectionTitle>
      {nextStep && <Subtitle>Next up: {nextStep.title}</Subtitle>}
      <Card>
        {starter.quests.map((q, i) => (
          <View key={q.id} style={i > 0 ? styles.divider : undefined}>
            <View style={styles.questRow}>
              <StepCheckbox completed={q.completed} label={`${q.order}. ${q.title}`} onPress={() => toggleStarter(q.id, q.completed)} />
              <View style={{ flex: 1 }}>
                <Collapsible title={`${q.order}. ${q.title}`} teaser={q.action}>
                  <Text style={styles.questWhy}>{q.why}</Text>
                  <Text style={styles.questAction}>→ {q.action}</Text>
                </Collapsible>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Your Trend</SectionTitle>
      <Card>
        <Collapsible title="Flagged mentions per week" defaultOpen>
          <BarChart label="Flagged mentions per week" data={history.map((h) => ({ label: h.weekLabel, value: h.overallScore }))} barColor={colors.warn} />
          <Text style={styles.note}>Not a dose-adjusted risk score. Down usually means fewer logged matches recently.</Text>
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title="Resilience practices per week" defaultOpen>
          <BarChart label="Resilience practices per week" data={history.map((h) => ({ label: h.weekLabel, value: h.practicesLogged }))} barColor={colors.accent} />
          <Text style={styles.note}>Tracked separately, never netted against the chart above.</Text>
        </Collapsible>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  progressText: { fontSize: 16, fontWeight: "700", color: colors.accent },
  progressTrack: { height: 8, backgroundColor: colors.line, borderRadius: 4, marginTop: 8, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: colors.accent },
  questRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  // a target of 28px around the 22px box (24px is the least a finger or a pointer should be asked to hit)
  checkboxHit: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  questWhy: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  questAction: { fontSize: 13, color: colors.ink, marginTop: 6, fontStyle: "italic" },
  divider: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4, paddingTop: 4 },
  note: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 16 },
});
