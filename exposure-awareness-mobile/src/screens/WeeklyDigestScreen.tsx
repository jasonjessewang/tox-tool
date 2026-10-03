import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl } from "react-native";
import * as db from "../storage/db";
import { scoreLogs, loadHazardDb } from "../engine/scoring";
import { buildWeeklyDigest, type WeeklyDigest } from "../engine/weeklyDigest";
import { getAdviceInputs } from "../engine/adviceState";
import * as location from "../services/location";
import * as notify from "../notifications/notify";
import { airQualityNotificationsOn } from "../engine/calm";
import { fetchCurrentAirQuality, type AirQualitySnapshot } from "../services/airQuality";
import { fetchSignificantAlerts, type WeatherAlert } from "../services/weatherAlerts";
import { Card, SectionTitle, Subtitle } from "../components/ui";
import { buildWeekLog, type WeekLog } from "../engine/weekLog";
import LoadingScreen from "../components/LoadingScreen";
import { Carousel } from "../components/Carousel";
import { Collapsible } from "../components/Collapsible";
import { colors, bandColor } from "../theme";
import { daysAgoISO, todayISO } from "../util/dates";
import type { ContentComplexity } from "../engine/types";
import type { ExposureSource } from "../engine/personalization";
import { msg, tr, trn } from "../i18n";

const FROM_LABEL: Record<ExposureSource, string> = { log: msg("logged this week"), shelf: msg("on your shelf"), places: msg("in your places") };

type ConditionsState =
  | { status: "off" }
  | { status: "loading" }
  | { status: "no-location" }
  | { status: "ready"; airQuality: AirQualitySnapshot | null; alerts: WeatherAlert[] };

