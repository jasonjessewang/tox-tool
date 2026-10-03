import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import * as db from "../../storage/db";
import { scoreLogs, loadHazardDb, loadConcepts } from "../../engine/scoring";
import { loadEvidence } from "../../engine/evidence";
import { getLiteratureStatus } from "../../services/pubmed";
import { getPlant } from "../../engine/plantState";
import { getAdviceInputs } from "../../engine/adviceState";
import { computeEngineHealth, type EngineHealth } from "../../engine/science/engineHealth";
import { Collapsible } from "../../components/Collapsible";
import { ToolHeader, cardStyle } from "./viz";
import { buildLedger } from "../../engine/ingredients/ledger";
import { colors, bandColor } from "../../theme";
import { daysAgoISO as daysAgo, daysBetweenISO, todayISO } from "../../util/dates";
import { msg, tr, trn, longDate } from "../../i18n";

interface Live {
  health: EngineHealth;
  counts: { label: string; n: number }[];
  flagged: number;
  topConcepts: { name: string; n: number }[];
  bandLabel: string;
  bandKey: string;
  focus: number;
  quick: number;
  plantStage: string;
  evidenceCount: number;
  newestYear: number | null;
  literature: { fetchedAt: number | null; count: number };
  shelf: { items: number; substances: number; foods: number };
}

function Stage({ n, title, sub, children }: { n: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={[cardStyle, { marginTop: 0 }]}>
        <View style={styles.stageHead}>
          <Text style={styles.stageNum}>{n}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.stageTitle}>{title}</Text>
            <Text style={styles.stageSub}>{sub}</Text>
          </View>
        </View>
        {children}
      </View>
      <Text style={styles.arrow}>{"▼"}</Text>
    </View>
  );
}

