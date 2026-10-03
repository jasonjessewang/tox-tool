import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable } from "react-native";
import * as db from "../storage/db";
import { scoreLogs, loadHazardDb, sourceOf } from "../engine/scoring";
import * as notify from "../notifications/notify";
import { airQualityNotificationsOn } from "../engine/calm";
import { getFusionReport, TREND_LABELS, type FusionReport, type TrendDirection } from "../engine/fusion";
import { personalRelevance, weightedExposure, type PersonalRelevance } from "../engine/personalization";
import type { ScoreReport, UserProfile } from "../engine/types";
import { Card, Subtitle, PrimaryButton, SecondaryButton } from "../components/ui";
import LoadingScreen from "../components/LoadingScreen";
import PlantCard from "../components/PlantCard";
import { getJourney } from "../engine/journeyState";
import type { JourneyTarget, Step } from "../engine/journeyStages";
import { keepFresh, type FreshLine } from "../engine/keepFresh";
import { getRecallState } from "../engine/learningChecksState";
import type { PlantState } from "../engine/plant";
import { buildLedger, type Ledger } from "../engine/ingredients/ledger";
import { Carousel } from "../components/Carousel";
import { BarChart } from "../components/BarChart";
import { summarizeMetric, type MetricSummary } from "../engine/metrics";
import { Collapsible } from "../components/Collapsible";
import { ActionRow } from "../components/ActionRow";
import ScoreGauge from "../components/ScoreGauge";
import { getWellnessScore } from "../engine/wellnessState";
import { getPlacesOverview, type PlacesOverview } from "../engine/places/state";
import { getAdviceInputs, keepAdvice, KEEP_DAYS } from "../engine/adviceState";
import { describeScore, showsNumber, type WellnessScore } from "../engine/wellnessScore";
import { colors, bandColor, radiusLg, shadow, shadowRaised } from "../theme";
import { daysAgoISO, daysBetweenISO, todayISO } from "../util/dates";
import { tr, trn } from "../i18n";

const SCORE_BAND_COLOR: Record<WellnessScore["band"], string> = { building: colors.warn, steady: colors.warn, strong: colors.accent, excellent: colors.accent };

// A direction is information, not a verdict: the way things are heading gets the warm accent, the
// other direction an amber note (never red), and steady / not enough data stay quiet.
const TREND_COLOR: Record<TrendDirection, string> = { improving: colors.accent, worsening: colors.warn, flat: colors.muted, not_enough_data: colors.muted };

function changeLine(s: MetricSummary, unit: string, goodWhen: "up" | "down" | "either") {
  if (s.thisWeekAvg === null) return { text: tr("Add today's numbers in Daily to start this chart."), color: colors.muted };
  const base = tr("Avg {avg}{unit}/day", { avg: s.thisWeekAvg, unit });
  if (s.changePct === null) return { text: tr("{base} - need a prior week to compare", { base }), color: colors.muted };
  if (s.changePct === 0) return { text: tr("{base} - same as last week", { base }), color: colors.muted };
  const up = s.changePct > 0;
  const good = goodWhen === "either" ? null : goodWhen === "up" ? up : !up;
  return { text: up ? tr("{base} - up {pct}% vs last week", { base, pct: Math.abs(s.changePct) }) : tr("{base} - down {pct}% vs last week", { base, pct: Math.abs(s.changePct) }), color: good === null ? colors.muted : good ? colors.accent : colors.warn };
}

function TrendCard({ title, icon, unit, summary, goodWhen }: { title: string; icon: string; unit: string; summary: MetricSummary; goodWhen: "up" | "down" | "either" }) {
  const line = changeLine(summary, unit, goodWhen);
  return (
    <View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.ink }}>{icon} {title}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: line.color, marginTop: 2 }}>{line.text}</Text>
      <BarChart label={tr("{title}, the last seven days", { title })} data={summary.days.map((d) => ({ label: d.label, value: d.value ?? 0 }))} maxHeight={90} />
    </View>
  );
}

