import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { PRACTICE_LABELS, ADDING_GOOD_PRACTICE_TYPES } from "../engine/scoring";
import type { CheckInLog, Mood } from "../engine/types";
import { FormError, PrimaryButton, SecondaryButton } from "../components/ui";
import PlantView from "../components/PlantView";
import { getPlant, type TodayCare } from "../engine/plantState";
import type { PlantState } from "../engine/plant";
import { dailyLearning, KIND_LABEL, type Wisdom } from "../data/wisdom";
import { getLiteracy } from "../engine/literacyState";
import { colors, radius, radiusSm, radiusLg, shadow } from "../theme";
import { todayISO } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { PlacesQuestionCard } from "../components/PlacesQuestionCard";
import { RecallQuestionCard } from "../components/RecallQuestionCard";

const MOODS: { key: Mood; label: string; icon: string }[] = [
  { key: "good", label: "Good", icon: "\ud83d\ude42" },
  { key: "okay", label: "Okay", icon: "\ud83d\ude10" },
  { key: "rough", label: "Rough", icon: "\ud83d\ude2b" },
];

const STEPS = [
  { key: "learn", title: "Learn one thing", icon: "\ud83d\udcd6" },
  { key: "add", title: "Add something good", icon: "\ud83d\udca7" },
  { key: "numbers", title: "Today's numbers", icon: "\ud83d\udd22" },
  { key: "reflect", title: "Reflect and plan", icon: "\u2600\ufe0f" },
] as const;