export default function WeeklyDigestScreen() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [weekLog, setWeekLog] = useState<WeekLog | null>(null);
  const [conditions, setConditions] = useState<ConditionsState>({ status: "off" });
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<ContentComplexity>("balanced");

  const load = useCallback(async () => {
    setLoading(true);
    const userProfile = await db.getUserProfile();
    setLevel(userProfile?.contentComplexity ?? "balanced");
    const logs = await db.getLogsForRange(daysAgoISO(6), todayISO());
    const completedKeys = await db.getCompletedActionKeys(daysAgoISO(13));
    const adviceInputs = await getAdviceInputs();
    const report = scoreLogs(logs, undefined, completedKeys, adviceInputs);
    const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));
    const biomarkers = await db.getBiomarkerLogs(20);
    setDigest(buildWeeklyDigest(report, substancesById, biomarkers, new Date(), { profile: userProfile, standing: adviceInputs.standing }));
    setWeekLog(
      buildWeekLog({
        logs,
        checkins: await db.getCheckInLogs(30),
        metrics: await db.getDailyMetrics(30),
        actions: await db.getCompletedActions(daysAgoISO(6)),
      })
    );

    if (!userProfile?.locationEnabled) {
      setConditions({ status: "off" });
    } else {
      setConditions({ status: "loading" });
      const coords = await location.getCoords();
      if (!coords) {
        setConditions({ status: "no-location" });
      } else {
        const [airQuality, alerts] = await Promise.all([fetchCurrentAirQuality(coords), fetchSignificantAlerts(coords)]);
        setConditions({ status: "ready", airQuality, alerts });

        // Bookkeeping (what's been seen) runs regardless, so turning notifications on later starts fresh instead of
        // dumping a backlog; only the actual notification is gated on the person's own preference.
        const notifyOn = airQualityNotificationsOn(userProfile);
        const today = todayISO();
        const c = airQuality?.classification;
        if (c && c.concern_level >= 2 && (await db.shouldNotifyAqiToday(today))) {
          if (notifyOn) await notify.fireLocal(tr("{category} air quality near you", { category: tr(c.category) }), tr(c.guidance));
          await db.markAqiNotified(today);
        }
        const fresh = await db.getUnnotifiedAlertIds(alerts.map((a) => a.id));
        if (notifyOn) {
          for (const alert of alerts.filter((a) => fresh.includes(a.id))) {
            await notify.fireLocal(alert.event, alert.headline);
          }
        }
        if (fresh.length > 0) await db.markAlertsNotified(fresh);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !digest) {
    return (
      <LoadingScreen message={tr("Analyzing your week")} />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text accessibilityRole="header" style={styles.h1}>{tr("Weekly Digest")}</Text>
      <Subtitle>{tr("Where things stand, what's worth considering, and one thing to learn -- refreshed each visit.")}</Subtitle>

      <Card style={{ borderColor: bandColor[digest.indicator.key] }}>
        <Text style={[styles.indicatorLabel, { color: bandColor[digest.indicator.key] }]}>{tr(digest.indicator.label)}</Text>
        <Text style={styles.note}>{tr(digest.indicator.description)}</Text>
      </Card>

      {weekLog && (
        <>
          <SectionTitle>{tr("Your week, day by day")}</SectionTitle>
          <Card>
            <Text style={styles.tipText}>
              {tr("{daysActive}/7 days active · {checkIns} check-ins · {practices} practices · {actions} actions", { daysActive: weekLog.totals.daysActive, checkIns: weekLog.totals.checkIns, practices: weekLog.totals.practices, actions: weekLog.totals.actions })}
            </Text>
            {weekLog.days.map((d) => (
              <View key={d.date} style={styles.dayRow}>
                <View style={styles.dayLabel}>
                  <Text style={[styles.dayName, d.isToday && { color: colors.accent }]}>{d.weekday}</Text>
                  <Text style={styles.dayMood}>{d.mood === "good" ? "\ud83d\ude42" : d.mood === "okay" ? "\ud83d\ude10" : d.mood === "rough" ? "\ud83d\ude2b" : d.checkedIn ? "\u2713" : ""}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  {d.hasAnything ? (
                    <>
                      {d.practices.length > 0 && <Text style={styles.dayLine}>{tr("Added: {practices}", { practices: d.practices.map((p) => tr(p)).join(", ") })}</Text>}
                      {d.actions > 0 && <Text style={styles.dayLine}>{trn(d.actions, "{n} action completed", "{n} actions completed")}</Text>}
                      {d.meals > 0 && <Text style={styles.dayLine}>{trn(d.meals, "{n} meal logged", "{n} meals logged")}</Text>}
                      {d.scans > 0 && <Text style={styles.dayLine}>{trn(d.scans, "{n} product scanned", "{n} products scanned")}</Text>}
                      {(d.calories !== null || d.activeMinutes !== null || d.screenHours !== null) && (
                        <Text style={styles.dayNums}>
                          {[d.calories !== null ? `${d.calories} kcal` : null, d.activeMinutes !== null ? tr("{n} min active", { n: d.activeMinutes }) : null, d.screenHours !== null ? tr("{n} h screen", { n: d.screenHours }) : null].filter(Boolean).join("  \u00b7  ")}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.dayEmpty}>{tr("Nothing logged")}</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <Carousel
        icon={"\ud83d\udcc5"}
        title={tr("This week's insights")}
        pages={[
          <View key="cond">
            <Text style={styles.pageTitle}>{tr("Local conditions")}</Text>
            {conditions.status === "off" && <Text style={styles.note}>{tr("Location-based air quality and alerts are off. Turn them on in About you.")}</Text>}
            {conditions.status === "loading" && <Text style={styles.note}>{tr("Checking...")}</Text>}
            {conditions.status === "no-location" && <Text style={styles.note}>{tr("Couldn't get a location fix right now -- check permission in your device settings, then pull to refresh.")}</Text>}
            {conditions.status === "ready" && (
              <>
                {conditions.airQuality?.classification ? (
                  <View>
                    <Text style={[styles.tipText, { color: conditions.airQuality.classification.color }]}>
                      {tr("{category} (AQI ~{aqi_estimate})", { category: tr(conditions.airQuality.classification.category), aqi_estimate: conditions.airQuality.classification.aqi_estimate })}
                    </Text>
                    <Text style={styles.note}>{tr("PM2.5 {pm2_5} µg/m³ · PM10 {pm10} µg/m³", { pm2_5: conditions.airQuality.pm2_5, pm10: conditions.airQuality.pm10 })}</Text>
                    <Text style={[styles.note, { marginTop: 4 }]}>{tr(conditions.airQuality.classification.guidance)}</Text>
                  </View>
                ) : (
                  <Text style={styles.note}>{tr("Air quality data isn't available right now.")}</Text>
                )}
                {conditions.alerts.map((a) => (
                  <View key={a.id} style={styles.alertRow}>
                    <Collapsible title={a.event} icon={"\u26a0\ufe0f"} teaser={a.headline}>
                      <Text style={styles.note}>{a.description}</Text>
                    </Collapsible>
                  </View>
                ))}
              </>
            )}
          </View>,
          <View key="consider">
            <Text style={styles.pageTitle}>{tr("Worth considering")}</Text>
            {digest.healthyBehaviorsToConsider.length === 0 ? (
              <Text style={styles.note}>{tr("You've logged every \"adding good\" category this week -- nothing new to suggest.")}</Text>
            ) : (
              <Text style={styles.note}>{tr("Not logged yet this week: {items}. These are additions, not corrections -- add them from Daily whenever they happen.", { items: digest.healthyBehaviorsToConsider.map((b) => tr(b.label)).join(", ") })}</Text>
            )}
          </View>,
          ...(digest.mattersMoreForYou.length > 0
            ? [
                <View key="personal">
                  <Text style={styles.pageTitle}>{tr("Matters more for you")}</Text>
                  {digest.mattersMoreForYou.map((m) => (
                    <View key={m.substanceId} style={{ marginBottom: 10 }}>
                      <Text style={styles.tipText}>{tr(m.name)}</Text>
                      <Text style={styles.from}>{m.from.map((f) => tr(FROM_LABEL[f])).join(" · ")}</Text>
                      {m.reasons.map((r) => (
                        <Text key={`${r.conceptTag}:${r.label}`} style={[styles.note, { marginTop: 2 }]}>
                          <Text style={styles.reasonLabel}>{tr(r.label)}: </Text>
                          {tr(r.reason)}
                        </Text>
                      ))}
                    </View>
                  ))}
                  <Text style={[styles.note, { fontStyle: "italic" }]}>{tr("From what you shared under About you. It changes what is explained first, never a score.")}</Text>
                </View>,
              ]
            : []),
          <View key="topic">
            <Text style={styles.pageTitle}>{tr("This week's topic")}</Text>
            <Text style={styles.tipText}>{tr(digest.educationTopic.title)}</Text>
            <Text style={styles.from}>{tr(digest.educationTopic.why)}</Text>
            {digest.educationTopic.personal.map((r) => (
              <Text key={r.label} style={[styles.note, { marginTop: 6 }]}>
                <Text style={styles.reasonLabel}>{tr("Why it matters more for you ({label}):", { label: tr(r.label) })}{" "}</Text>
                {tr(r.reason)}
              </Text>
            ))}
            <Text style={[styles.note, { marginTop: 8 }]}>{tr(digest.educationTopic.text)}</Text>
            {level !== "simple" && (
              <View style={{ marginTop: 8 }}>
                <Collapsible title={tr("Go deeper (mechanism / technical)")} defaultOpen={level === "technical"}>
                  <Text style={styles.note}>{tr(digest.educationTopic.technical)}</Text>
                </Collapsible>
              </View>
            )}
          </View>,
          <View key="self">
            <Text style={styles.pageTitle}>{tr("Self-assessment")}</Text>
            <Text style={styles.note}>{tr(digest.selfAssessment.message)}</Text>
            <Text style={[styles.note, { marginTop: 8, fontStyle: "italic" }]}>{tr("Log a reading from Your Journey › Biomarkers whenever you have one.")}</Text>
          </View>,
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  indicatorLabel: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  tipText: { fontSize: 15, fontWeight: "600", color: colors.ink },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  dayRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 8 },
  dayLabel: { width: 52 },
  dayName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  dayMood: { fontSize: 15, marginTop: 2 },
  dayLine: { fontSize: 13, color: colors.ink, lineHeight: 18 },
  dayNums: { fontSize: 12, color: colors.muted, marginTop: 2 },
  dayEmpty: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  pageTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  from: { fontSize: 12, color: colors.muted, fontStyle: "italic", marginTop: 2 },
  reasonLabel: { fontWeight: "700", color: colors.ink },
  alertRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 8 },
});
