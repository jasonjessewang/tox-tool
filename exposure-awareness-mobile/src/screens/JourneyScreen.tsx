import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import * as quests from "../engine/quests";
import * as trends from "../engine/trends";
import type { StarterQuest } from "../data/starterJourney";
import type { DailyQuest, WeeklyQuest, LevelStatus } from "../engine/quests";
import { Card, SectionTitle, Subtitle } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { BarChart } from "../components/BarChart";
import { colors } from "../theme";

type StarterRow = StarterQuest & { completed: boolean };
type DailyRow = DailyQuest & { completed: boolean };
type WeeklyRow = WeeklyQuest & { completed: boolean };

/** The tick box. Said aloud it names the quest and whether it is done; a done quest stays ticked (there is nothing to undo). */
function QuestCheckbox({ completed, label, onPress }: { completed: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={completed} aria-disabled={completed} accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.checkboxHit}>
      <View style={[styles.checkbox, completed && styles.checkboxDone]}>
        {completed && <Text style={styles.checkmark}>✓</Text>}
      </View>
    </Pressable>
  );
}

/** A quest whose whole row is the tick box: one control, named by the quest, rather than a button holding a button. */
function QuestRowToggle({ completed, title, xp, first, onPress }: { completed: boolean; title: string; xp: number; first: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={completed} aria-disabled={completed} accessibilityLabel={`${title}, ${xp} XP`} onPress={onPress} style={first ? undefined : styles.divider}>
      <View style={styles.questRow}>
        <View style={[styles.checkbox, completed && styles.checkboxDone]} aria-hidden>
          {completed && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.questTitleFlat}>{title}</Text>
        <Text style={styles.xpBadge}>+{xp}</Text>
      </View>
    </Pressable>
  );
}

export default function JourneyScreen() {
  const [level, setLevel] = useState<LevelStatus | null>(null);
  const [starter, setStarter] = useState<{ quests: StarterRow[]; xpEarned: number; totalXp: number } | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [weekly, setWeekly] = useState<WeeklyRow[]>([]);
  const [history, setHistory] = useState<trends.WeeklyPoint[]>([]);

  const load = useCallback(async () => {
    setLevel(await quests.getLevelStatus());
    setStarter(await quests.getStarterJourneyStatus());
    setDaily((await quests.getDailyQuestStatus()).quests);
    setWeekly((await quests.getWeeklyQuestStatus()).quests);
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
  async function toggleDaily(id: string, completed: boolean) {
    if (completed) return;
    await quests.completeDailyQuest(id);
    load();
  }
  async function toggleWeekly(id: string, completed: boolean) {
    if (completed) return;
    await quests.completeWeeklyQuest(id);
    load();
  }

  if (!level || !starter) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const nextStarterQuest = starter.quests.find((q) => !q.completed);
  const levelProgress = level.xpIntoLevel / level.xpForNextLevel;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Journey</Text>

      <Card style={{ borderColor: colors.accent }}>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>Level {level.level}</Text>
          <Text style={styles.xpText}>
            {level.xpIntoLevel} / {level.xpForNextLevel} XP
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, levelProgress * 100)}%` }]} />
        </View>
      </Card>

      <SectionTitle>
        Starter Journey ({starter.xpEarned}/{starter.totalXp} XP)
      </SectionTitle>
      {nextStarterQuest && <Subtitle>Next up: {nextStarterQuest.title}</Subtitle>}
      <Card>
        {starter.quests.map((q, i) => (
          <View key={q.id} style={i > 0 ? styles.divider : undefined}>
            <View style={styles.questRow}>
              <QuestCheckbox completed={q.completed} label={`${q.order}. ${q.title}, ${q.xp} XP`} onPress={() => toggleStarter(q.id, q.completed)} />
              <View style={{ flex: 1 }}>
                <Collapsible
                  title={`${q.order}. ${q.title}`}
                  teaser={q.action}
                >
                  <Text style={styles.questWhy}>{q.why}</Text>
                  <Text style={styles.questAction}>→ {q.action}</Text>
                </Collapsible>
              </View>
              <Text style={styles.xpBadge}>+{q.xp}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionTitle>Daily Quests</SectionTitle>
      <Card>
        {daily.map((q, i) => (
          <QuestRowToggle key={q.id} completed={q.completed} title={q.title} xp={q.xp} first={i === 0} onPress={() => toggleDaily(q.id, q.completed)} />
        ))}
      </Card>

      <SectionTitle>Weekly Quests</SectionTitle>
      <Card>
        {weekly.map((q, i) => (
          <QuestRowToggle key={q.id} completed={q.completed} title={q.title} xp={q.xp} first={i === 0} onPress={() => toggleWeekly(q.id, q.completed)} />
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
  levelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  levelText: { fontSize: 18, fontWeight: "700", color: colors.accent },
  xpText: { fontSize: 12, color: colors.muted },
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
  questTitleFlat: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.ink },
  xpBadge: { fontSize: 12, color: colors.accent, fontWeight: "700" },
  questWhy: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 17 },
  questAction: { fontSize: 13, color: colors.ink, marginTop: 6, fontStyle: "italic" },
  divider: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4, paddingTop: 4 },
  note: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 16 },
});
