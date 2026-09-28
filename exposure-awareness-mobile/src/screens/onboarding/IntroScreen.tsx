import React, { useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { PrimaryButton, Card, SectionTitle } from "../../components/ui";
import { Collapsible } from "../../components/Collapsible";
import { colors, radiusSm } from "../../theme";
import { STARTER_JOURNEY } from "../../data/starterJourney";
import { ADDING_GOOD_PRACTICE_TYPES, PRACTICE_LABELS } from "../../engine/scoring";
import * as location from "../../services/location";
import conceptsData from "../../data/concepts.json";
import { CLINICIAN_NOTE, SCOPE_NOTE, URGENT_NOTE } from "../../data/safety";
import { CALM_DEFAULTS } from "../../engine/calm";
import type { ContentComplexity, Concept, CheckInTime } from "../../engine/types";

const CONCEPTS = (conceptsData as { concepts: Concept[] }).concepts;
const conceptGeneral = (id: string) => CONCEPTS.find((c) => c.id === id)?.general ?? "";

const COMPLEXITY_OPTIONS: { key: ContentComplexity; label: string; description: string }[] = [
  { key: "simple", label: "Simple", description: "Just the summary and what to do. Detail stays tucked away." },
  { key: "balanced", label: "Balanced", description: "Summary up front, one tap away from the reasoning and sources." },
  { key: "technical", label: "Technical", description: "Mechanism details and citations expanded by default." },
];

const CHECKIN_OPTIONS: { key: CheckInTime; label: string; description: string }[] = [
  { key: "off", label: "Off", description: "No daily reminder -- log whenever you happen to open the app." },
  { key: "morning", label: "Morning", description: "A reminder early in the day, before things get busy." },
  { key: "midday", label: "Midday", description: "A reminder around lunch to reflect on the morning and plan the rest of today." },
  { key: "dinner", label: "Dinner time", description: "A reminder in the evening to close out the day and plan tomorrow." },
];

const ADDING_GOOD_LABEL_LIST = ADDING_GOOD_PRACTICE_TYPES.map((pt) => PRACTICE_LABELS[pt]).join(", ");

export interface IntroChoices {
  contentComplexity: ContentComplexity;
  locationEnabled: boolean;
  checkInTime: CheckInTime;
}

export default function IntroScreen({ onDone }: { onDone: (choices: IntroChoices) => void }) {
  const [complexity, setComplexity] = useState<ContentComplexity>("balanced");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "denied">("idle");
  const [checkInTime, setCheckInTime] = useState<CheckInTime>(CALM_DEFAULTS.checkInTime);

  async function handleEnableLocation() {
    setLocationStatus("requesting");
    const status = await location.requestPermission();
    if (status === "granted") {
      setLocationEnabled(true);
      setLocationStatus("idle");
    } else {
      setLocationEnabled(false);
      setLocationStatus("denied");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>Your first steps</Text>
      <Text style={styles.subtitle}>
        A short, ordered list: the biggest sources first, then everyday habits. Each one is a real change you can make,
        at your own pace, and skipping one is fine.
      </Text>

      <Card>
        {STARTER_JOURNEY.map((q, i) => {
          return (
            <View key={q.id} style={i > 0 ? styles.divider : undefined}>
              <View style={styles.questHeaderRow}>
                <Text style={styles.stepBadge}>{`Step ${q.order}`}</Text>
              </View>
              <Text style={styles.questTitle}>{q.title}</Text>
              <Text style={styles.questAction}>{q.action}</Text>
            </View>
          );
        })}
      </Card>

      <SectionTitle>New to this? Start here</SectionTitle>
      <Card>
        <Collapsible title="What does this app actually mean by 'toxicology'?" icon="🧪">
          <Text style={styles.note}>{conceptGeneral("dose_response")}</Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            That's the whole frame: almost nothing here is "toxic" in an absolute sense. Concern levels reflect how
            consistently something is flagged in public-health guidance, not a personal diagnosis.
          </Text>
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title="How the engine works" icon="⚙️">
          <Text style={styles.note}>{conceptGeneral("aggregate_exposure")}</Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            Two different things run side by side. "Quick Wins" and "Focus" are one-off changes you can make -- swap this,
            fix that -- drawn from what you log, your shelf and your places. Your wellness score is the accumulated
            picture: what you log, your habits, any biomarkers you add, your shelf, your places and what you've learned,
            each compared with a guideline, the app's own rules, or your earlier self. Neither one replaces the other.
          </Text>
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title="Removing bad vs. adding good" icon="⚖️" defaultOpen>
          <Text style={styles.note}>
            Two separate levers, tracked separately on purpose. Quick Wins and Focus items are "removing bad" --
            reducing one specific flagged exposure. Logging a practice like {ADDING_GOOD_LABEL_LIST} is "adding
            good" -- a positive input in its own right, not just the absence of a negative one.
          </Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            {PRACTICE_LABELS.sleep} and {PRACTICE_LABELS.hydration.toLowerCase()} matter exactly as much as exercise
            here -- they're never netted against your exposure score, and logging one is never framed as "cancelling
            out" something you swapped or didn't swap. You can add them from Daily, or from Sleep in your Journey.
          </Text>
        </Collapsible>
      </Card>

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>How much detail do you want by default?</Text>
      <Text style={styles.subtitle}>You can change this anytime in your profile.</Text>
      {COMPLEXITY_OPTIONS.map((opt) => (
        <Pressable
          accessibilityRole="radio"
          key={opt.key}
          onPress={() => setComplexity(opt.key)}
          aria-checked={!!(complexity === opt.key)} style={[styles.option, complexity === opt.key && styles.optionActive]}
        >
          <View style={[styles.radio, complexity === opt.key && styles.radioActive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionDesc}>{opt.description}</Text>
          </View>
        </Pressable>
      ))}

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Local air quality & significant alerts</Text>
      <Text style={styles.subtitle}>
        Optional. Uses your location to show current outdoor air quality and flag significant nearby events --
        wildfire smoke, air quality alerts, extreme heat. Your coordinates go to exactly two free, keyless public
        data sources (Open-Meteo, the National Weather Service) and nowhere else.
      </Text>
      <Card>
        {locationEnabled ? (
          <Text style={styles.confirmText}>Enabled -- you can turn this off anytime in your profile.</Text>
        ) : (
          <>
            <PrimaryButton
              title={locationStatus === "requesting" ? "Requesting..." : "Enable location-based alerts"}
              onPress={handleEnableLocation}
              disabled={locationStatus === "requesting"}
            />
            {locationStatus === "denied" && (
              <Text style={[styles.note, { marginTop: 8 }]}>
                Permission wasn't granted -- you can turn this on later from your device settings and your profile.
              </Text>
            )}
            <Text style={[styles.note, { marginTop: 8 }]}>Skipping this is fine -- everything else works without it.</Text>
          </>
        )}
      </Card>

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>Daily check-in</Text>
      <Text style={styles.subtitle}>
        A short reflection prompt, if you want one. It starts off; you can turn it on here or anytime in your profile.
      </Text>
      {CHECKIN_OPTIONS.map((opt) => (
        <Pressable
          accessibilityRole="radio"
          key={opt.key}
          onPress={() => setCheckInTime(opt.key)}
          aria-checked={!!(checkInTime === opt.key)} style={[styles.option, checkInTime === opt.key && styles.optionActive]}
        >
          <View style={[styles.radio, checkInTime === opt.key && styles.radioActive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>{opt.label}</Text>
            <Text style={styles.optionDesc}>{opt.description}</Text>
          </View>
        </Pressable>
      ))}

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>What this is, and isn't</Text>
      <Card>
        <Text style={styles.note}>{SCOPE_NOTE}</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>{URGENT_NOTE}</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>{CLINICIAN_NOTE}</Text>
      </Card>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          title="Start My Journey"
          onPress={() => onDone({ contentComplexity: complexity, locationEnabled, checkInTime })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 20, marginBottom: 4 },
  questHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepBadge: { fontSize: 12, fontWeight: "700", color: colors.accent, textTransform: "uppercase" },
  questTitle: { fontSize: 14, fontWeight: "600", color: colors.ink, marginTop: 2 },
  questAction: { fontSize: 13, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  divider: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  confirmText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radiusSm,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.card,
  },
  optionActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.line, marginTop: 2 },
  radioActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  optionDesc: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
});
