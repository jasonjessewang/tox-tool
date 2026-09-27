import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import DashboardScreen from "./src/screens/DashboardScreen";
import LogFoodScreen from "./src/screens/LogFoodScreen";
import LogAirQualityScreen from "./src/screens/LogAirQualityScreen";
import LogPracticeScreen from "./src/screens/LogPracticeScreen";
import LogBiomarkerScreen from "./src/screens/LogBiomarkerScreen";
import LearnScreen from "./src/screens/LearnScreen";
import JourneyScreen from "./src/screens/JourneyScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import LoadingScreen from "./src/components/LoadingScreen";
import BrandMark from "./src/components/BrandMark";
import JourneyHubScreen, { type JourneyTarget } from "./src/screens/JourneyHubScreen";
import EvidenceScreen from "./src/screens/EvidenceScreen";
import ScanScreen from "./src/screens/ScanScreen";
import ShelfScreen from "./src/screens/ShelfScreen";
import PlacesScreen from "./src/screens/PlacesScreen";
import RoadmapScreen from "./src/screens/RoadmapScreen";
import ConnectionsScreen from "./src/screens/ConnectionsScreen";
import ScoreScreen from "./src/screens/ScoreScreen";
import DailyCheckInScreen from "./src/screens/DailyCheckInScreen";
import WeeklyDigestScreen from "./src/screens/WeeklyDigestScreen";
import IntakeScreen from "./src/screens/onboarding/IntakeScreen";
import IntroScreen, { type IntroChoices } from "./src/screens/onboarding/IntroScreen";
import * as db from "./src/storage/db";
import * as notify from "./src/notifications/notify";
import { refreshLiteratureIfStale, shouldRefreshLiterature } from "./src/services/pubmed";
import { colors } from "./src/theme";
import type { UserProfile } from "./src/engine/types";

// No login screen: this build is local-only by design -- fully usable with zero accounts.
// The health-intake profile below is a DIFFERENT thing from login/SSO: it's stored purely
// on-device (storage/db.ts) and never leaves the app, used only to tailor which flagged
// items matter more for a given person (engine/personalization.ts).

type Tab = "dashboard" | "daily" | "weekly" | "learn";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "" },
  { key: "daily", label: "Daily", icon: "☀️" },
  { key: "weekly", label: "Weekly", icon: "📅" },
  { key: "learn", label: "Learn", icon: "📖" },
];

type Overlay = "journey" | "log_food" | "log_air" | "log_practice" | "log_biomarker" | "quests" | "roadmap" | "profile" | "evidence" | "scan" | "shelf" | "places" | "connections" | "score";

const OVERLAY_TITLES: Record<Overlay, string> = {
  journey: "Your Journey",
  log_food: "Food",
  log_air: "Air quality",
  log_practice: "Sleep & resets",
  log_biomarker: "Biomarkers",
  quests: "Tutorial quests",
  roadmap: "Roadmap",
  profile: "About you",
  evidence: "Research",
  scan: "Scan a product",
  shelf: "My shelf",
  places: "Your places",
  score: "Your score",
  connections: "Connected sources",
};

const TAB_TARGETS: Partial<Record<JourneyTarget, Tab>> = { daily: "daily", weekly: "weekly", learn: "learn" };

type BootPhase = "loading" | "intake" | "intro" | "app";

