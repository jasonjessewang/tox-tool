import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import type { BiomarkerLog } from "../engine/types";
import { Card, FormError, PrimaryButton, SectionTitle, Subtitle, SecondaryButton } from "../components/ui";
import { colors, radiusSm } from "../theme";
import { todayISO } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { UndoBar, useUndo } from "../components/UndoBar";
import { TrendStrip } from "../components/TrendStrip";
import { trendsFrom, type MetricTrend } from "../engine/readings";

interface BiomarkerPreset {
  metric: string;
  unit: string;
  conceptNote?: string;
}

// Ranked roughly by how much a single reading can reorient someone's personal picture --
// direct exposure markers and organ-clearance markers first, general fitness/wellness after.
/** A typical result for each metric, so the example in the message is something the person would recognise. */
const BIOMARKER_EXAMPLES: Record<string, string> = {
  "Blood lead level": "1.4",
  "Creatinine / eGFR": "90",
  "ALT (liver enzyme)": "24",
  "Blood pressure (systolic)": "118",
  "Blood pressure (diastolic)": "76",
  "Waist circumference": "84",
  "Fasting glucose": "92",
  HbA1c: "5.3",
  "hs-CRP (inflammation)": "1.2",
  "Vitamin D": "32",
  "Resting heart rate": "62",
  HRV: "48",
  "Sleep score": "82",
  "Body fat %": "24",
  "Grip strength": "34",
  "30s sit-to-stand": "14",
  VO2max: "38",
};

const BIOMARKER_PRESETS: BiomarkerPreset[] = [
  { metric: "Blood lead level", unit: "µg/dL", conceptNote: "Directly tracks lead exposure -- the single most specific biomarker this app can log." },
  { metric: "Creatinine / eGFR", unit: "mL/min/1.73m²", conceptNote: "Kidney (renal) clearance -- how efficiently the body filters and excretes many flagged substances." },
  { metric: "ALT (liver enzyme)", unit: "U/L", conceptNote: "Hepatic metabolism -- the liver's processing load, relevant to most chemical exposures." },
  { metric: "Blood pressure (systolic)", unit: "mmHg" },
  { metric: "Blood pressure (diastolic)", unit: "mmHg" },
  { metric: "Waist circumference", unit: "cm" },
  { metric: "Fasting glucose", unit: "mg/dL" },
  { metric: "HbA1c", unit: "%" },
  { metric: "hs-CRP (inflammation)", unit: "mg/L" },
  { metric: "Vitamin D", unit: "ng/mL" },
  { metric: "Resting heart rate", unit: "bpm" },
  { metric: "HRV", unit: "ms" },
  { metric: "Sleep score", unit: "score" },
  { metric: "Body fat %", unit: "%" },
  { metric: "Grip strength", unit: "kg" },
  { metric: "30s sit-to-stand", unit: "reps" },
  { metric: "VO2max", unit: "mL/kg/min" },
  { metric: "Other", unit: "" },
];

