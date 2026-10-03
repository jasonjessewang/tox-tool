import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import ErrorBoundary from "./src/components/ErrorBoundary";
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
import { colors, resolveTheme } from "./src/theme";
import type { UserProfile } from "./src/engine/types";
import { CALM_DEFAULTS, learningMomentsOn } from "./src/engine/calm";
import { msg, tr } from "./src/i18n";

// No login screen: this build is local-only by design -- fully usable with zero accounts.
// The health-intake profile below is a DIFFERENT thing from login/SSO: it's stored purely
// on-device (storage/db.ts) and never leaves the app, used only to tailor which flagged
// items matter more for a given person (engine/personalization.ts).

type Tab = "dashboard" | "daily" | "weekly" | "learn";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: msg("Dashboard"), icon: "" },
  { key: "daily", label: msg("Daily"), icon: "☀️" },
  { key: "weekly", label: msg("Weekly"), icon: "📅" },
  { key: "learn", label: msg("Learn"), icon: "📖" },
];

type Overlay = "journey" | "log_food" | "log_air" | "log_practice" | "log_biomarker" | "quests" | "roadmap" | "profile" | "evidence" | "scan" | "shelf" | "places" | "connections" | "score";

const OVERLAY_TITLES: Record<Overlay, string> = {
  journey: msg("Your Journey"),
  log_food: msg("Food"),
  log_air: msg("Air quality"),
  log_practice: msg("Sleep & resets"),
  log_biomarker: msg("Biomarkers"),
  quests: msg("Tutorial quests"),
  roadmap: msg("Roadmap"),
  profile: msg("About you"),
  evidence: msg("Research"),
  scan: msg("Scan a product"),
  shelf: msg("My shelf"),
  places: msg("Your places"),
  score: msg("Your score"),
  connections: msg("Connected sources"),
};

const TAB_TARGETS: Partial<Record<JourneyTarget, Tab>> = { daily: "daily", weekly: "weekly", learn: "learn", dashboard: "dashboard" };

type BootPhase = "loading" | "intake" | "intro" | "app";

const LAUNCH_BEAT_MS = 5500;
const NAV_BEAT_MS = 3200;

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

/**
 * The app's frame on every platform: content stays clear of the status bar, a notch, the home indicator and Android's own
 * navigation buttons (which the app now draws behind, edge to edge). Each strip takes the colour of what sits next to it,
 * so there is no seam. With the tab bar showing, the bar itself reaches the bottom edge instead (`bottomInset={false}`).
 */
function Frame({ topColor = colors.bg, bottomColor = colors.bg, bottomInset = true, children }: { topColor?: string; bottomColor?: string; bottomInset?: boolean; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.safe, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={{ height: insets.top, backgroundColor: topColor }} />
      {children}
      {bottomInset ? <View style={{ height: insets.bottom, backgroundColor: bottomColor }} /> : null}
    </View>
  );
}

function AppInner() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  // Where each screen was opened from, so "back" goes back to that (null is the tab the person was on) rather than always to the Journey.
  const [trail, setTrail] = useState<(Overlay | null)[]>([]);
  // A learning moment between screens; the person can switch it off under About you.
  const [momentsOn, setMomentsOn] = useState(CALM_DEFAULTS.learningMoments);
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
      const on = learningMomentsOn(profile);
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
  const backLabel = tr(backTo === "journey" ? msg("Journey") : backTo ? OVERLAY_TITLES[backTo] : TABS.find((x) => x.key === tab)!.label);

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
      <Frame topColor={colors.calmBg} bottomColor={colors.calmBg}>
        <LoadingScreen message={tr("Welcome")} minMs={LAUNCH_BEAT_MS} onDone={finishLaunch} />
      </Frame>
    );
  }

  if (bootPhase === "intake") {
    return (
      <Frame>
        <StatusBar style={resolveTheme() === "dark" ? "light" : "dark"} />
        <IntakeScreen initial={null} onContinue={handleIntakeContinue} />
      </Frame>
    );
  }

  if (bootPhase === "intro") {
    return (
      <Frame>
        <StatusBar style={resolveTheme() === "dark" ? "light" : "dark"} />
        <IntroScreen onDone={handleIntroDone} />
      </Frame>
    );
  }

  const headerShown = (overlay || !transitioning) && !detailOpen;
  const tabBarShown = !(overlay || detailOpen || transitioning);
  const bodyColor = transitioning ? colors.calmBg : colors.bg;

  return (
    <Frame topColor={headerShown ? colors.card : bodyColor} bottomColor={bodyColor} bottomInset={!tabBarShown}>
      <StatusBar style={resolveTheme() === "dark" ? "light" : "dark"} />
      {headerShown ? (
      <View style={styles.header}>
        {overlay ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr("Back to {backLabel}", { backLabel })}
            onPress={goBack}
            hitSlop={8}
            style={{ paddingVertical: 6, marginVertical: -6 }}
          >
            <Text style={styles.back}>{"\u2039"} {backLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.brandRow}>
            <BrandMark size={20} />
            <Text style={styles.brand}>{tr("Exposure Awareness")}</Text>
          </View>
        )}
        {overlay && <Text style={styles.headerTitle}>{tr(OVERLAY_TITLES[overlay])}</Text>}
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
        {!transitioning && overlay === "profile" && <ProfileScreen onSaved={(p) => setMomentsOn(learningMomentsOn(p))} onDeleted={() => { setTrail([]); setOverlay(null); setTab("dashboard"); setMomentsOn(CALM_DEFAULTS.learningMoments); setBootPhase("intake"); }} />}
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

      {!tabBarShown ? null : (
      <View style={[styles.tabbar, { paddingBottom: 8 + insets.bottom }]} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={tr(t.label)}
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
            <Text style={[styles.tabLabel, !overlay && tab === t.key && styles.tabLabelActive]}>{tr(t.label)}</Text>
          </Pressable>
        ))}
      </View>
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
    paddingTop: 10,
    flexDirection: "row",
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 4, gap: 2 },
  tabIcon: { fontSize: 17, opacity: 0.55, color: colors.ink },
  tabIconActive: { opacity: 1 },
  tabIconDim: { opacity: 0.55 },
  tabLabel: { fontSize: 12, color: colors.muted },
  tabLabelActive: { color: colors.accent, fontWeight: "700" },
});
