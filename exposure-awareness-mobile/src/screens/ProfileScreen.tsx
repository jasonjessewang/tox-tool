import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import * as location from "../services/location";
import * as notify from "../notifications/notify";
import { Card, SecondaryButton } from "../components/ui";
import { deliverExport } from "../services/dataExport";
import { CLINICIAN_NOTE, SCOPE_NOTE, URGENT_NOTE } from "../data/safety";
import { todayISO } from "../util/dates";
import { Collapsible } from "../components/Collapsible";
import { colors } from "../theme";
import type { UserProfile, ContentComplexity, CheckInTime } from "../engine/types";
import IntakeScreen from "./onboarding/IntakeScreen";

const COMPLEXITY_OPTIONS: { key: ContentComplexity; label: string }[] = [
  { key: "simple", label: "Simple" },
  { key: "balanced", label: "Balanced" },
  { key: "technical", label: "Technical" },
];

const CHECKIN_OPTIONS: { key: CheckInTime; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "morning", label: "Morning" },
  { key: "midday", label: "Midday" },
  { key: "dinner", label: "Dinner time" },
];

export default function ProfileScreen({ onDeleted, onSaved }: { onDeleted?: () => void; onSaved?: (profile: UserProfile) => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [complexity, setComplexity] = useState<ContentComplexity>("balanced");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "requesting" | "denied">("idle");
  const [checkInTime, setCheckInTime] = useState<CheckInTime>("off");
  const [learningMoments, setLearningMoments] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    db.getUserProfile().then((p) => {
      setProfile(p);
      if (p) {
        setComplexity(p.contentComplexity);
        setLocationEnabled(p.locationEnabled);
        setCheckInTime(p.checkInTime);
        setLearningMoments(p.learningMoments !== false);
      }
      setLoaded(true);
    });
  }, []);

  async function handleToggleLocation() {
    if (locationEnabled) {
      setLocationEnabled(false);
      return;
    }
    setLocationStatus("requesting");
    const status = await location.requestPermission();
    setLocationEnabled(status === "granted");
    setLocationStatus(status === "granted" ? "idle" : "denied");
  }

  async function handleSave(fields: Omit<UserProfile, "contentComplexity" | "completedAt" | "locationEnabled" | "checkInTime">) {
    const next: UserProfile = {
      ...fields,
      contentComplexity: complexity,
      locationEnabled,
      checkInTime,
      learningMoments,
      completedAt: profile?.completedAt ?? new Date().toISOString(),
    };
    await db.saveUserProfile(next);
    onSaved?.(next);
    if (checkInTime !== profile?.checkInTime) {
      if (checkInTime === "off") {
        await notify.cancelScheduled(notify.CHECKIN_NOTIFICATION_ID);
      } else {
        await notify.requestPermission();
        await notify.applyCheckInSchedule(checkInTime);
      }
    }
    setProfile(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function exportData() {
    const filename = `exposure-awareness-${todayISO()}.json`;
    const result = await deliverExport(JSON.stringify(await db.exportAllData(), null, 2), filename);
    setExportNote(
      result === "downloaded" ? `Saved as ${filename}. It is a plain JSON file you can open in any text editor.` : result === "shared" ? "Shared. Keep it somewhere you trust: it holds your health entries." : result === "cancelled" ? "Nothing was shared." : "This device could not hand the copy over. Nothing was lost."
    );
  }

  async function deleteEverything() {
    await notify.cancelScheduled(notify.CHECKIN_NOTIFICATION_ID);
    await db.clearEverything();
    setConfirmDelete(false);
    onDeleted?.();
  }

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {saved && (
        <View style={styles.savedBanner}>
          <Text style={{ color: colors.accent }}>Profile saved.</Text>
        </View>
      )}
      <IntakeScreen
        initial={profile}
        onContinue={handleSave}
        continueLabel="Save"
        extraSection={
          <>
            <Card>
              <Text style={styles.label}>Detail level</Text>
              <View style={styles.rowWrap}>
                {COMPLEXITY_OPTIONS.map((opt) => (
                  <Pressable
                    accessibilityRole="radio"
                    key={opt.key}
                    onPress={() => setComplexity(opt.key)}
                    aria-checked={!!(complexity === opt.key)} style={[styles.chip, complexity === opt.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, complexity === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card>
              <Text style={styles.label}>Local air quality & significant alerts</Text>
              <Pressable
                accessibilityRole="checkbox"
                onPress={handleToggleLocation}
                aria-checked={!!(locationEnabled)} style={[styles.chip, locationEnabled && styles.chipActive]}
              >
                <Text style={[styles.chipText, locationEnabled && styles.chipTextActive]}>
                  {locationStatus === "requesting" ? "Requesting..." : locationEnabled ? "Enabled" : "Enable"}
                </Text>
              </Pressable>
              {locationStatus === "denied" && (
                <Text style={styles.helper}>Permission wasn't granted -- check your device's location settings.</Text>
              )}
            </Card>

            <Card>
              <Text style={styles.label}>Daily check-in reminder</Text>
              <View style={styles.rowWrap}>
                {CHECKIN_OPTIONS.map((opt) => (
                  <Pressable
                    accessibilityRole="radio"
                    key={opt.key}
                    onPress={() => setCheckInTime(opt.key)}
                    aria-checked={!!(checkInTime === opt.key)} style={[styles.chip, checkInTime === opt.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, checkInTime === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card>
              <Text accessibilityRole="header" aria-level={2} style={styles.label}>Between screens</Text>
              <View style={styles.rowWrap}>
                {([[true, "A short learning moment"], [false, "Straight there"]] as const).map(([on, label]) => (
                  <Pressable accessibilityRole="radio" key={label} onPress={() => setLearningMoments(on)} aria-checked={learningMoments === on} style={[styles.chip, learningMoments === on && styles.chipActive]}>
                    <Text style={[styles.chipText, learningMoments === on && styles.chipTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.helper}>A fact or a quote from the research shows for a few seconds as you move between screens and when the app opens. Skipping one is always one tap; turning them off skips them all.</Text>
            </Card>

            <Card>
              <Text accessibilityRole="header" aria-level={2} style={styles.label}>Your data</Text>
              <Text style={styles.helper}>Everything you enter lives on this device only. You can take a copy, or remove all of it, whenever you like.</Text>
              <View style={{ marginTop: 10, gap: 10 }}>
                <SecondaryButton title="Export a copy (JSON)" onPress={exportData} />
                {exportNote ? <Text accessibilityRole="alert" aria-live="polite" style={styles.helper}>{exportNote}</Text> : null}
                {confirmDelete ? (
                  <View>
                    <Text style={styles.principle}>This removes every entry, your shelf, your places, your learning progress and your settings from this device. It can't be undone -- export a copy first if you might want one.</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <SecondaryButton title="Yes, delete everything" onPress={deleteEverything} />
                      <SecondaryButton title="Keep my data" onPress={() => setConfirmDelete(false)} />
                    </View>
                  </View>
                ) : (
                  <SecondaryButton title="Delete everything..." onPress={() => setConfirmDelete(true)} />
                )}
              </View>
              <View style={{ marginTop: 14 }}>
                <Collapsible title="What leaves this device" teaser="Only public look-ups, and only when you use them">
                  <Text style={styles.principle}>Your profile, logs, shelf, places and score are never sent anywhere. The app reaches out in four cases, and each carries no name, account or entry:</Text>
                  <Text style={styles.principle}>{"\u2022"} Once a day, on opening: searches PubMed (US National Library of Medicine) for recent paper titles to show on the learning-moment screens. Like any web request, it shows your network address to NCBI. It does not happen before you finish setting up, and it stops if you choose "Straight there" above.</Text>
                  <Text style={styles.principle}>{"\u2022"} When you look up a barcode: the barcode number goes to Open Food Facts (food) or Open Beauty Facts (personal care), which are public community databases.</Text>
                  <Text style={styles.principle}>{"\u2022"} Only if you turn on local alerts: your coordinates go to Open-Meteo (air quality) and the US National Weather Service (alerts).</Text>
                  <Text style={styles.principle}>{"\u2022"} Only if you connect your own backend: what you choose to sync goes to that server, which you run.</Text>
                </Collapsible>
              </View>
            </Card>

            <Card>
              <Text accessibilityRole="header" aria-level={2} style={styles.label}>What this is, and isn't</Text>
              <Text style={styles.principle}>{SCOPE_NOTE}</Text>
              <Text style={styles.principle}>{URGENT_NOTE}</Text>
              <Text style={[styles.principle, { marginBottom: 0 }]}>{CLINICIAN_NOTE}</Text>
            </Card>

            <Card>
              <Collapsible title="How this app thinks" icon={"🧭"} teaser="Five rules behind every number and tip you see here">
                <Text style={styles.principle}>
                  <Text style={styles.principleLead}>We measure, we don't diagnose.{"  "}</Text>
                  Everything here comes from what you choose to log -- food, products, air, biomarkers. It's a pattern of estimated exposure, not a lab result or a medical opinion.
                </Text>
                <Text style={styles.principle}>
                  <Text style={styles.principleLead}>We disclose the uncertainty, not just the number.{"  "}</Text>
                  Scores and recommendations here come with their confidence and their limits shown alongside them -- see the Engine Room and Research tab -- instead of buried in fine print.
                </Text>
                <Text style={styles.principle}>
                  <Text style={styles.principleLead}>You decide -- the app doesn't.{"  "}</Text>
                  Nothing here is auto-applied. Recommendations are a starting point for your own judgment about your own life and circumstances, never a verdict. Every tip can be answered "Mark as done" or "I'm keeping this" -- keeping something is a fine answer, and it stays out of your way for 60 days.
                </Text>
                <Text style={styles.principle}>
                  <Text style={styles.principleLead}>Less noise, more signal.{"  "}</Text>
                  We'd rather surface the couple of things worth acting on this week than a feed of every data point you'd have to sort through yourself. That is not only taste: in one primary-care study, each extra reminder per visit made a reminder about 30% less likely to be acted on, and repeats hurt most (Ancker et al. 2017, PubMed 28395667). So each source of advice appears once, and the list stays short.
                </Text>
                <Text style={[styles.principle, { marginBottom: 0 }]}>
                  <Text style={styles.principleLead}>Measure, act, then look again.{"  "}</Text>
                  Tracking helps most when it comes with something to try and feedback on how it went: in a meta-analysis of 122 healthy-eating and physical-activity evaluations, interventions that paired self-monitoring with at least one other self-regulation technique averaged an effect of 0.42, against 0.26 for the rest (Michie et al. 2009, PubMed 19916637). Trials of swapping products or foods also find that measured exposure moves within days (see the Research tab), so a one-week experiment is a fair thing to ask of yourself.
                </Text>
              </Collapsible>
            </Card>
          </>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  savedBanner: { padding: 10, backgroundColor: colors.accentSoft, alignItems: "center" },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 6 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: "#fff" },
  helper: { fontSize: 12, color: colors.muted, marginTop: 8 },
  principle: { fontSize: 13, color: colors.ink, lineHeight: 19, marginBottom: 10 },
  principleLead: { fontWeight: "700" },
});