/** When the list of changes is empty: the quiet things that keep the picture current, each one a place to go. */
function FreshLines({ lines, onOpen }: { lines: FreshLine[]; onOpen: (target: JourneyTarget, segment?: "engine") => void }) {
  if (lines.length === 0) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.freshLead}>{tr("To keep the picture current")}</Text>
      {lines.map((l) => (
        <Pressable key={l.key} accessibilityRole="button" onPress={() => onOpen(l.target, l.segment)} style={styles.freshRow}>
          <Text style={styles.freshText}>{l.text} {"›"}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function DashboardScreen({ onOpenJourney, onOpenScore, onOpenPlaces, onOpen }: { onOpenJourney: () => void; onOpenScore: () => void; onOpenPlaces: () => void; onOpen: (target: JourneyTarget, segment?: "engine") => void }) {
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [fusion, setFusion] = useState<FusionReport | null>(null);
  const [personal, setPersonal] = useState<PersonalRelevance[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trends, setTrends] = useState<{ calories: MetricSummary; active: MetricSummary; screen: MetricSummary } | null>(null);
  const [plant, setPlant] = useState<PlantState | null>(null);
  const [next, setNext] = useState<{ step: Step; stageTitle: string; done: number; total: number } | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [wellness, setWellness] = useState<WellnessScore | null>(null);
  const [places, setPlaces] = useState<PlacesOverview | null>(null);
  const [kept, setKept] = useState<db.KeptAdvice[]>([]);
  const [fresh, setFresh] = useState<FreshLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState<notify.PermissionState>("default");
  const substanceNames = useMemo(() => Object.fromEntries(loadHazardDb().map((s) => [s.id, s.name])), []);

  const load = useCallback(async () => {
    setLoading(true);
    const start = daysAgoISO(6);
    const end = todayISO();
    const logs = await db.getLogsForRange(start, end);
    const completedKeys = await db.getCompletedActionKeys(daysAgoISO(13));
    const adviceInputs = await getAdviceInputs();
    const scored = scoreLogs(logs, undefined, completedKeys, adviceInputs);
    setReport(scored);
    setKept(await db.getKeptAdvice(end));
    setFusion(await getFusionReport());

    const journey = await getJourney();
    setPlant(journey.plant);
    const active = journey.stages.find((st) => st.id === journey.next?.stage);
    setNext(journey.next && active ? { step: journey.next, stageTitle: active.title, done: active.done, total: active.total } : null);
    setLedger(buildLedger(await db.getShelfItems(true)));
    getWellnessScore().then(setWellness);
    const placesOverview = await getPlacesOverview();
    setPlaces(placesOverview);
    const [recallState, lastBiomarker] = [await getRecallState(), (await db.getBiomarkerLogs(1))[0]];
    setFresh(
      keepFresh({
        recallDue: recallState.recall.due,
        recallUnanswered: recallState.recall.unanswered,
        daysSinceBiomarker: lastBiomarker ? Math.max(0, daysBetweenISO(lastBiomarker.log_date, end)) : null,
        placesUnanswered: placesOverview.places.length > 0 ? placesOverview.summary.unanswered : 0,
      })
    );
    const metricLogs = await db.getDailyMetrics(30);
    const twoWeeks = await db.getLogsForRange(daysAgoISO(13), todayISO());
    setTrends({
      calories: summarizeMetric("calories", metricLogs, twoWeeks.practices),
      active: summarizeMetric("active_minutes", metricLogs, twoWeeks.practices),
      screen: summarizeMetric("screen_hours", metricLogs, twoWeeks.practices),
    });

    const userProfile = await db.getUserProfile();
    setProfile(userProfile);
    const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));
    setPersonal(personalRelevance(weightedExposure(scored, adviceInputs.standing), userProfile, substancesById));

    setPermission(await notify.getPermissionState());

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enableNotifications() {
    const result = await notify.requestPermission();
    setPermission(result);
    if (result === "granted" && profile) {
      const next = { ...profile, airQualityNotifications: true };
      await db.saveUserProfile(next);
      setProfile(next);
      notify.fireLocal(tr("Notifications enabled"), tr("Moderate-or-worse air quality events only."));
    }
  }

  async function markDone(tipKey: string, tipText: string) {
    await db.markActionCompleted(tipKey, tipText, todayISO());
    load();
  }

  async function keepIt(tipKey: string, label: string) {
    await keepAdvice(sourceOf(tipKey), label);
    load();
  }

  async function bringBack(sourceKey: string) {
    await db.unkeepAdvice(sourceKey);
    load();
  }

  if (loading || !report || !fusion) {
    return (
      <LoadingScreen message={tr("Analyzing your week")} />
    );
  }

  const practiceCount = Object.values(report.practice_summary).reduce((sum, s) => sum + (s?.count ?? 0), 0);
  const technicalDefault = profile?.contentComplexity === "technical";
  const personalizedSubstances = personal.map((p) => [p.substanceId, p.reasons] as const);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text accessibilityRole="header" style={styles.h1}>{tr("Dashboard")}</Text>
      <Subtitle>{tr("Your picture this week, compared with published guidance and with you.")}</Subtitle>

      {wellness && (
        <Pressable accessibilityRole="button" onPress={onOpenScore} style={styles.scoreCard}>
          <ScoreGauge score={showsNumber(wellness) ? wellness.overall : null} color={SCORE_BAND_COLOR[wellness.band]} size={108} dim={wellness.provisional} caption={wellness.provisional ? (showsNumber(wellness) ? tr("early") : tr("not yet")) : "/ 100"} />
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={[styles.scoreBand, { color: SCORE_BAND_COLOR[wellness.band] }]}>{tr(describeScore(wellness).label)}</Text>
            <Text style={styles.scoreDesc}>{tr(describeScore(wellness).description)}</Text>
            <Text style={styles.scoreMeta}>
              {tr("Picture {coverage}% filled in", { coverage: wellness.coverage })}
              {wellness.vsBefore ? tr(" · {change} against {window} ago", { change: `${wellness.vsBefore.change > 0 ? "+" : ""}${wellness.vsBefore.change}`, window: tr(wellness.vsBefore.window) }) : ""}
            </Text>
            <Text style={styles.scoreLink}>{tr("See what it compares against ›")}</Text>
          </View>
        </Pressable>
      )}

      <Pressable accessibilityRole="button" onPress={onOpenJourney} style={({ pressed }) => [styles.nextCard, pressed && { opacity: 0.9 }]}>
        <Text style={styles.nextKicker}>
          {next ? tr("YOUR NEXT STEP · {stage} {done}/{total}", { stage: tr(next.stageTitle).toUpperCase(), done: next.done, total: next.total }) : tr("YOUR JOURNEY")}
        </Text>
        <Text style={styles.nextTitle}>{next ? tr(next.step.title) : tr("You've finished every step")}</Text>
        <Text style={styles.nextAction}>{next ? tr(next.step.action) : tr("Open your journey to keep your plant fruiting.")}</Text>
        <View style={styles.nextButton}>
          <Text style={styles.nextButtonText}>{next ? tr("Continue") : tr("Open")} {"\u203a"}</Text>
        </View>
      </Pressable>

      {plant && <PlantCard plant={plant} />}

      <Carousel
        icon={"\ud83e\uddee"}
        title={tr("Awareness")}
        pages={[
          <View key="pos">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.cardTitle, { fontSize: 18 }]}>{tr(fusion.aggregate.position)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <Text style={[styles.pillText, { color: TREND_COLOR[fusion.aggregate.scoreTrend] }]}>
                {tr("Exposure {exposure}", { exposure: tr(TREND_LABELS.exposure[fusion.aggregate.scoreTrend]) })}
              </Text>
              <Text style={[styles.pillText, { color: TREND_COLOR[fusion.aggregate.practiceTrend] }]}>
                {tr("Practices {practices}", { practices: tr(TREND_LABELS.practices[fusion.aggregate.practiceTrend]) })}
              </Text>
            </View>
          </View>,
          <View key="level">
            <Text style={[styles.tipSource, { marginBottom: 4 }]}>{tr("Awareness level")}</Text>
            <Text style={{ fontSize: 24, fontWeight: "700", color: bandColor[report.awareness_band.key] }}>{tr(report.awareness_band.label)}</Text>
            <Text style={[styles.note, { marginBottom: 12 }]}>{tr(report.awareness_band.description)}</Text>
            {(["food", "personal_care", "environment"] as const).map((cat) => (
              <View key={cat} style={styles.catRow}>
                <Text style={styles.tipText}>{cat === "personal_care" ? tr("Personal care") : cat[0].toUpperCase() + cat.slice(1)}</Text>
                <Text style={styles.note}>{tr("{hit_count} flagged", { hit_count: report.category_summary[cat]?.hit_count ?? 0 })}</Text>
              </View>
            ))}
          </View>,
          ...(ledger && ledger.itemCount > 0
            ? [
                <View key="intake">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("🗄️ Your running intake")}</Text>
                  <Text style={styles.note}>{trn(ledger.itemCount, "{n} product on your shelf · relative index {index}", "{n} products on your shelf · relative index {index}", { index: ledger.index })}</Text>
                  {ledger.substances.slice(0, 2).map((sub) => (
                    <View key={sub.substanceId} style={styles.catRow}>
                      <Text style={styles.tipText}>{tr(sub.name)}</Text>
                      <Text style={styles.note}>{tr("{n}/week", { n: sub.servingsPerWeek })}</Text>
                    </View>
                  ))}
                  {ledger.nutrients.filter((n) => n.limitNutrient).slice(0, 2).map((n) => (
                    <View key={n.key} style={styles.catRow}>
                      <Text style={styles.tipText}>{tr(n.label)}</Text>
                      <Text style={styles.note}>{tr("{pct}% of reference/day", { pct: n.pctDv })}</Text>
                    </View>
                  ))}
                  <Text style={[styles.note, { marginTop: 8 }]}>{tr("Full breakdown: Journey › Shelf.")}</Text>
                </View>,
              ]
            : []),
          ...(places
            ? [
                <View key="places">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("🏠 Your places")}</Text>
                  {places.summary.compared === 0 ? (
                    <Text style={styles.note}>{tr("Where do you spend your days? A few plain questions about home, work and everyday places are each compared with published guidance -- and the same tips show up here when a small change would bring one in line.")}</Text>
                  ) : (
                    <>
                      <Text style={styles.note}>
                        {tr("{meets} of {compared} checks meet their reference", { meets: places.summary.meets, compared: places.summary.compared })}
                        {places.summary.attention > 0 ? tr("; worth a look first: {items}.", { items: places.summary.worth.slice(0, 2).map((w) => `${tr(w.placeLabel)}: ${tr(w.short)}`).join("; ") }) : "."}
                      </Text>
                      {places.next && <Text style={[styles.note, { marginTop: 4 }]}>{tr("Next question: {question}", { question: tr(places.next.check.question) })}</Text>}
                    </>
                  )}
                  <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
                    <SecondaryButton title={places.summary.compared === 0 ? tr("Set up my places") : tr("Open places")} onPress={onOpenPlaces} />
                  </View>
                </View>,
              ]
            : []),
          ...(personalizedSubstances.length > 0
            ? [
                <View key="personal">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("🧬 Personalized for you")}</Text>
                  {personalizedSubstances.slice(0, 4).map(([substanceId, reasons]) => (
                    <View key={substanceId} style={{ marginBottom: 10 }}>
                      <Text style={styles.tipText}>{tr(substanceNames[substanceId] ?? substanceId)}</Text>
                      {reasons.map((r, i) => (
                        <Text key={i} style={styles.note}>
                          <Text style={{ fontWeight: "700" }}>{tr(r.label)}: </Text>
                          {tr(r.reason)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>,
              ]
            : []),
        ]}
      />

      <Carousel
        icon={"\u2705"}
        title={tr("Do next")}
        pages={[
          ...(report.focus_items.length > 0
            ? [
                <View key="focus">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("This week's focus")}</Text>
                  {report.focus_items.map((item) => (
                    <ActionRow key={item.tip_key} tip={item.tip} source={item.source} via={item.via} viaPlaces={item.viaPlaces} onOpenPlaces={onOpenPlaces} completed={item.completed} onMarkDone={() => markDone(item.tip_key, item.tip)} onKeep={() => keepIt(item.tip_key, item.source)} keepDays={KEEP_DAYS} />
                  ))}
                </View>,
              ]
            : []),
          ...(report.quick_wins.length > 0
            ? [
                <View key="wins">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("Quick wins")}</Text>
                  {report.quick_wins.map((item) => (
                    <ActionRow key={item.tip_key} tip={item.tip} source={item.source} meta={item.action_impact === "high" ? tr("high impact") : item.action_impact === "medium" ? tr("medium impact") : tr("low impact")} via={item.via} viaPlaces={item.viaPlaces} onOpenPlaces={onOpenPlaces} completed={item.completed} onMarkDone={() => markDone(item.tip_key, item.tip)} onKeep={() => keepIt(item.tip_key, item.source)} keepDays={KEEP_DAYS} />
                  ))}
                </View>,
              ]
            : []),
          ...(report.focus_items.length === 0 && report.quick_wins.length === 0
            ? [
                kept.length > 0 ? (
                  <View key="none">
                    <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("All caught up")}</Text>
                    <Text style={styles.note}>{tr("Everything on your list is something you decided to keep for now.")}</Text>
                    <FreshLines lines={fresh} onOpen={onOpen} />
                  </View>
                ) : (
                  <View key="none">
                    <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("Nothing flagged")}</Text>
                    <Text style={styles.note}>{tr("Log food, products, or air quality from Your Journey and your next best actions will show up here.")}</Text>
                    <FreshLines lines={fresh} onOpen={onOpen} />
                  </View>
                ),
              ]
            : []),
          ...(kept.length > 0
            ? [
                <View key="kept">
                  <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("Kept for now")}</Text>
                  <Text style={[styles.note, { marginBottom: 8 }]}>{tr("Things you looked at and decided to leave alone. They come back on their own, or any time you want.")}</Text>
                  {kept.map((k) => (
                    <View key={k.source_key} style={styles.keptRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tipText}>{tr(k.label)}</Text>
                        <Text style={styles.note}>{tr("until {until}", { until: k.until })}</Text>
                      </View>
                      <SecondaryButton title={tr("Bring back")} label={tr("Bring back: {label}", { label: tr(k.label) })} onPress={() => bringBack(k.source_key)} />
                    </View>
                  ))}
                </View>,
              ]
            : []),
        ]}
      />

      {trends && (
        <Carousel
          icon={"\ud83d\udcc8"}
          title={tr("Your trends")}
          pages={[
            <TrendCard key="c" title={tr("Calories")} icon={"\ud83c\udf7d\ufe0f"} unit={tr(" kcal")} summary={trends.calories} goodWhen="either" />,
            <TrendCard key="a" title={tr("Active time")} icon={"\ud83c\udfc3"} unit={tr(" min")} summary={trends.active} goodWhen="up" />,
            <TrendCard key="s" title={tr("Screen time")} icon={"\ud83d\udcf1"} unit={tr(" h")} summary={trends.screen} goodWhen="down" />,
          ]}
        />
      )}

      <Carousel
        icon={"\ud83c\udf19"}
        title={tr("Resilience")}
        pages={[
          <View key="p">
            <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("Added this week")}</Text>
            {practiceCount === 0 ? (
              <Text style={styles.emptyText}>{tr("Nothing logged yet -- try sleep, hydration, a walk, or a screen-free block.")}</Text>
            ) : (
              Object.entries(report.practice_summary).map(([pt, s]) => (
                <View key={pt} style={styles.catRow}>
                  <Text style={styles.tipText}>{pt.replace("_", " ")}</Text>
                  <Text style={styles.note}>{s!.count}{"\u00d7"}</Text>
                </View>
              ))
            )}
          </View>,
          <View key="why">
            <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("Why this is tracked separately")}</Text>
            <Text style={styles.note}>{report.resilience_note}</Text>
          </View>,
          <View key="calm">
            <Text accessibilityRole="header" aria-level={2} style={styles.cardTitle}>{tr("💬 Feeling overwhelmed by tracking?")}</Text>
            <Text style={styles.note}>{report.behavioral_note}</Text>
          </View>,
        ]}
      />

      {!airQualityNotificationsOn(profile) && permission !== "unsupported" && (
        <Card>
          <Collapsible title={tr("Get notified about air quality")} icon={"\ud83d\udd14"} teaser={tr("Moderate-or-worse air quality events only")}>
            <Text style={styles.note}>{tr("No daily reminders, no \"you haven't logged in\" nudges, no badges -- only a moderate-or-worse reading, logged yourself or (with local alerts on) nearby. Change this anytime under About you › Notifications.")}</Text>
            <View style={{ marginTop: 8 }}>
              <PrimaryButton title={tr("Enable notifications")} onPress={enableNotifications} />
            </View>
          </Collapsible>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  tileRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  tipText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
  keptRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  tipSource: { fontSize: 12, color: colors.muted, textTransform: "uppercase" },
  tipDivider: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 10, paddingTop: 10 },
  cardTitle: { fontWeight: "700", color: colors.ink, marginBottom: 6 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  freshLead: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.accent },
  freshRow: { paddingVertical: 8, minHeight: 32, justifyContent: "center" },
  freshText: { fontSize: 13, color: colors.ink, lineHeight: 19 },
  pillText: { fontSize: 12, fontWeight: "700" },
  scoreCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusLg, padding: 12, marginBottom: 14, ...shadow },
  scoreBand: { fontSize: 19, fontWeight: "700" },
  scoreDesc: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 },
  scoreMeta: { fontSize: 12, color: colors.muted, marginTop: 5 },
  scoreLink: { fontSize: 13, fontWeight: "600", color: colors.accent, marginTop: 6 },
  nextCard: {
    backgroundColor: colors.accentFill,
    borderRadius: radiusLg,
    padding: 20,
    marginBottom: 14,
    ...shadowRaised,
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
  },
  nextKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.onAccentMuted },
  nextTitle: { fontSize: 22, fontWeight: "700", color: colors.onAccent, marginTop: 8, lineHeight: 28 },
  nextAction: { fontSize: 14, color: colors.onAccentMuted, lineHeight: 21, marginTop: 8 },
  nextButton: { alignSelf: "flex-start", backgroundColor: colors.onAccent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, marginTop: 16 },
  nextButtonText: { fontSize: 14, fontWeight: "700", color: colors.accentFill },
  catRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
  emptyText: { color: colors.muted, fontStyle: "italic", fontSize: 13 },
});