/** One focus per screen: four short steps, one at a time. */
export default function DailyCheckInScreen({ onOpenPlaces }: { onOpenPlaces?: () => void }) {
  const [learning, setLearning] = useState<Wisdom>(() => dailyLearning(new Date(), 1));
  const [step, setStep] = useState(0);
  const [todayEntry, setTodayEntry] = useState<CheckInLog | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [reflection, setReflection] = useState("");
  const [planForTomorrow, setPlanForTomorrow] = useState("");
  const [loggedPractices, setLoggedPractices] = useState<string[]>([]);
  const [calories, setCalories] = useState("");
  const [activeMinutes, setActiveMinutes] = useState("");
  const [screenHours, setScreenHours] = useState("");
  const [numbersSaved, setNumbersSaved] = useState(false);
  const [numbersError, setNumbersError] = useState<string | null>(null);
  // the comparison each recorded activity comes back with (see engine/receipts.ts)
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [plant, setPlant] = useState<PlantState | null>(null);
  const [care, setCare] = useState<TodayCare | null>(null);

  async function refresh() {
    const today = todayISO();
    setTodayEntry((await db.getCheckInLogs(30)).find((e) => e.log_date === today) ?? null);
    setLoggedPractices((await db.getLogsForRange(today, today)).practices.map((p) => p.practice_type));
    const p = await getPlant();
    setPlant(p.plant);
    setCare(p.today);
    const m = (await db.getDailyMetrics(5)).find((x) => x.log_date === today);
    setCalories(m?.calories != null ? String(m.calories) : "");
    setActiveMinutes(m?.active_minutes != null ? String(m.active_minutes) : "");
    setScreenHours(m?.screen_hours != null ? String(m.screen_hours) : "");
  }

  useEffect(() => {
    refresh();
    getLiteracy().then((l) => setLearning(dailyLearning(new Date(), l.tier)));
  }, []);

  const toNum = (v: string) => (v.trim() && !isNaN(Number(v)) ? Number(v) : null);

  async function saveNumbers() {
    const fields: [string, string, number][] = [["Calories", calories, 20000], ["Active minutes", activeMinutes, 1440], ["Screen hours", screenHours, 24]];
    const bad = fields.find(([, v, max]) => v.trim() !== "" && (toNum(v) === null || (toNum(v) as number) < 0 || (toNum(v) as number) > max));
    if (bad) {
      setNumbersError(`${bad[0]} needs a number between 0 and ${bad[2]} -- or leave it empty.`);
      return;
    }
    if (fields.every(([, v]) => v.trim() === "")) {
      setNumbersError("Add at least one number to save -- rough is fine.");
      return;
    }
    setNumbersError(null);
    const { receipt: r } = await runActivity("daily_numbers", () => db.upsertDailyMetrics({ log_date: todayISO(), calories: toNum(calories), active_minutes: toNum(activeMinutes), screen_hours: toNum(screenHours) }));
    setReceipt(r);
    setNumbersSaved(true);
    refresh();
  }

  async function saveCheckIn() {
    const { receipt: r } = await runActivity("checkin_log", () => db.insertCheckInLog({ log_date: todayISO(), mood, reflection: reflection.trim(), planForTomorrow: planForTomorrow.trim() }));
    setReceipt(r);
    setMood(null);
    setReflection("");
    setPlanForTomorrow("");
    refresh();
  }

  const last = step === STEPS.length - 1;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {plant && <PlantView stage={plant.stage} health={plant.health} fruits={plant.fruits} size={64} />}
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.stepKicker}>STEP {step + 1} OF {STEPS.length}</Text>
          <Text accessibilityRole="header" style={styles.stepTitle}>{STEPS[step].icon} {STEPS[step].title}</Text>
        </View>
      </View>
      <View style={styles.bars}>
        {STEPS.map((s, i) => (
          <View key={s.key} style={[styles.bar, i <= step && styles.barOn]} />
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View style={styles.learnCard}>
            <Text style={styles.learnKind}>{learning.icon}  {KIND_LABEL[learning.kind].toUpperCase()}</Text>
            {learning.year ? <Text style={styles.learnYear}>{learning.year}</Text> : null}
            <Text style={styles.learnText}>{learning.kind === "quote" ? `\u201c${learning.text}\u201d` : learning.text}</Text>
            {learning.attribution ? <Text style={styles.learnAttr}>{learning.kind === "quote" ? `\u2014 ${learning.attribution}` : learning.attribution}</Text> : null}
            <View style={{ marginTop: 16, alignSelf: "flex-start" }}>
              {care?.learned ? (
                <Text style={styles.done}>{"\u2713"} Learned today -- your plant thanks you</Text>
              ) : (
                <SecondaryButton title="I read this" onPress={async () => { await db.recordLearning(`daily:${learning.id}`, todayISO()); refresh(); }} />
              )}
            </View>
          </View>
        )}
        {step === 0 && <RecallQuestionCard />}

        {step === 1 && (
          <View>
            <Text style={styles.lead}>Tap anything you did today. Each one waters your plant.</Text>
            <View style={styles.rowWrap}>
              {ADDING_GOOD_PRACTICE_TYPES.map((pt) => {
                const on = loggedPractices.includes(pt);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    key={pt}
                    onPress={async () => {
                      const { receipt: r } = await runActivity("practice_log", () => db.insertPracticeLog({ log_date: todayISO(), practice_type: pt, duration_minutes: null, detail: "", notes: "" }));
                      setReceipt(r);
                      refresh();
                    }}
                    aria-checked={!!(on)} style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && { color: "#fff" }]}>{on ? "\u2713 " : "+ "}{PRACTICE_LABELS[pt]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {receipt?.kind === "practice_log" && (
              <View style={{ marginTop: 14 }}>
                <ReceiptCard receipt={receipt} />
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.lead}>Rough is fine. These feed the charts on your Dashboard.</Text>
            {[
              ["Calories", calories, setCalories, "kcal", "number-pad"],
              ["Active minutes", activeMinutes, setActiveMinutes, "minutes", "number-pad"],
              ["Screen hours", screenHours, setScreenHours, "hours", "decimal-pad"],
            ].map(([label, value, setter, ph, kb]) => (
              <View key={label as string} style={{ marginTop: 12 }}>
                <Text style={styles.label}>{label as string}</Text>
                <TextInput style={styles.input} accessibilityLabel={label as string} value={value as string} onChangeText={(t) => { (setter as (v: string) => void)(t); setNumbersSaved(false); }} placeholder={ph as string} keyboardType={kb as "number-pad"} />
              </View>
            ))}
            <FormError message={numbersError} />
            <View style={{ marginTop: 16 }}>
              <PrimaryButton title={numbersSaved ? "Saved \u2713" : "Save numbers"} onPress={saveNumbers} />
            </View>
            {numbersSaved && receipt?.kind === "daily_numbers" && (
              <View style={{ marginTop: 14 }}>
                <ReceiptCard receipt={receipt} />
              </View>
            )}
          </View>
        )}

        {step === 3 &&
          (todayEntry ? (
            <View style={styles.summary}>
              <Text style={styles.done}>{"\u2713"} Checked in today</Text>
              {todayEntry.mood ? <Text style={styles.summaryMood}>{MOODS.find((m) => m.key === todayEntry.mood)?.icon} {MOODS.find((m) => m.key === todayEntry.mood)?.label}</Text> : null}
              {todayEntry.reflection ? <Text style={styles.summaryText}>{todayEntry.reflection}</Text> : null}
              {todayEntry.planForTomorrow ? <Text style={styles.summaryText}><Text style={{ fontWeight: "700" }}>Tomorrow: </Text>{todayEntry.planForTomorrow}</Text> : null}
              <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <SecondaryButton title="Delete & redo" onPress={async () => { await db.deleteLog("checkins", todayEntry.id); refresh(); }} />
              </View>
              {receipt?.kind === "checkin_log" && (
                <View style={{ marginTop: 14 }}>
                  <ReceiptCard receipt={receipt} />
                </View>
              )}
            </View>
          ) : (
            <View>
              <View style={styles.rowWrap}>
                {MOODS.map((m) => (
                  <Pressable accessibilityRole="radio" key={m.key} onPress={() => setMood(m.key)} aria-checked={!!(mood === m.key)} style={[styles.chip, mood === m.key && styles.chipOn]}>
                    <Text style={[styles.chipText, mood === m.key && { color: "#fff" }]}>{m.icon} {m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>How did today go?</Text>
              <TextInput style={[styles.input, styles.multiline]} accessibilityLabel="How did today go?" value={reflection} onChangeText={setReflection} placeholder="Whatever's true" multiline />
              <Text style={styles.label}>One thing for tomorrow</Text>
              <TextInput style={[styles.input, styles.multiline]} accessibilityLabel="One thing for tomorrow" value={planForTomorrow} onChangeText={setPlanForTomorrow} placeholder="e.g. earlier bedtime, log lunch" multiline />
              <View style={{ marginTop: 16 }}>
                <PrimaryButton title="Save check-in" onPress={saveCheckIn} />
              </View>
            </View>
          ))}
        {step === 3 && <PlacesQuestionCard onOpenPlaces={onOpenPlaces} />}
      </ScrollView>

      <View style={styles.nav}>
        <View style={{ flex: 1 }}>{step > 0 && <SecondaryButton title="Back" onPress={() => setStep(step - 1)} />}</View>
        {!last && (
          <View style={{ flex: 1, marginLeft: 12 }}>
            <PrimaryButton title="Next" onPress={() => setStep(step + 1)} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10 },
  stepKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  stepTitle: { fontSize: 22, fontWeight: "700", color: colors.ink, marginTop: 2 },
  bars: { flexDirection: "row", gap: 6, paddingHorizontal: 16, marginTop: 8 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  barOn: { backgroundColor: colors.accent },
  lead: { fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: 14 },
  learnCard: { backgroundColor: colors.accentSoft, borderRadius: radiusLg, padding: 20 },
  learnKind: { fontSize: 12, letterSpacing: 1.1, fontWeight: "700", color: colors.accent },
  learnYear: { fontSize: 34, fontWeight: "300", color: colors.ink, marginTop: 10 },
  learnText: { fontSize: 17, lineHeight: 26, color: colors.ink, marginTop: 8 },
  learnAttr: { fontSize: 13, color: colors.muted, fontStyle: "italic", marginTop: 10 },
  done: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 15 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 12, fontSize: 16, backgroundColor: "#fff" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  summary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent, borderRadius: radius, padding: 16, ...shadow },
  summaryMood: { fontSize: 18, marginTop: 8 },
  summaryText: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 8 },
  nav: { flexDirection: "row", padding: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
});
