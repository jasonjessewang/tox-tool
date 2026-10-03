import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import * as db from "../storage/db";
import type { FoodLog } from "../engine/types";
import { Card, FormError, PrimaryButton, SectionTitle, Subtitle, SecondaryButton } from "../components/ui";
import { colors, radiusSm } from "../theme";
import { NOVA_LABELS } from "../engine/scoring";
import { todayISO } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { UndoBar, useUndo } from "../components/UndoBar";
import { tr } from "../i18n";

const MEALS: FoodLog["meal"][] = ["breakfast", "lunch", "dinner", "snack"];
const NOVA_LEVELS = [1, 2, 3, 4] as const;

export default function LogFoodScreen() {
  const [foodItem, setFoodItem] = useState("");
  const [meal, setMeal] = useState<FoodLog["meal"]>("breakfast");
  const [processingLevel, setProcessingLevel] = useState<1 | 2 | 3 | 4 | null>(null);
  const [notes, setNotes] = useState("");
  const [recent, setRecent] = useState<FoodLog[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const undo = useUndo();

  async function refresh() {
    const r = await db.getRecentLogs(10);
    setRecent(r.food);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    if (!foodItem.trim()) {
      setError(tr("Write what you ate first -- a few words is enough, like \"toast and eggs\"."));
      return;
    }
    setError(null);
    const { receipt: r } = await runActivity("food_log", () =>
      db.insertFoodLog({
        log_date: todayISO(),
        meal,
        food_item: foodItem.trim(),
        processing_level: processingLevel,
        notes: notes.trim(),
      })
    );
    setReceipt(r);
    setFoodItem("");
    setNotes("");
    setProcessingLevel(null);
    refresh();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>{tr("Log food")}</Text>
      <Subtitle>
        {tr("Free text is fine — e.g. \"sweetened cereal with fruit juice\" or \"toast, black coffee, eggs\". The engine scans for known additive/compound keywords.")}
      </Subtitle>

      {receipt && <ReceiptCard receipt={receipt} />}

      <Card>
        <Text style={styles.label}>{tr("Meal")}</Text>
        <View style={styles.rowWrap}>
          {MEALS.map((m) => (
            <Pressable accessibilityRole="radio" key={m} onPress={() => setMeal(m)} aria-checked={!!(meal === m)} style={[styles.chip, meal === m && styles.chipActive]}>
              <Text style={[styles.chipText, meal === m && styles.chipTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>{tr("Food item(s)")}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={tr("Food items")}
          value={foodItem}
          onChangeText={(t) => {
            setFoodItem(t);
            if (error) setError(null);
          }}
          placeholder={tr("e.g. brightly colored breakfast cereal, orange juice, buttered toast")}
          multiline
        />

        <Text style={styles.label}>{tr("Processing level (NOVA) — optional")}</Text>
        <View style={styles.rowWrap}>
          <Pressable accessibilityRole="radio"
            onPress={() => setProcessingLevel(null)}
            aria-checked={!!(processingLevel === null)} style={[styles.chip, processingLevel === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, processingLevel === null && styles.chipTextActive]}>{tr("Skip")}</Text>
          </Pressable>
          {NOVA_LEVELS.map((lvl) => (
            <Pressable accessibilityRole="radio"
              key={lvl}
              onPress={() => setProcessingLevel(lvl)}
              aria-checked={!!(processingLevel === lvl)} style={[styles.chip, processingLevel === lvl && styles.chipActive]}
            >
              <Text style={[styles.chipText, processingLevel === lvl && styles.chipTextActive]}>{lvl}</Text>
            </Pressable>
          ))}
        </View>
        {processingLevel ? (
          <Text style={styles.hint}>{tr(NOVA_LABELS[processingLevel])}</Text>
        ) : (
          <Text style={styles.hint}>{tr("NOVA sorts foods by how much they are processed: 1 is whole foods, 4 is ultra-processed. Not sure? Skip it -- the words you wrote are enough.")}</Text>
        )}

        <Text style={styles.label}>{tr("Notes (optional)")}</Text>
        <TextInput
          style={styles.input}
          accessibilityLabel={tr("Notes")}
          value={notes}
          onChangeText={setNotes}
          placeholder={tr("e.g. bread was toasted dark, packaging said 'red 40'")}
          multiline
        />

        <FormError message={error} />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title={tr("Log entry")} onPress={submit} />
        </View>
      </Card>

      <SectionTitle>{tr("Recent food entries")}</SectionTitle>
      <UndoBar undo={undo} />
      <Card>
        {recent.length === 0 ? (
          <Text style={{ color: colors.muted, fontStyle: "italic" }}>{tr("No food entries yet.")}</Text>
        ) : (
          recent.map((e) => (
            <View key={e.id} style={styles.recentRow}>
              <Text style={styles.recentDate}>{e.log_date}</Text>
              <Text style={styles.recentText}>
                {e.meal}: {e.food_item}
              </Text>
              <SecondaryButton
                title={tr("Delete")}
                label={tr("Delete {meal}: {food_item}, {log_date}", { meal: e.meal, food_item: e.food_item, log_date: e.log_date })}
                onPress={async () => {
                  const removed = await db.deleteLog<FoodLog>("food", e.id);
                  if (removed) undo.offer(`${removed.meal}: ${removed.food_item}`, async () => { await db.restoreLog("food", removed); refresh(); });
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
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radiusSm,
    padding: 10,
    fontSize: 15,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.ink, fontSize: 13, textTransform: "capitalize" },
  chipTextActive: { color: colors.onAccent },
  recentRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 10 },
  recentDate: { fontSize: 12, color: colors.muted },
  recentText: { fontSize: 14, color: colors.ink, marginVertical: 4 },
});
