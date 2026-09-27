import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import * as quests from "../engine/quests";
import { getJourney } from "../engine/journeyState";
import type { Stage, Step, JourneyTarget } from "../engine/journeyStages";
import type { PlantState } from "../engine/plant";
import PlantView from "../components/PlantView";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { colors, radiusSm, radiusLg, shadow, shadowRaised } from "../theme";

export type { JourneyTarget };

const TILES: { key: JourneyTarget; icon: string; title: string }[] = [
  { key: "scan", icon: "📷", title: "Scan" },
  { key: "log_food", icon: "🥣", title: "Food" },
  { key: "log_practice", icon: "🌙", title: "Sleep" },
  { key: "log_air", icon: "🌬️", title: "Air" },
  { key: "log_biomarker", icon: "🩸", title: "Biomarkers" },
  { key: "shelf", icon: "🗄️", title: "Shelf" },
  { key: "places", icon: "🏠", title: "Places" },
  { key: "profile", icon: "👤", title: "About you" },
];

export default function JourneyHubScreen({ onOpen }: { onOpen: (t: JourneyTarget) => void }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [next, setNext] = useState<Step | null>(null);
  const [plant, setPlant] = useState<PlantState | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const j = await getJourney();
    setStages(j.stages);
    setNext(j.next);
    setPlant(j.plant);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(step: Step) {
    await quests.completeStarterQuest(step.id);
    load();
  }

  const stage = stages.find((s) => s.id === next?.stage);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={styles.h1}>Your Journey</Text>
          <Text style={styles.sub}>{plant ? `${plant.stageLabel} · ${plant.message}` : ""}</Text>
        </View>
        {plant && <PlantView stage={plant.stage} health={plant.health} fruits={plant.fruits} size={84} />}
      </View>

      <View style={styles.pills}>
        {stages.map((s) => (
          <View key={s.id} style={[styles.pill, s.id === next?.stage && styles.pillActive, !s.unlocked && { opacity: 0.5 }]}>
            <Text style={[styles.pillTitle, s.id === next?.stage && { color: "#fff" }]}>{s.unlocked ? "" : "🔒 "}{s.title}</Text>
            <Text style={[styles.pillCount, s.id === next?.stage && { color: "#e6f1ea" }]}>{s.done}/{s.total}</Text>
          </View>
        ))}
      </View>

      {loaded && next ? (
        <View style={styles.focus}>
          <Text style={styles.focusKicker}>YOUR NEXT STEP {stage ? `· ${stage.title.toUpperCase()}` : ""}</Text>
          <Text style={styles.focusTitle}>{next.title}</Text>
          <Text style={styles.focusWhy}>{next.why}</Text>
          <Text style={styles.focusAction}>{next.action}</Text>
          <View style={{ marginTop: 16, gap: 10 }}>
            <PrimaryButton title={next.ctaLabel} onPress={() => onOpen(next.cta)} />
            {next.manual && <SecondaryButton title="I've done this" onPress={() => markDone(next)} />}
          </View>
        </View>
      ) : loaded ? (
        <View style={styles.focus}>
          <Text style={styles.focusKicker}>ALL STEPS COMPLETE</Text>
          <Text style={styles.focusTitle}>You've finished the journey</Text>
          <Text style={styles.focusWhy}>Keep learning to keep your plant fruiting. New steps will appear here.</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => onOpen("roadmap")} style={{ alignSelf: "center", marginTop: 10, paddingVertical: 8 }}>
        <Text style={styles.link}>See the whole roadmap {"›"}</Text>
      </Pressable>

      <Text accessibilityRole="header" aria-level={2} style={styles.section}>Feed your engine</Text>
      <View style={styles.grid}>
        {TILES.map((t) => (
          <Pressable accessibilityRole="button" key={t.key} onPress={() => onOpen(t.key)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileTitle}>{t.title}</Text>
          </Pressable>
        ))}
      </View>

      {/* Not a tile: nothing on that page can be switched on from a fresh install (each source needs a backend of your own or a native build), so it sits here, quietly, for whoever wants it. */}
      <Pressable accessibilityRole="button" onPress={() => onOpen("connections")} style={{ alignSelf: "center", marginTop: 16, paddingVertical: 8 }}>
        <Text style={styles.link}>Connected sources (advanced) {"›"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: "row", alignItems: "center" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 4, paddingRight: 8 },
  pills: { flexDirection: "row", gap: 8, marginTop: 8 },
  pill: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, paddingVertical: 8, paddingHorizontal: 10 },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  pillCount: { fontSize: 12, color: colors.muted, marginTop: 1 },
  focus: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.accent, borderRadius: radiusLg, padding: 20, marginTop: 16, ...shadowRaised },
  focusKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  focusTitle: { fontSize: 24, fontWeight: "700", color: colors.ink, marginTop: 8, lineHeight: 30 },
  focusWhy: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 8 },
  focusAction: { fontSize: 15, color: colors.ink, lineHeight: 22, marginTop: 12, fontWeight: "600" },
  link: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  section: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "23%", flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, paddingVertical: 14, alignItems: "center", ...shadow },
  tileIcon: { fontSize: 24 },
  tileTitle: { fontSize: 12, fontWeight: "600", color: colors.ink, marginTop: 4 },
});