export default function EngineRoom({ onBack }: { onBack: () => void }) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    (async () => {
      const logs = await db.getLogsForRange(daysAgo(6), todayISO());
      const report = scoreLogs(logs, undefined, await db.getCompletedActionKeys(daysAgo(13)), await getAdviceInputs());
      const profile = await db.getUserProfile();
      const biomarkers = await db.getBiomarkerLogs(1);
      const learning = new Set(await db.getLearningDates(daysAgo(6)));
      const plant = (await getPlant()).plant;
      const evidence = loadEvidence();
      const substancesById = Object.fromEntries(loadHazardDb().map((s) => [s.id, s]));
      const concepts = loadConcepts();
      const shelfItems = await db.getShelfItems(true);

      const dates = new Set<string>([...logs.food, ...logs.products, ...logs.environment, ...logs.air_quality, ...logs.practices].map((e) => e.log_date));
      const types = [logs.food, logs.products, logs.environment, logs.air_quality, logs.practices].filter((a) => a.length > 0).length;
      const bio = biomarkers[0] ? Math.max(0, daysBetweenISO(biomarkers[0].log_date, todayISO())) : null;
      const filled = profile ? [profile.ageYears !== null, profile.sex !== null, profile.weightKg !== null, profile.conditions.length > 0].filter(Boolean).length : 0;
      const newest = evidence.length ? Math.max(...evidence.map((e) => e.year)) : null;

      const tagCounts: Record<string, number> = {};
      for (const c of Object.values(report.category_summary)) {
        for (const h of c?.substances ?? []) for (const t of substancesById[h.id]?.concept_tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + h.count;
      }

      setLive({
        health: computeEngineHealth({ daysLoggedThisWeek: dates.size, inputTypesThisWeek: types, daysSinceBiomarker: bio, learningDaysLast7: learning.size, profileFieldsFilled: filled, evidenceItems: evidence.length, evidenceNewestYear: newest }),
        counts: [
          { label: msg("Meals"), n: logs.food.length },
          { label: msg("Products"), n: logs.products.length },
          { label: msg("Environment"), n: logs.environment.length },
          { label: msg("Air readings"), n: logs.air_quality.length },
          { label: msg("Resets"), n: logs.practices.length },
        ],
        flagged: Object.values(report.category_summary).reduce((s, c) => s + (c?.substances.length ?? 0), 0),
        topConcepts: Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ name: concepts[id]?.name ?? id, n })),
        bandLabel: report.awareness_band.label,
        bandKey: report.awareness_band.key,
        focus: report.focus_items.length,
        quick: report.quick_wins.length,
        plantStage: plant.stageLabel,
        evidenceCount: evidence.length,
        newestYear: newest,
        literature: await getLiteratureStatus(),
        shelf: (() => {
          const l = buildLedger(shelfItems);
          return { items: l.itemCount, substances: l.substances.length, foods: l.foodCount };
        })(),
      });
    })();
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Your engine, running")} blurb={tr("What goes in, what happens to it, and what comes out -- live from your own data. Nothing here is hidden.")} onBack={onBack} />
      {!live ? (
        <Text style={styles.note}>{tr("Reading your engine...")}</Text>
      ) : (
        <>
          <View style={[cardStyle, { marginTop: 0, borderColor: colors.accent }]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.kicker}>{tr("ENGINE CONFIDENCE")}</Text>
                <Text style={styles.bigNum}>{live.health.overall}<Text style={styles.bigUnit}>/100</Text></Text>
              </View>
              <Text style={[styles.badge, { color: colors.accent }]}>{tr(live.health.label)}</Text>
            </View>
            <Text style={styles.note}>{tr("How much your engine has to work with -- not a judgement of you.")}</Text>
            {live.health.components.map((c) => (
              <View key={c.key} style={{ marginTop: 10 }}>
                <Collapsible title={tr(c.label)} teaser={tr(c.detail)}>
                  <Text style={styles.note}>{tr(c.improve)}</Text>
                </Collapsible>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(c.score * 100)}%`, backgroundColor: c.score >= 0.75 ? colors.accent : c.score >= 0.4 ? colors.warn : colors.vizLow }]} />
                </View>
              </View>
            ))}
          </View>

          <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("How data flows")}</Text>
          <Stage n="1" title={tr("Inputs")} sub={tr("Everything you log or scan, last 7 days")}>
            <View style={styles.chips}>
              {live.counts.map((c) => (
                <Text key={c.label} style={[styles.chip, c.n > 0 && styles.chipOn]}>{tr(c.label)} {c.n}</Text>
              ))}
            </View>
          </Stage>
          <Stage n="2" title={tr("Matching")} sub={tr("Ingredient and item names matched against the hazard database")}>
            <Text style={styles.line}><Text style={styles.strong}>{live.flagged}</Text>{" "}{tr("substances matched in this week's logs.")}</Text>
            <Text style={styles.line}><Text style={styles.strong}>{live.shelf.items}</Text>{" "}{tr("shelf products →")}{" "}<Text style={styles.strong}>{live.shelf.substances}</Text>{" "}{tr("flagged ingredients, tracked as frequency (see My shelf).")}</Text>
            {live.topConcepts.length > 0 ? (
              <Text style={styles.note}>{tr("Most common science behind them: {names}.", { names: live.topConcepts.map((c) => tr(c.name)).join(", ") })}</Text>
            ) : (
              <Text style={styles.note}>{tr("Nothing matched -- either nothing was logged, or nothing in it is in the database.")}</Text>
            )}
          </Stage>
          <Stage n="3" title={tr("Scoring")} sub={tr("Directional, not a dose calculation")}>
            <Text style={styles.line}>{tr("Awareness level:")}{" "}<Text style={[styles.strong, { color: bandColor[live.bandKey] }]}>{tr(live.bandLabel)}</Text></Text>
            <Text style={styles.note}>{tr("Each matched substance carries a coarse concern level. The score shows where your pattern concentrates. It does not measure how much of anything you were exposed to.")}</Text>
          </Stage>
          <View style={[cardStyle, { marginTop: 0 }]}>
            <View style={styles.stageHead}>
              <Text style={styles.stageNum}>4</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stageTitle}>{tr("Outputs")}</Text>
                <Text style={styles.stageSub}>{tr("What the engine gives back")}</Text>
              </View>
            </View>
            <Text style={styles.line}>{trn(live.focus, "{n} focus item", "{n} focus items")} · {trn(live.quick, "{n} quick win", "{n} quick wins")}</Text>
            <Text style={styles.line}>{tr("Plant: {stage}", { stage: tr(live.plantStage) })}</Text>
            <Text style={styles.note}>{tr("Plus your weekly digest and trends -- all recomputed each time you open the app.")}</Text>
          </View>

          <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("What the engine doesn't do")}</Text>
          <View style={[cardStyle, { marginTop: 0 }]}>
            {[
              msg("Model your actual dose. It matches what you log; it doesn't know how much you were exposed to."),
              msg("Diagnose anything or predict your personal risk."),
              msg("Replace a clinician -- it helps you ask better questions of one."),
              msg("Understand a product it can't match by name. Unmatched isn't the same as safe."),
            ].map((t, i) => (
              <Text key={i} style={styles.bullet}>{"•"} {tr(t)}</Text>
            ))}
          </View>

          <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("How it stays current")}</Text>
          <View style={[cardStyle, { marginTop: 0 }]}>
            <Text style={styles.line}><Text style={styles.strong}>{live.evidenceCount}</Text>{" "}{tr("reviewed evidence summaries, newest from")}{" "}{live.newestYear ?? tr("n/a")}.</Text>
            <Text style={styles.line}>{tr("Literature feed:")}{" "}{live.literature.fetchedAt ? tr("refreshed {date}", { date: longDate(new Date(live.literature.fetchedAt)) }) : tr("using bundled records")}{" "}{tr("({count} titles).", { count: live.literature.count })}</Text>
            <Text style={styles.note}>{tr("The pipeline: PubMed and citation counts are pulled in, new papers wait for a reviewed summary, and only reviewed summaries are published as Research. Separately, each topic page lists PubMed citations for its subject: those are matched to the topic by title (and hand-picked where a search wandered), but are not each read and summarized -- treat them as pointers to the literature, not as reviewed findings.")}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  bigNum: { fontSize: 44, fontWeight: "700", color: colors.ink },
  bigUnit: { fontSize: 16, color: colors.muted, fontWeight: "400" },
  badge: { fontSize: 15, fontWeight: "700" },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, marginTop: 4, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  section: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 24, marginBottom: 10 },
  stageHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  stageNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentFill, color: colors.onAccent, textAlign: "center", lineHeight: 26, fontWeight: "700", overflow: "hidden" },
  stageTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  stageSub: { fontSize: 12, color: colors.muted },
  arrow: { textAlign: "center", color: colors.muted, fontSize: 14, marginVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { fontSize: 12, fontWeight: "600", color: colors.muted, backgroundColor: colors.track, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden" },
  chipOn: { color: colors.accent, backgroundColor: colors.accentSoft },
  line: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 2 },
  strong: { fontWeight: "700" },
  bullet: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 6 },
});
