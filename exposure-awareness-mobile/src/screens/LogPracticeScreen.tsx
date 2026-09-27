import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { PRACTICE_LABELS } from "../engine/scoring";
import type { PracticeLog, PracticeType } from "../engine/types";
import { Card, FormError, PrimaryButton, SectionTitle, Subtitle, SecondaryButton } from "../components/ui";
import { parseDuration } from "../util/duration";
import { colors, radiusSm } from "../theme";
import { todayISO } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { UndoBar, useUndo } from "../components/UndoBar";

// "Adding good" comes first, visually and in ordering -- sleep and hydration are just as
// legitimate a practice as exercise, not an afterthought bolted onto a fitness list.
const PRACTICE_TYPES: PracticeType[] = ["sleep", "hydration", "exercise", "grounding_stretching", "fasting", "screen_free", "other"];

export default function LogPracticeScreen() {
  const [practiceType, setPracticeType] = useState<PracticeType>("sleep");
  const [duration, setDuration] = useState("");
  const [detail, setDetail] = useState("");
  const [recent, setRecent] = useState<PracticeLog[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undo = useUndo();

  async function refresh() {
    const r = await db.getRecentLogs(10);
    setRecent(r.practices);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    // Sleep is thought of in hours ("7.5"); anything else in minutes. "7h30", "7:30" and "90 min" mean what they say.
    const parsed = duration.trim() ? parseDuration(duration, practiceType === "sleep" ? "hours-if-small" : "minutes") : null;
    if (duration.trim() && !parsed) {
      setError(practiceType === "sleep" ? "Try hours like 7.5 or 7h30, or minutes like 450 -- or leave it empty." : "Try minutes like 30, or 1h15 -- or leave it empty.");
      return;
    }
    setError(null);
    const { receipt: r } = await runActivity("practice_log", () =>
      db.insertPracticeLog({
        log_date: todayISO(),
        practice_type: practiceType,
        duration_minutes: parsed ? parsed.minutes : null,
        detail: detail.trim(),
        notes: "",
      })
    );
    setReceipt(r);
    setDuration("");
    setDetail("");
    refresh();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Log a Reset</Text>
      <Subtitle>
        "Adding good" -- sleep, hydration, movement, screen-free time. Tracked separately from your exposure
        score, never netted against it.
      </Subtitle>

      {receipt && <ReceiptCard receipt={receipt} />}

      <Card>
        <Text style={styles.label}>What did you do?</Text>
        <View style={styles.rowWrap}>
          {PRACTICE_TYPES.map((pt) => (
            <Pressable
              accessibilityRole="radio"
              key={pt}
              onPress={() => setPracticeType(pt)}
              aria-checked={!!(practiceType === pt)} style={[styles.chip, practiceType === pt && styles.chipActive]}
            >
              <Text style={[styles.chipText, practiceType === pt && styles.chipTextActive]}>{PRACTICE_LABELS[pt]}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{practiceType === "sleep" ? "How long (optional) -- hours or minutes" : "Duration in minutes (optional)"}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={practiceType === "sleep" ? "How long you slept" : "Duration in minutes"}
          value={duration}
          onChangeText={setDuration}
          placeholder={practiceType === "sleep" ? "e.g. 7.5 or 7h30" : "e.g. 30"}
          keyboardType={practiceType === "sleep" ? "default" : "number-pad"}
        />

        <Text style={styles.label}>Detail (optional)</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel="Detail"
          value={detail}
          onChangeText={setDetail}
          placeholder="e.g. 16:8 window, evening walk, phone-free dinner"
        />

        <FormError message={error} />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title="Log it" onPress={submit} />
        </View>
      </Card>

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
                {PRACTICE_LABELS[e.practice_type] ?? e.practice_type}
                {e.duration_minutes ? ` — ${e.duration_minutes} min` : ""}
                {e.detail ? ` (${e.detail})` : ""}
              </Text>
              <SecondaryButton
                title="Delete"
                label={`Delete ${PRACTICE_LABELS[e.practice_type] ?? e.practice_type}, ${e.log_date}`}
                onPress={async () => {
                  const removed = await db.deleteLog<PracticeLog>("practices", e.id);
                  if (removed) undo.offer(PRACTICE_LABELS[removed.practice_type] ?? removed.practice_type, async () => { await db.restoreLog("practices", removed); refresh(); });
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
  emptyText: { color: colors.muted, fontStyle: "italic", fontSize: 13 },
  recentRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 },
  recentDate: { fontSize: 12, color: colors.muted },
  recentText: { fontSize: 14, color: colors.ink, marginVertical: 4 },
});
