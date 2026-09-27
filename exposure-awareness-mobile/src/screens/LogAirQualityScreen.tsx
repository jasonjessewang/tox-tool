import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import * as db from "../storage/db";
import * as aqiEngine from "../engine/aqi";
import * as notify from "../notifications/notify";
import type { AirQualityLog } from "../engine/types";
import { Card, FormError, PrimaryButton, SectionTitle, Subtitle, SecondaryButton } from "../components/ui";
import { colors, radiusSm } from "../theme";
import { todayISO } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { UndoBar, useUndo } from "../components/UndoBar";

const POLLUTANTS: AirQualityLog["pollutant"][] = ["PM2.5", "PM10"];

export default function LogAirQualityScreen() {
  const [location, setLocation] = useState("");
  const [pollutant, setPollutant] = useState<AirQualityLog["pollutant"]>("PM2.5");
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<AirQualityLog[]>([]);
  const [lastClassification, setLastClassification] = useState<ReturnType<typeof aqiEngine.classify>>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undo = useUndo();

  async function refresh() {
    const r = await db.getRecentLogs(10);
    setRecent(r.air_quality);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    const numeric = parseFloat(value.replace(",", "."));
    if (!location.trim() || isNaN(numeric)) {
      setError(!location.trim() && isNaN(numeric) ? "Add where the reading is from and the number, like Home and 12.4." : !location.trim() ? "Add where the reading is from, like Home or Downtown office." : "Enter the reading as a number, like 12.4.");
      return;
    }
    setError(null);

    const { receipt: r } = await runActivity("air_quality_log", () =>
      db.insertAirQualityLog({
        log_date: todayISO(),
        location: location.trim(),
        pollutant,
        value: numeric,
        source: "manual",
        notes: "",
      })
    );
    setReceipt(r);

    const classification = aqiEngine.classify(pollutant, numeric);
    setLastClassification(classification);

    // Event-driven notification: only Moderate+ fires, matching the daily-cycle design
    // -- a "Good" reading is not signal, same rule engine/scoring.ts uses for scoring.
    if (classification && classification.concern_level >= 2) {
      notify.fireLocal(
        `${classification.category} air quality`,
        `${numeric} µg/m³ ${pollutant} in ${location.trim()}. ${classification.guidance}`
      );
    }

    setValue("");
    refresh();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Log Air Quality</Text>
      <Subtitle>
        A reading from AirNow, a personal monitor, or a workplace display. Classified automatically against the
        EPA's 2024 AQI breakpoints. A Moderate-or-worse reading fires a real notification (if enabled) --
        "Good" days stay quiet, same rule the dashboard score already uses.
      </Subtitle>

      {lastClassification && (
        <Card style={{ borderColor: lastClassification.color }}>
          <Text style={{ color: lastClassification.color, fontWeight: "700" }}>
            Last reading: {lastClassification.category} (AQI ~{lastClassification.aqi_estimate})
          </Text>
          <Text style={styles.body}>{lastClassification.guidance}</Text>
        </Card>
      )}

      {receipt && <ReceiptCard receipt={receipt} />}

      <Card>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} accessibilityLabel="Location" placeholder="e.g. Home, Downtown office" />

        <Text style={styles.label}>Pollutant</Text>
        <View style={styles.rowWrap}>
          {POLLUTANTS.map((p) => (
            <Pressable
              accessibilityRole="radio"
              key={p}
              onPress={() => setPollutant(p)}
              aria-checked={!!(pollutant === p)} style={[styles.chip, pollutant === p && styles.chipActive]}
            >
              <Text style={[styles.chipText, pollutant === p && styles.chipTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Reading (µg/m³)</Text>
        <TextInput style={styles.input} value={value} onChangeText={setValue} accessibilityLabel="Reading in micrograms per cubic meter" placeholder="e.g. 12.4" keyboardType="decimal-pad" />

        <FormError message={error} />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="Log reading" onPress={submit} />
        </View>
      </Card>

      <SectionTitle>Recent air quality entries</SectionTitle>
      <UndoBar undo={undo} />
      <Card>
        {recent.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: "italic" }}>No air quality entries yet.</Text>
        ) : (
          recent.map((e) => (
            <View key={e.id} style={styles.recentRow}>
              <Text style={styles.recentDate}>{e.log_date}</Text>
              <Text style={styles.recentText}>
                {e.location}: {e.value} µg/m³ {e.pollutant}
              </Text>
              <SecondaryButton
                title="Delete"
                label={`Delete ${e.location} ${e.value} ${e.pollutant} reading, ${e.log_date}`}
                onPress={async () => {
                  const removed = await db.deleteLog<AirQualityLog>("air_quality", e.id);
                  if (removed) undo.offer(`${removed.location} ${removed.value} ${removed.pollutant}`, async () => { await db.restoreLog("air_quality", removed); refresh(); });
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
  body: { fontSize: 13, color: colors.ink, marginTop: 6 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 15, backgroundColor: "#fff" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: "#fff" },
  recentRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 },
  recentDate: { fontSize: 12, color: colors.muted },
  recentText: { fontSize: 14, color: colors.ink, marginVertical: 4 },
});
