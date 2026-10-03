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
import { msg, tr, trn } from "../i18n";

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
  { metric: msg("Blood lead level"), unit: "µg/dL", conceptNote: msg("Directly tracks lead exposure -- the single most specific biomarker this app can log.") },
  { metric: msg("Creatinine / eGFR"), unit: "mL/min/1.73m²", conceptNote: msg("Kidney (renal) clearance -- how efficiently the body filters and excretes many flagged substances.") },
  { metric: msg("ALT (liver enzyme)"), unit: "U/L", conceptNote: msg("Hepatic metabolism -- the liver's processing load, relevant to most chemical exposures.") },
  { metric: msg("Blood pressure (systolic)"), unit: "mmHg" },
  { metric: msg("Blood pressure (diastolic)"), unit: "mmHg" },
  { metric: msg("Waist circumference"), unit: "cm" },
  { metric: msg("Fasting glucose"), unit: "mg/dL" },
  { metric: msg("HbA1c"), unit: "%" },
  { metric: msg("hs-CRP (inflammation)"), unit: "mg/L" },
  { metric: msg("Vitamin D"), unit: "ng/mL" },
  { metric: msg("Resting heart rate"), unit: "bpm" },
  { metric: "HRV", unit: "ms" },
  { metric: msg("Sleep score"), unit: msg("score") },
  { metric: msg("Body fat %"), unit: "%" },
  { metric: msg("Grip strength"), unit: "kg" },
  { metric: msg("30s sit-to-stand"), unit: msg("reps") },
  { metric: "VO2max", unit: "mL/kg/min" },
  { metric: msg("Other"), unit: "" },
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
      setError(tr("Enter the number from your result -- for {metric}, something like {example}.", { metric: tr(metric).toLowerCase(), example: BIOMARKER_EXAMPLES[metric] ?? "1.4" }));
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
      <Text accessibilityRole="header" style={styles.h1}>{tr("Log a Biomarker")}</Text>
      <Subtitle>
        {tr("Lab results, wearable readings, or field tests -- these validate your exposure picture against your own body, not just what you've logged eating or using.")}
      </Subtitle>

      {receipt && <ReceiptCard receipt={receipt} />}

      <Card>
        <Text style={styles.label}>{tr("Metric")}</Text>
        <View style={styles.rowWrap}>
          {BIOMARKER_PRESETS.map((p, i) => (
            <Pressable
              accessibilityRole="radio"
              key={p.metric}
              onPress={() => selectPreset(i)}
              aria-checked={!!(presetIndex === i)} style={[styles.chip, presetIndex === i && styles.chipActive]}
            >
              <Text style={[styles.chipText, presetIndex === i && styles.chipTextActive]}>{tr(p.metric)}</Text>
            </Pressable>
          ))}
        </View>

        {activeNote && (
          <View style={styles.noteBox}>
            <Text style={styles.note}>{tr(activeNote)}</Text>
          </View>
        )}

        {metric === "Other" && (
          <>
            <Text style={styles.label}>{tr("Custom metric name")}</Text>
            <TextInput style={styles.input} value={metric} onChangeText={setMetric} accessibilityLabel={tr("Custom metric name")} placeholder={tr("e.g. Cortisol (AM)")} />
          </>
        )}

        <Text style={styles.label}>{tr("Value")}</Text>
        <TextInput style={styles.input} value={value} onChangeText={setValue} accessibilityLabel={tr("Value for {metric}", { metric: tr(metric) })} placeholder={BIOMARKER_EXAMPLES[metric] ? tr("e.g. {example}", { example: BIOMARKER_EXAMPLES[metric] }) : tr("e.g. 72")} keyboardType="decimal-pad" />

        <Text style={styles.label}>{tr("Unit")}</Text>
        <TextInput style={styles.input} value={unit} onChangeText={setUnit} accessibilityLabel={tr("Unit")} placeholder={tr("e.g. mg/dL")} />

        <Text style={styles.label}>{tr("Source (optional)")}</Text>
        <TextInput style={styles.input} value={source} onChangeText={setSource} accessibilityLabel={tr("Source")} placeholder={tr("e.g. quarterly lab panel, wearable")} />

        <FormError message={error} />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title={tr("Log it")} onPress={submit} />
        </View>
      </Card>

      {trends.length > 0 && (
        <>
          <SectionTitle>{tr("Your readings")}</SectionTitle>
          {trends.map((t) => (
            <Card key={t.metric.toLowerCase()}>
              <Text accessibilityRole="header" aria-level={3} style={styles.trendName}>{tr(t.metric)}</Text>
              <Text style={styles.trendValue}>
                {t.latest.value}
                {t.unit ? <Text style={styles.trendUnit}> {tr(t.unit)}</Text> : null}
              </Text>
              <Text style={styles.recentDate}>{t.daysSince === 0 ? tr("today") : trn(t.daysSince, "{n} day ago", "{n} days ago")} · {trn(t.count, "{n} reading", "{n} readings")}</Text>
              <Text style={styles.trendSentence}>{t.sentence}</Text>
              <TrendStrip points={t.points} unit={tr(t.unit)} label={tr(t.metric)} />
            </Card>
          ))}
          <Text style={styles.trendNote}>
            {tr("The app does not say whether a number is in range -- that depends on the test and on you, and your lab report or clinician has the range that fits. What it shows is which way your own numbers are moving.")}
          </Text>
        </>
      )}

      <SectionTitle>{tr("Recent")}</SectionTitle>
      <UndoBar undo={undo} />
      <Card>
        {recent.length === 0 ? (
          <Text style={styles.emptyText}>{tr("Nothing logged yet.")}</Text>
        ) : (
          recent.map((e) => (
            <View key={e.id} style={styles.recentRow}>
              <Text style={styles.recentDate}>{e.log_date}</Text>
              <Text style={styles.recentText}>
                {tr(e.metric)}: {e.value}
                {e.unit ? ` ${tr(e.unit)}` : ""}
                {e.source ? ` — ${e.source}` : ""}
              </Text>
              <SecondaryButton
                title={tr("Delete")}
                label={tr("Delete {metric} {value}{v}, {log_date}", { metric: tr(e.metric), value: e.value, v: e.unit ? ` ${tr(e.unit)}` : "", log_date: e.log_date })}
                onPress={async () => {
                  const removed = await db.deleteLog<BiomarkerLog>("biomarkers", e.id);
                  if (removed) undo.offer(`${tr(removed.metric)} ${removed.value}${removed.unit ? ` ${tr(removed.unit)}` : ""}`, async () => { await db.restoreLog("biomarkers", removed); refresh(); });
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
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 15, backgroundColor: colors.surface },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: colors.onAccent },
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
