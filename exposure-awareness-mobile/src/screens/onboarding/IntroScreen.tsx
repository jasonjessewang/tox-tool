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
import { msg, tr } from "../../i18n";

const CONCEPTS = (conceptsData as { concepts: Concept[] }).concepts;
const conceptGeneral = (id: string) => CONCEPTS.find((c) => c.id === id)?.general ?? "";

const COMPLEXITY_OPTIONS: { key: ContentComplexity; label: string; description: string }[] = [
  { key: "simple", label: msg("Simple"), description: msg("Just the summary and what to do. Detail stays tucked away.") },
  { key: "balanced", label: msg("Balanced"), description: msg("Summary up front, one tap away from the reasoning and sources.") },
  { key: "technical", label: msg("Technical"), description: msg("Mechanism details and citations expanded by default.") },
];

const CHECKIN_OPTIONS: { key: CheckInTime; label: string; description: string }[] = [
  { key: "off", label: msg("Off"), description: msg("No daily reminder -- log whenever you happen to open the app.") },
  { key: "morning", label: msg("Morning"), description: msg("A reminder early in the day, before things get busy.") },
  { key: "midday", label: msg("Midday"), description: msg("A reminder around lunch to reflect on the morning and plan the rest of today.") },
  { key: "dinner", label: msg("Dinner time"), description: msg("A reminder in the evening to close out the day and plan tomorrow.") },
];

const addingGoodLabelList = () => ADDING_GOOD_PRACTICE_TYPES.map((pt) => tr(PRACTICE_LABELS[pt])).join(", ");

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
      <Text accessibilityRole="header" style={styles.h1}>{tr("Your first steps")}</Text>
      <Text style={styles.subtitle}>
        {tr("A short, ordered list: the biggest sources first, then everyday habits. Each one is a real change you can make, at your own pace, and skipping one is fine.")}
      </Text>

      <Card>
        {STARTER_JOURNEY.map((q, i) => {
          return (
            <View key={q.id} style={i > 0 ? styles.divider : undefined}>
              <View style={styles.questHeaderRow}>
                <Text style={styles.stepBadge}>{tr("Step {order}", { order: q.order })}</Text>
              </View>
              <Text style={styles.questTitle}>{q.title}</Text>
              <Text style={styles.questAction}>{q.action}</Text>
            </View>
          );
        })}
      </Card>

      <SectionTitle>{tr("New to this? Start here")}</SectionTitle>
      <Card>
        <Collapsible title={tr("What does this app actually mean by 'toxicology'?")} icon="🧪">
          <Text style={styles.note}>{tr(conceptGeneral("dose_response"))}</Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            {tr("That's the whole frame: almost nothing here is \"toxic\" in an absolute sense. Concern levels reflect how consistently something is flagged in public-health guidance, not a personal diagnosis.")}
          </Text>
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title={tr("How the engine works")} icon="⚙️">
          <Text style={styles.note}>{tr(conceptGeneral("aggregate_exposure"))}</Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            {tr("Two different things run side by side. \"Quick Wins\" and \"Focus\" are one-off changes you can make -- swap this, fix that -- drawn from what you log, your shelf and your places. Your wellness score is the accumulated picture: what you log, your habits, any biomarkers you add, your shelf, your places and what you've learned, each compared with a guideline, the app's own rules, or your earlier self. Neither one replaces the other.")}
          </Text>
        </Collapsible>
      </Card>
      <Card>
        <Collapsible title={tr("Removing bad vs. adding good")} icon="⚖️" defaultOpen>
          <Text style={styles.note}>
            {tr("Two separate levers, tracked separately on purpose. Quick Wins and Focus items are \"removing bad\" -- reducing one specific flagged exposure. Logging a practice like {practices} is \"adding good\" -- a positive input in its own right, not just the absence of a negative one.", { practices: addingGoodLabelList() })}
          </Text>
          <Text style={[styles.note, { marginTop: 8 }]}>
            {tr("{sleep} and {hydration} matter exactly as much as exercise here -- they're never netted against your exposure score, and logging one is never framed as \"cancelling out\" something you swapped or didn't swap. You can add them from Daily, or from Sleep in your Journey.", { sleep: PRACTICE_LABELS.sleep, hydration: PRACTICE_LABELS.hydration.toLowerCase() })}
          </Text>
        </Collapsible>
      </Card>

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{tr("How much detail do you want by default?")}</Text>
      <Text style={styles.subtitle}>{tr("You can change this anytime in your profile.")}</Text>
      {COMPLEXITY_OPTIONS.map((opt) => (
        <Pressable
          accessibilityRole="radio"
          key={opt.key}
          onPress={() => setComplexity(opt.key)}
          aria-checked={!!(complexity === opt.key)} style={[styles.option, complexity === opt.key && styles.optionActive]}
        >
          <View style={[styles.radio, complexity === opt.key && styles.radioActive]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>{tr(opt.label)}</Text>
            <Text style={styles.optionDesc}>{tr(opt.description)}</Text>
          </View>
        </Pressable>
      ))}

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{tr("Local air quality & significant alerts")}</Text>
      <Text style={styles.subtitle}>
        {tr("Optional. Uses your location to show current outdoor air quality and flag significant nearby events -- wildfire smoke, air quality alerts, extreme heat. Your coordinates go to exactly two free, keyless public data sources (Open-Meteo, the National Weather Service) and nowhere else.")}
      </Text>
      <Card>
        {locationEnabled ? (
          <Text style={styles.confirmText}>{tr("Enabled -- you can turn this off anytime in your profile.")}</Text>
        ) : (
          <>
            <PrimaryButton
              title={locationStatus === "requesting" ? tr("Requesting...") : tr("Enable location-based alerts")}
              onPress={handleEnableLocation}
              disabled={locationStatus === "requesting"}
            />
            {locationStatus === "denied" && (
              <Text style={[styles.note, { marginTop: 8 }]}>
                {tr("Permission wasn't granted -- you can turn this on later from your device settings and your profile.")}
              </Text>
            )}
            <Text style={[styles.note, { marginTop: 8 }]}>{tr("Skipping this is fine -- everything else works without it.")}</Text>
          </>
        )}
      </Card>

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{tr("Daily check-in")}</Text>
      <Text style={styles.subtitle}>
        {tr("A short reflection prompt, if you want one. It starts off; you can turn it on here or anytime in your profile.")}
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
            <Text style={styles.optionLabel}>{tr(opt.label)}</Text>
            <Text style={styles.optionDesc}>{tr(opt.description)}</Text>
          </View>
        </Pressable>
      ))}

      <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{tr("What this is, and isn't")}</Text>
      <Card>
        <Text style={styles.note}>{tr(SCOPE_NOTE)}</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>{tr(URGENT_NOTE)}</Text>
        <Text style={[styles.note, { marginTop: 8 }]}>{tr(CLINICIAN_NOTE)}</Text>
      </Card>

      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          title={tr("Start My Journey")}
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
