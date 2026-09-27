import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import ScoreGauge from "../components/ScoreGauge";
import { BarChart } from "../components/BarChart";
import { Collapsible } from "../components/Collapsible";
import { ComparisonRow } from "../components/ComparisonRow";
import { getWellnessScore, getScoreWeights, saveScoreWeights, getScoreHistory, type ScorePoint } from "../engine/wellnessState";
import { describeScore, showsNumber, DEFAULT_WEIGHTS, type WeightKey, type WellnessScore } from "../engine/wellnessScore";
import { SecondaryButton } from "../components/ui";
import { colors, radius, radiusSm, shadow } from "../theme";

const KEYS = Object.keys(DEFAULT_WEIGHTS) as WeightKey[];
export const BAND_COLOR: Record<WellnessScore["band"], string> = { building: colors.warn, steady: colors.warn, strong: colors.accent, excellent: colors.accent };
const STEP = 5;

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const shortDay = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export default function ScoreScreen() {
  const [score, setScore] = useState<WellnessScore | null>(null);
  const [history, setHistory] = useState<ScorePoint[]>([]);
  const [weights, setWeights] = useState<Record<WeightKey, number> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const read = useCallback(async (w: Record<WeightKey, number>) => {
    const [s, h] = await Promise.all([getWellnessScore(w), getScoreHistory(8, w)]);
    setScore(s);
    setHistory(h);
  }, []);

  const load = useCallback(async () => {
    const w = await getScoreWeights();
    setWeights(w);
    await read(w);
  }, [read]);

  useEffect(() => {
    load();
  }, [load]);

  async function preview(next: Record<WeightKey, number>) {
    setWeights(next);
    setSaved(false);
    await read(next);
  }

  function bump(key: WeightKey, delta: number) {
    if (!weights) return;
    preview({ ...weights, [key]: Math.max(0, Math.round((weights[key] + delta) * 10) / 10) });
  }

  async function save() {
    if (!weights) return;
    await saveScoreWeights(weights);
    setSaved(true);
  }

  async function reset() {
    await saveScoreWeights(DEFAULT_WEIGHTS);
    setEditing(false);
    load();
  }

  if (!score || !weights) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Loading...</Text>
      </View>
    );
  }

  const color = BAND_COLOR[score.band];
  const shown = describeScore(score);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <Text accessibilityRole="header" style={styles.h1}>Your score</Text>
      <Text style={styles.sub}>
        Every part is a comparison: something you did, measured against a guideline, the app's own rules, or your earlier self. A personal dashboard reading, not a diagnosis.
      </Text>

      <View style={styles.gaugeWrap}>
        <ScoreGauge score={showsNumber(score) ? score.overall : null} color={color} size={220} dim={score.provisional} caption={score.provisional ? (showsNumber(score) ? "early reading" : "not yet") : "/ 100"} />
      </View>
      <Text style={[styles.bandLabel, { color }]}>{shown.label}</Text>
      <Text style={styles.bandDesc}>{shown.description}</Text>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.compLabel}>How much of the picture is visible</Text>
          <Text style={styles.compValue}>
            {score.coverage}
            <Text style={styles.of100}>%</Text>
          </Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${score.coverage}%`, backgroundColor: colors.accent }]} />
        </View>
        <Text style={styles.detail}>
          The score is an average of the parts we can see, each counting in proportion to its weight and to how much evidence stands behind it. Logging fills the picture in, and logging more never counts against you. The Places part reads what you find (and fix) against published guidance, so it can move either way.
        </Text>
        {score.vsBefore ? (
          <Text style={styles.vs}>
            {signed(score.vsBefore.change)} against yourself {score.vsBefore.window} ago
          </Text>
        ) : (
          <Text style={styles.detail}>Once you have a few weeks of history, this compares you with your own earlier self.</Text>
        )}
      </View>

      <Text accessibilityRole="header" aria-level={2} style={styles.section}>How it has moved</Text>
      <View style={styles.card}>
        <BarChart label="Wellness score at the end of each of the last eight weeks (empty weeks had too little to read)" data={history.map((h) => ({ label: shortDay(h.asOf), value: h.provisional ? 0 : h.overall }))} barColor={color} maxHeight={90} />
        <Text style={styles.detail}>The score at the end of each of the last eight weeks, read from the same records. Empty bars are weeks before there was enough to read.</Text>
      </View>

      <View style={styles.headerRow}>
        <Text accessibilityRole="header" aria-level={2} style={styles.section}>Breakdown</Text>
        <Pressable accessibilityRole="button" onPress={() => setEditing(!editing)} style={{ paddingVertical: 8 }}>
          <Text style={styles.editLink}>{editing ? "Done" : "Adjust weights"}</Text>
        </Pressable>
      </View>

      {score.components.map((c) => (
        <View key={c.key} style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.compLabel}>{c.label}</Text>
            <Text style={styles.compValue}>
              {c.confidence > 0 ? Math.round(c.value) : "--"}
              <Text style={styles.of100}>{c.confidence > 0 ? "/100" : ""}</Text>
            </Text>
          </View>
          <Text style={styles.blurb}>{c.blurb}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${c.confidence > 0 ? c.value : 0}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.detail}>{c.detail}</Text>
          {c.valueMeans && c.confidence > 0 ? <Text style={styles.detail}>This number is {c.valueMeans}.</Text> : null}
          {c.vsBefore && c.vsBefore.change !== 0 ? <Text style={styles.vs}>{signed(c.vsBefore.change)} against yourself {c.vsBefore.window} ago</Text> : null}

          {c.parts.map((p) => (
            <ComparisonRow key={p.label} part={p} />
          ))}

          {c.notes.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Collapsible title="More detail" teaser={c.notes[0]}>
                {c.notes.map((n, i) => (
                  <Text key={i} style={styles.note}>
                    {n}
                  </Text>
                ))}
                <Text style={styles.note}>What feeds this part: {c.sources.map((s) => s.replace(/_/g, " ")).join(", ")}.</Text>
              </Collapsible>
            </View>
          )}

          {editing ? (
            <View style={styles.weightRow}>
              <Text style={styles.weightLabel}>Weight in your score: {Math.round(c.weight)}%</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable accessibilityRole="button" onPress={() => bump(c.key, -STEP)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>{"−"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => bump(c.key, STEP)} style={styles.stepBtn}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.weightStatic}>
              {Math.round(c.weight)}% weight · counts for {Math.round(c.influence)}% of your score right now ({Math.round(c.confidence * 100)}% of it visible)
            </Text>
          )}
        </View>
      ))}

      {editing && (
        <View style={{ marginTop: 8, marginBottom: 30, gap: 10 }}>
          <Text style={styles.note}>Weights are rebalanced automatically so they always total 100% -- push one up and the others make room.</Text>
          <SecondaryButton title={saved ? "Saved ✓" : "Save these weights"} onPress={save} />
          <SecondaryButton title="Reset to default" onPress={reset} />
        </View>
      )}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 24, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  gaugeWrap: { alignItems: "center", marginTop: 18 },
  bandLabel: { fontSize: 20, fontWeight: "700", textAlign: "center", marginTop: 8 },
  bandDesc: { fontSize: 13, color: colors.muted, textAlign: "center", marginTop: 4, marginBottom: 14, paddingHorizontal: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 10 },
  section: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 18, marginBottom: 10 },
  editLink: { fontSize: 14, fontWeight: "600", color: colors.accent },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 10, ...shadow },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  compLabel: { fontSize: 15, fontWeight: "700", color: colors.ink },
  compValue: { fontSize: 16, fontWeight: "700", color: colors.ink },
  of100: { fontSize: 12, color: colors.muted, fontWeight: "400" },
  blurb: { fontSize: 12, color: colors.muted, marginTop: 2 },
  track: { height: 7, borderRadius: radiusSm, backgroundColor: "#eee9dd", marginTop: 10, overflow: "hidden" },
  fill: { height: 7, borderRadius: radiusSm },
  detail: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 17 },
  vs: { fontSize: 12, fontWeight: "600", color: colors.accent, marginTop: 6 },
  weightRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  weightLabel: { fontSize: 12, fontWeight: "600", color: colors.ink },
  weightStatic: { fontSize: 12, color: colors.muted, marginTop: 10, fontStyle: "italic" },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepText: { fontSize: 18, fontWeight: "700", color: colors.ink },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18, fontStyle: "italic", marginBottom: 4 },
});