const LAUNCH_BEAT_MS = 5500;
const NAV_BEAT_MS = 3200;

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Where each screen was opened from, so "back" goes back to that (null is the tab the person was on) rather than always to the Journey.
  const [trail, setTrail] = useState<(Overlay | null)[]>([]);
  // A learning moment between screens; the person can switch it off under About you.
  const [momentsOn, setMomentsOn] = useState(true);
  // which part of Learn to open on, when something elsewhere in the app points at it (e.g. the questions ready for review)
  const [learnSegment, setLearnSegment] = useState<"engine" | undefined>(undefined);
  const [bootPhase, setBootPhase] = useState<BootPhase>("loading");
  const [intakeFields, setIntakeFields] = useState<Omit<
    UserProfile,
    "contentComplexity" | "completedAt" | "locationEnabled" | "checkInTime"
  > | null>(null);

  const [transitioning, setTransitioning] = useState(false);
  const [launchDone, setLaunchDone] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [pendingPhase, setPendingPhase] = useState<BootPhase | null>(null);

  useEffect(() => {
    db.getUserProfile().then((profile) => {
      setPendingPhase(profile ? "app" : "intake");
      const on = profile?.learningMoments !== false;
      setMomentsOn(on);
      if (!on) setLaunchDone(true);
      // no request to NCBI before setup is finished, or for someone who chose "Straight there"
      if (shouldRefreshLiterature(profile)) refreshLiteratureIfStale();
    });
  }, []);

  useEffect(() => {
    if (launchDone && pendingPhase && bootPhase === "loading") setBootPhase(pendingPhase);
  }, [launchDone, pendingPhase, bootPhase]);

  const finishLaunch = useCallback(() => setLaunchDone(true), []);
  const finishTransition = useCallback(() => setTransitioning(false), []);

  function navigate(apply: () => void) {
    apply();
    setDetailOpen(false);
    if (momentsOn) setTransitioning(true);
  }

  function openOverlay(next: Overlay) {
    navigate(() => {
      setTrail((t) => [...t, overlay]);
      setOverlay(next);
    });
  }

  function goBack() {
    navigate(() => {
      setOverlay(trail.length > 0 ? trail[trail.length - 1] : null);
      setTrail(trail.slice(0, -1));
    });
  }

  function openTarget(t: JourneyTarget, segment?: "engine") {
    const tab = TAB_TARGETS[t];
    if (tab) {
      navigate(() => {
        setLearnSegment(t === "learn" ? segment : undefined);
        setTrail([]);
        setOverlay(null);
        setTab(tab);
      });
    } else {
      openOverlay(t as Overlay);
    }
  }

  const backTo = trail.length > 0 ? trail[trail.length - 1] : null;
  const backLabel = backTo === "journey" ? "Journey" : backTo ? OVERLAY_TITLES[backTo] : TABS.find((x) => x.key === tab)!.label;

  async function handleIntakeContinue(
    fields: Omit<UserProfile, "contentComplexity" | "completedAt" | "locationEnabled" | "checkInTime">
  ) {
    setIntakeFields(fields);
    setBootPhase("intro");
  }

  async function handleIntroDone(choices: IntroChoices) {
    if (!intakeFields) return;
    const profile: UserProfile = { ...intakeFields, ...choices, completedAt: new Date().toISOString() };
    await db.saveUserProfile(profile);
    if (choices.checkInTime !== "off") {
      await notify.requestPermission();
      await notify.applyCheckInSchedule(choices.checkInTime);
    }
    setBootPhase("app");
  }

  if (bootPhase === "loading") {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingScreen message="Welcome" minMs={LAUNCH_BEAT_MS} onDone={finishLaunch} />
      </SafeAreaView>
    );
  }

  if (bootPhase === "intake") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <IntakeScreen initial={null} onContinue={handleIntakeContinue} />
      </SafeAreaView>
    );
  }

  if (bootPhase === "intro") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <IntroScreen onDone={handleIntroDone} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {(overlay || !transitioning) && !detailOpen ? (
      <View style={styles.header}>
        {overlay ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${backLabel}`}
            onPress={goBack}
            hitSlop={8}
            style={{ paddingVertical: 6, marginVertical: -6 }}
          >
            <Text style={styles.back}>{"\u2039"} {backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.brandRow}>
            <BrandMark size={20} />
            <Text style={styles.brand}>Exposure Awareness</Text>
          </View>
        )}
        {overlay && <Text style={styles.headerTitle}>{OVERLAY_TITLES[overlay]}</Text>}
      </View>
      ) : null}

      <View style={styles.body}>
        {transitioning ? <LoadingScreen minMs={NAV_BEAT_MS} onDone={finishTransition} onLearnMore={() => { setTrail([]); setOverlay(null); setTab("learn"); setTransitioning(false); }} /> : null}
        {!transitioning && overlay === "journey" && <JourneyHubScreen onOpen={openTarget} />}
        {!transitioning && overlay === "log_food" && <LogFoodScreen />}
        {!transitioning && overlay === "log_air" && <LogAirQualityScreen />}
        {!transitioning && overlay === "log_practice" && <LogPracticeScreen />}
        {!transitioning && overlay === "log_biomarker" && <LogBiomarkerScreen />}
        {!transitioning && overlay === "quests" && <JourneyScreen />}
        {!transitioning && overlay === "profile" && <ProfileScreen onSaved={(p) => setMomentsOn(p.learningMoments !== false)} onDeleted={() => { setTrail([]); setOverlay(null); setTab("dashboard"); setMomentsOn(true); setBootPhase("intake"); }} />}
        {!transitioning && overlay === "roadmap" && <RoadmapScreen />}
        {!transitioning && overlay === "evidence" && <EvidenceScreen onDetailChange={setDetailOpen} />}
        {!transitioning && overlay === "scan" && <ScanScreen onOpenShelf={() => openOverlay("shelf")} />}
        {!transitioning && overlay === "shelf" && <ShelfScreen onScan={() => openOverlay("scan")} />}
        {!transitioning && overlay === "places" && <PlacesScreen onOpenScore={() => openOverlay("score")} />}
        {!transitioning && overlay === "connections" && <ConnectionsScreen />}
        {!transitioning && overlay === "score" && <ScoreScreen />}
        {!transitioning && !overlay && tab === "dashboard" && <DashboardScreen onOpenJourney={() => openOverlay("journey")} onOpenScore={() => openOverlay("score")} onOpenPlaces={() => openOverlay("places")} onOpen={openTarget} />}
        {!transitioning && !overlay && tab === "daily" && <DailyCheckInScreen onOpenPlaces={() => openOverlay("places")} />}
        {!transitioning && !overlay && tab === "weekly" && <WeeklyDigestScreen />}
        {!transitioning && !overlay && tab === "learn" && <LearnScreen onDetailChange={setDetailOpen} initialSegment={learnSegment} />}
      </View>

      {overlay || detailOpen || transitioning ? null : (
      <View style={styles.tabbar} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            aria-selected={!overlay && tab === t.key}
            key={t.key}
            onPress={() => {
              if (!overlay && tab === t.key) return;
              navigate(() => {
                setLearnSegment(undefined);
                setTrail([]);
                setOverlay(null);
                setTab(t.key);
              });
            }}
            style={styles.tabItem}
          >
            {t.key === "dashboard" ? (
              <BrandMark size={18} color={!overlay && tab === t.key ? colors.accent : colors.muted} style={!overlay && tab === t.key ? undefined : styles.tabIconDim} />
            ) : (
              <Text aria-hidden importantForAccessibility="no-hide-descendants" style={[styles.tabIcon, !overlay && tab === t.key && styles.tabIconActive]}>{t.icon}</Text>
            )}
            <Text style={[styles.tabLabel, !overlay && tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { fontSize: 16, fontWeight: "700", color: colors.accent },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  headerTitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  body: { flex: 1 },
  tabbar: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    paddingTop: 10,
    flexDirection: "row",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
  tabIcon: { fontSize: 17, opacity: 0.55 },
  tabIconActive: { opacity: 1 },
  tabIconDim: { opacity: 0.55 },
  tabLabel: { fontSize: 12, color: colors.muted },
  tabLabelActive: { color: colors.accent, fontWeight: "700" },
});
