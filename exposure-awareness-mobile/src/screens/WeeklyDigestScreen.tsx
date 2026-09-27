import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet, RefreshControl } from "react-native";
import * as db from "../storage/db";
import { scoreLogs, loadHazardDb } from "../engine/scoring";
import { buildWeeklyDigest, type WeeklyDigest } from "../engine/weeklyDigest";
import { getAdviceInputs } from "../engine/adviceState";
import * as location from "../services/location";
import * as notify from "../notifications/notify";
import { fetchCurrentAirQuality, type AirQualitySnapshot } from "../services/airQuality";
import { fetchSignificantAlerts, type WeatherAlert } from "../services/weatherAlerts";
import { Card, SectionTitle, Subtitle } from "../components/ui";
import { buildWeekLog, type WeekLog } from "../engine/weekLog";
import LoadingScreen from "../components/LoadingScreen";
import { Carousel } from "../components/Carousel";
import { Collapsible } from "../components/Collapsible";
import { colors, bandColor } from "../theme";
import { daysAgoISO, todayISO } from "../util/dates";

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

  const load = useCallback(async () => {
    setLoading(true);
    const logs = await db.getLogsForRange(daysAgoISO(6), todayISO());
    const completedKeys = await db.getCompletedActionKeys(daysAgoISO(13));
    const report = scoreLogs(logs, undefined, completedKeys, await getAdviceInputs());
    const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));
    const biomarkers = await db.getBiomarkerLogs(20);
    setDigest(buildWeeklyDigest(report, substancesById, biomarkers));
    setWeekLog(
      buildWeekLog({
        logs,
        checkins: await db.getCheckInLogs(30),
        metrics: await db.getDailyMetrics(30),
        actions: await db.getCompletedActions(daysAgoISO(6)),
      })
    );

    const userProfile = await db.getUserProfile();

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

        const today = todayISO();
        const c = airQuality?.classification;
        if (c && c.concern_level >= 2 && (await db.shouldNotifyAqiToday(today))) {
          await notify.fireLocal(`${c.category} air quality near you`, c.guidance);
          await db.markAqiNotified(today);
        }
        const fresh = await db.getUnnotifiedAlertIds(alerts.map((a) => a.id));
        for (const alert of alerts.filter((a) => fresh.includes(a.id))) {
          await notify.fireLocal(alert.event, alert.headline);
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
      <LoadingScreen message="Analyzing your week" />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text accessibilityRole="header" style={styles.h1}>Weekly Digest</Text>
      <Subtitle>Where things stand, what's worth considering, and one thing to learn -- refreshed each visit.</Subtitle>

      <Card style={{ borderColor: bandColor[digest.indicator.key] }}>
        <Text style={[styles.indicatorLabel, { color: bandColor[digest.indicator.key] }]}>{digest.indicator.label}</Text>
        <Text style={styles.note}>{digest.indicator.description}</Text>
      </Card>

      {weekLog && (
        <>
          <SectionTitle>Your week, day by day</SectionTitle>
          <Card>
            <Text style={styles.tipText}>
              {weekLog.totals.daysActive}/7 days active {"\u00b7"} {weekLog.totals.checkIns} check-ins {"\u00b7"} {weekLog.totals.practices} practices {"\u00b7"} {weekLog.totals.actions} actions
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
                      {d.practices.length > 0 && <Text style={styles.dayLine}>Added: {d.practices.join(", ")}</Text>}
                      {d.actions > 0 && <Text style={styles.dayLine}>{d.actions} action{d.actions > 1 ? "s" : ""} completed</Text>}
                      {d.meals > 0 && <Text style={styles.dayLine}>{d.meals} meal{d.meals > 1 ? "s" : ""} logged</Text>}
                      {d.scans > 0 && <Text style={styles.dayLine}>{d.scans} product{d.scans > 1 ? "s" : ""} scanned</Text>}
                      {(d.calories !== null || d.activeMinutes !== null || d.screenHours !== null) && (
                        <Text style={styles.dayNums}>
                          {[d.calories !== null ? `${d.calories} kcal` : null, d.activeMinutes !== null ? `${d.activeMinutes} min active` : null, d.screenHours !== null ? `${d.screenHours} h screen` : null].filter(Boolean).join("  \u00b7  ")}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.dayEmpty}>Nothing logged</Text>
                  )}
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <Carousel
        icon={"\ud83d\udcc5"}
        title="This week's insights"
        pages={[
          <View key="cond">
            <Text style={styles.pageTitle}>Local conditions</Text>
            {conditions.status === "off" && <Text style={styles.note}>Location-based air quality and alerts are off. Turn them on in About you.</Text>}
            {conditions.status === "loading" && <Text style={styles.note}>Checking...</Text>}
            {conditions.status === "no-location" && <Text style={styles.note}>Couldn't get a location fix right now -- check permission in your device settings, then pull to refresh.</Text>}
            {conditions.status === "ready" && (
              <>
                {conditions.airQuality?.classification ? (
                  <View>
                    <Text style={[styles.tipText, { color: conditions.airQuality.classification.color }]}>
                      {conditions.airQuality.classification.category} (AQI ~{conditions.airQuality.classification.aqi_estimate})
                    </Text>
                    <Text style={styles.note}>PM2.5 {conditions.airQuality.pm2_5} {"\u00b5"}g/m{"\u00b3"} {"\u00b7"} PM10 {conditions.airQuality.pm10} {"\u00b5"}g/m{"\u00b3"}</Text>
                    <Text style={[styles.note, { marginTop: 4 }]}>{conditions.airQuality.classification.guidance}</Text>
                  </View>
                ) : (
                  <Text style={styles.note}>Air quality data isn't available right now.</Text>
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
            <Text style={styles.pageTitle}>Worth considering</Text>
            {digest.healthyBehaviorsToConsider.length === 0 ? (
              <Text style={styles.note}>You've logged every "adding good" category this week -- nothing new to suggest.</Text>
            ) : (
              <Text style={styles.note}>Not logged yet this week: {digest.healthyBehaviorsToConsider.map((b) => b.label).join(", ")}. These are additions, not corrections -- add them from Daily whenever they happen.</Text>
            )}
          </View>,
          <View key="topic">
            <Text style={styles.pageTitle}>This week's topic</Text>
            <Text style={styles.tipText}>{digest.educationTopic.title}</Text>
            <Text style={[styles.note, { marginTop: 6 }]}>{digest.educationTopic.text}</Text>
          </View>,
          <View key="self">
            <Text style={styles.pageTitle}>Self-assessment</Text>
            <Text style={styles.note}>{digest.selfAssessment.message}</Text>
            <Text style={[styles.note, { marginTop: 8, fontStyle: "italic" }]}>Log a reading from Your Journey {"\u203a"} Biomarkers whenever you have one.</Text>
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
  alertRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 8 },
});