export default function LogBiomarkerScreen() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [metric, setMetric] = useState(BIOMARKER_PRESETS[0].metric);
  const [unit, setUnit] = useState(BIOMARKER_PRESETS[0].unit);
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [recent, setRecent] = useState<BiomarkerLog[]>([]);
  const [trends, setTrends] = useState<MetricTrend[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undo = useUndo();

  async function refresh() {
    setRecent(await db.getBiomarkerLogs(10));
    setTrends(trendsFrom(await db.getBiomarkerLogs(2000), todayISO()));
  }

  useEffect(() => {
    refresh();
  }, []);

  function selectPreset(i: number) {
    setPresetIndex(i);
    setMetric(BIOMARKER_PRESETS[i].metric);
    setUnit(BIOMARKER_PRESETS[i].unit);
  }

  async function submit() {
    if (!value.trim() || isNaN(Number(value.replace(",", ".")))) {
      setError(`Enter the number from your result -- for ${metric.toLowerCase()}, something like ${BIOMARKER_EXAMPLES[metric] ?? "1.4"}.`);
      return;
    }
    setError(null);
    const { receipt: r } = await runActivity("biomarker_log", () =>
      db.insertBiomarkerLog({
        log_date: todayISO(),
        metric,
        value: Number(value.replace(",", ".")),
        unit,
        source: source.trim(),
        notes: "",
      })
    );
    setReceipt(r);
    setValue("");
    refresh();
  }

  const activeNote = BIOMARKER_PRESETS[presetIndex].conceptNote;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Log a Biomarker</Text>
      <Subtitle>
        Lab results, wearable readings, or field tests -- these validate your exposure picture against your own
        body, not just what you've logged eating or using.
      </Subtitle>

      {receipt && <ReceiptCard receipt={receipt} />}

      <Card>
        <Text style={styles.label}>Metric</Text>
        <View style={styles.rowWrap}>
          {BIOMARKER_PRESETS.map((p, i) => (
            <Pressable
              accessibilityRole="radio"
              key={p.metric}
              onPress={() => selectPreset(i)}
              aria-checked={!!(presetIndex === i)} style={[styles.chip, presetIndex === i && styles.chipActive]}
            >
              <Text style={[styles.chipText, presetIndex === i && styles.chipTextActive]}>{p.metric}</Text>
            </Pressable>
          ))}
        </View>

        {activeNote && (
          <View style={styles.noteBox}>
            <Text style={styles.note}>{activeNote}</Text>
          </View>
        )}

        {metric === "Other" && (
          <>
            <Text style={styles.label}>Custom metric name</Text>
            <TextInput style={styles.input} value={metric} onChangeText={setMetric} accessibilityLabel="Custom metric name" placeholder="e.g. Cortisol (AM)" />
          </>
        )}

        <Text style={styles.label}>Value</Text>
        <TextInput style={styles.input} value={value} onChangeText={setValue} accessibilityLabel={`Value for ${metric}`} placeholder={BIOMARKER_EXAMPLES[metric] ? `e.g. ${BIOMARKER_EXAMPLES[metric]}` : "e.g. 72"} keyboardType="decimal-pad" />

        <Text style={styles.label}>Unit</Text>
        <TextInput style={styles.input} value={unit} onChangeText={setUnit} accessibilityLabel="Unit" placeholder="e.g. mg/dL" />

        <Text style={styles.label}>Source (optional)</Text>
        <TextInput style={styles.input} value={source} onChangeText={setSource} accessibilityLabel="Source" placeholder="e.g. quarterly lab panel, wearable" />

        <FormError message={error} />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="Log it" onPress={submit} />
        </View>
      </Card>

      {trends.length > 0 && (
        <>
          <SectionTitle>Your readings</SectionTitle>
          {trends.map((t) => (
            <Card key={t.metric.toLowerCase()}>
              <Text accessibilityRole="header" aria-level={3} style={styles.trendName}>{t.metric}</Text>
              <Text style={styles.trendValue}>
                {t.latest.value}
                {t.unit ? <Text style={styles.trendUnit}> {t.unit}</Text> : null}
              </Text>
              <Text style={styles.recentDate}>{t.daysSince === 0 ? "today" : `${t.daysSince} day${t.daysSince === 1 ? "" : "s"} ago`} · {t.count} reading{t.count === 1 ? "" : "s"}</Text>
              <Text style={styles.trendSentence}>{t.sentence}</Text>
              <TrendStrip points={t.points} unit={t.unit} label={t.metric} />
            </Card>
          ))}
          <Text style={styles.trendNote}>
            The app does not say whether a number is in range -- that depends on the test and on you, and your lab report or clinician has the range that fits. What it shows is which way your own numbers are moving.
          </Text>
        </>
      )}

      <SectionTitle>Recent</SectionTitle>
      <UndoBar undo={undo} />
      <Card>
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>Nothing logged yet.</Text>
        ) : (
          recent.map((e) => (
            <View key={e.id} style={styles.recentRow}>
              <Text style={styles.recentDate}>{e.log_date}</Text>
              <Text style={styles.recentText}>
                {e.metric}: {e.value}
                {e.unit ? ` ${e.unit}` : ""}
                {e.source ? ` — ${e.source}` : ""}
              </Text>
              <SecondaryButton
                title="Delete"
                label={`Delete ${e.metric} ${e.value}${e.unit ? ` ${e.unit}` : ""}, ${e.log_date}`}
                onPress={async () => {
                  const removed = await db.deleteLog<BiomarkerLog>("biomarkers", e.id);
                  if (removed) undo.offer(`${removed.metric} ${removed.value}${removed.unit ? ` ${removed.unit}` : ""}`, async () => { await db.restoreLog("biomarkers", removed); refresh(); });
                  refresh();
                }}
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 15, backgroundColor: "#fff" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: "#fff" },
  noteBox: { marginTop: 10, padding: 10, borderRadius: radiusSm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.line },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  emptyText: { color: colors.muted, fontStyle: "italic", fontSize: 13 },
  trendName: { fontSize: 15, fontWeight: "700", color: colors.ink },
  trendValue: { fontSize: 28, fontWeight: "300", color: colors.ink, marginTop: 2 },
  trendUnit: { fontSize: 14, color: colors.muted },
  trendSentence: { fontSize: 13, color: colors.ink, lineHeight: 19, marginTop: 6 },
  trendNote: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 6 },
  recentRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 },
  recentDate: { fontSize: 12, color: colors.muted },
  recentText: { fontSize: 14, color: colors.ink, marginVertical: 4 },
});
