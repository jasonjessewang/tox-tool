import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { TIER_INFO, TOOL_INFO, lessonsInTier, curriculumRef, type Lesson, type ToolId, type Tier } from "../data/curriculum";
import { ALL_LESSONS, MODULE_INFO, anyLessonById, moduleLessonById } from "../data/modules";
import { getLiteracy } from "../engine/literacyState";
import { computeModules, type Literacy, type ModuleProgress } from "../engine/literacy";
import { colors, radius, radiusSm, shadow, shadowRaised } from "../theme";
import { PrimaryButton } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { EvidenceDetail } from "./EvidenceScreen";
import LessonView from "./engine/LessonView";
import EngineRoom from "./engine/EngineRoom";
import RiskTranslator from "./engine/RiskTranslator";
import DoseResponseExplorer from "./engine/DoseResponseExplorer";
import ThresholdBuilder from "./engine/ThresholdBuilder";
import EvidenceLadder from "./engine/EvidenceLadder";
import ConfoundingLab from "./engine/ConfoundingLab";
import { todayISO as today } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { ConceptCheckRunner } from "../components/ConceptCheckRunner";
import { answerConceptCheck, getRecallState, type RecallState } from "../engine/learningChecksState";
import { questionsFor } from "../engine/learningChecks";
import type { ConceptCheck } from "../data/conceptChecks";
import { tr, trn, listWords } from "../i18n";

type View_ =
  | { type: "home" }
  | { type: "room" }
  | { type: "review" }
  | { type: "lesson"; id: string }
  | { type: "tool"; id: ToolId }
  | { type: "evidence"; id: string; from: string };

const TOOL_ORDER: ToolId[] = ["risk_translator", "dose_response", "thresholds", "evidence_ladder", "confounding_lab"];

export default function EngineScreen({ onDetailChange }: { onDetailChange?: (open: boolean) => void }) {
  const [view, setView] = useState<View_>({ type: "home" });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [literacy, setLiteracy] = useState<Literacy | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<ModuleProgress[]>([]);
  const [recall, setRecall] = useState<RecallState | null>(null);
  // The questions of a review are fixed when it starts, so nothing swaps in under the person's thumb as answers are recorded.
  const [reviewSet, setReviewSet] = useState<ConceptCheck[]>([]);

  const load = useCallback(async () => {
    const l = await getLiteracy();
    setLiteracy(l);
    setRecall(await getRecallState());
    const refs = new Set(await db.getLearningRefs("curriculum:"));
    const read = new Set(ALL_LESSONS.filter((x) => refs.has(curriculumRef(x.id))).map((x) => x.id));
    setDone(read);
    setModules(computeModules(read));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function go(v: View_) {
    setView(v);
    onDetailChange?.(v.type !== "home");
    if (v.type === "home") load();
    if (v.type === "tool") db.recordLearning(`tool:${v.id}`, today());
  }

  async function complete(lesson: Lesson) {
    const { receipt: r } = await runActivity("learning", () => db.recordLearning(curriculumRef(lesson.id), today()));
    setReceipt(r);
    await load();
    go({ type: "home" });
  }

  if (view.type === "room") return <EngineRoom onBack={() => go({ type: "home" })} />;

  if (view.type === "review") {
    const due = reviewSet;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => go({ type: "home" })} hitSlop={8} style={{ marginBottom: 12, paddingVertical: 8 }}>
          <Text style={styles.back}>{tr("‹ Engine")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.reviewTitle}>{tr("A quick review")}</Text>
        <Text style={styles.reviewSub}>{tr("Ideas you've read, brought back a little later. A miss just brings the question back tomorrow; each one you get right comes back further apart.")}</Text>
        {due.length === 0 ? (
          <Text style={styles.status}>{tr("Nothing is due right now. Check back in a day or two.")}</Text>
        ) : (
          <ConceptCheckRunner checks={due} onAnswer={async (c, ok) => setReceipt(await answerConceptCheck(c.id, ok))} onDone={() => go({ type: "home" })} doneLabel={tr("Back to the Engine")} />
        )}
      </ScrollView>
    );
  }

  if (view.type === "tool") {
    const back = () => go({ type: "home" });
    if (view.id === "risk_translator") return <RiskTranslator onBack={back} />;
    if (view.id === "dose_response") return <DoseResponseExplorer onBack={back} />;
    if (view.id === "thresholds") return <ThresholdBuilder onBack={back} />;
    if (view.id === "evidence_ladder") return <EvidenceLadder onBack={back} />;
    return <ConfoundingLab onBack={back} />;
  }

  if (view.type === "evidence") return <EvidenceDetail id={view.id} onBack={() => go({ type: "lesson", id: view.from })} />;

  if (view.type === "lesson") {
    const lesson = anyLessonById(view.id)!;
    const elective = moduleLessonById(view.id);
    return (
      <LessonView
        lesson={lesson}
        kicker={elective ? tr("{title} · Elective", { title: tr(MODULE_INFO[elective.module].title) }) : undefined}
        completed={done.has(lesson.id)}
        onComplete={() => complete(lesson)}
        checks={questionsFor(lesson.id)}
        onCheckAnswer={async (c, ok) => setReceipt(await answerConceptCheck(c.id, ok))}
        onBack={() => go({ type: "home" })}
        onOpenTool={(t) => go({ type: "tool", id: t })}
        onOpenEvidence={(id) => go({ type: "evidence", id, from: lesson.id })}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      {receipt && <ReceiptCard receipt={receipt} />}
      {literacy && (
        <View style={styles.card}>
          <Text style={styles.kicker}>{tr("YOUR TOXICOLOGY LITERACY")}</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.tier}>{tr(TIER_INFO[literacy.tier].label)}</Text>
            <Text style={styles.pct}>{literacy.doneCount}/{literacy.totalCount}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${literacy.pct}%` }]} />
          </View>
          <Text style={styles.status}>{tr(literacy.status)}</Text>
          {literacy.next && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.nextLabel}>{tr("NEXT LESSON")}</Text>
              <Text style={styles.nextTitle}>{tr(literacy.next.title)}</Text>
              <View style={{ marginTop: 10 }}>
                <PrimaryButton title={tr("Start")} onPress={() => go({ type: "lesson", id: literacy.next!.id })} />
              </View>
            </View>
          )}
        </View>
      )}

      {recall && recall.recall.available > 0 && (
        <View style={[styles.card, { marginTop: 14 }]}>
          <Text style={styles.kicker}>{tr("RECALL")}</Text>
          <Text style={styles.recallTitle}>
            {recall.next.length > 0 ? trn(recall.next.length, "A quick review: {n} question", "A quick review: {n} questions") : tr("Nothing due right now")}
          </Text>
          <Text style={styles.status}>
            {recall.recall.due + recall.recall.unanswered > recall.next.length ? tr("{due} more whenever you want them. ", { due: recall.recall.due + recall.recall.unanswered - recall.next.length }) : ""}
            {tr("{recalled} of {available} questions on the lessons you've read answered right at least once.", { recalled: recall.recall.recalled, available: recall.recall.available })}
            {recall.next.length === 0 ? tr(" Ideas you've checked come back on their own, further apart each time you get one right.") : ""}
          </Text>
          {recall.next.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <PrimaryButton
                title={recall.recall.due > 0 ? tr("Review now") : tr("Try them")}
                onPress={() => {
                  setReviewSet(recall.next.map((n) => n.check));
                  go({ type: "review" });
                }}
              />
            </View>
          )}
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={() => go({ type: "room" })} style={({ pressed }) => [styles.room, pressed && { opacity: 0.85 }]}>
        <Text style={styles.roomKicker}>{tr("BEHIND THE CURTAIN")}</Text>
        <Text style={styles.roomTitle}>{tr("See your engine run")}</Text>
        <Text style={styles.roomBlurb}>{tr("Inputs, matching, scoring and outputs -- live from your data, with what the engine can't do.")}</Text>
      </Pressable>

      <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("Tools")}</Text>
      <View style={styles.grid}>
        {TOOL_ORDER.map((id) => (
          <Pressable accessibilityRole="button" key={id} onPress={() => go({ type: "tool", id })} style={({ pressed }) => [styles.tool, pressed && { opacity: 0.7 }]}>
            <Text style={styles.toolIcon}>{TOOL_INFO[id].icon}</Text>
            <Text style={styles.toolTitle}>{tr(TOOL_INFO[id].title)}</Text>
            <Text style={styles.toolBlurb}>{tr(TOOL_INFO[id].blurb)}</Text>
          </Pressable>
        ))}
      </View>

      <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("Curriculum")}</Text>
      {([1, 2, 3] as Tier[]).map((tier) => {
        const tp = literacy?.tiers[tier - 1];
        const unlocked = tp?.unlocked ?? tier === 1;
        return (
          <View key={tier} style={[styles.tierCard, !unlocked && { opacity: 0.55 }]}>
            <Collapsible
              title={`${unlocked ? "" : "🔒 "}${tr(TIER_INFO[tier].label)}`}
              teaser={unlocked ? tr("{done}/{total} done · {blurb}", { done: tp?.done ?? 0, total: lessonsInTier(tier).length, blurb: tr(TIER_INFO[tier].blurb) }) : tr("Finish most of {label} to unlock", { label: tr(TIER_INFO[(tier - 1) as Tier].label) })}
              defaultOpen={tier === 1}
            >
              {lessonsInTier(tier).map((l) => (
                <Pressable accessibilityRole="button" key={l.id} disabled={!unlocked} onPress={() => go({ type: "lesson", id: l.id })} style={styles.lessonRow}>
                  <Text style={[styles.mark, done.has(l.id) && { color: colors.accent }]}>{done.has(l.id) ? "✓" : "○"}</Text>
                  <Text style={styles.lessonTitle}>{tr(l.title)}</Text>
                </Pressable>
              ))}
            </Collapsible>
          </View>
        );
      })}

      <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("Go deeper")}</Text>
      <Text style={styles.sectionNote}>{tr("Electives, in any order. Each opens once the lesson it builds on is read, adds a little to Understanding, and never counts against the curriculum above.")}</Text>
      {modules.map((m) => (
        <View key={m.module} style={styles.tierCard}>
          <Collapsible title={`${m.icon} ${tr(m.title)}`} teaser={tr("{done}/{total} read · {blurb}", { done: m.done, total: m.total, blurb: tr(m.blurb) })}>
            {m.lessons.map(({ lesson, done: read, open, readFirst, start }) => (
              <View key={lesson.id} style={styles.electiveRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={open ? undefined : tr("{title}, opens after {lessons}", { title: tr(lesson.title), lessons: listWords(readFirst.map((l) => tr(l.title))) })}
                  disabled={!open}
                  aria-disabled={!open}
                  onPress={() => go({ type: "lesson", id: lesson.id })}
                  style={[styles.lessonRowFlat, !open && { opacity: 0.55 }]}
                >
                  <Text aria-hidden style={[styles.mark, read && { color: colors.accent }]}>{read ? "✓" : open ? "○" : "·"}</Text>
                  <Text style={styles.lessonTitle}>{tr(lesson.title)}</Text>
                </Pressable>
                {!open && start && (
                  <Pressable accessibilityRole="button" accessibilityLabel={tr("Read first: {title}", { title: tr(start.title) })} onPress={() => go({ type: "lesson", id: start.id })} hitSlop={6} style={styles.readFirst}>
                    <Text style={styles.readFirstText}>{tr("Read first: {title} ›", { title: tr(start.title) })}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </Collapsible>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 18, ...shadow },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 },
  tier: { fontSize: 24, fontWeight: "700", color: colors.ink },
  pct: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: 10, overflow: "hidden" },
  fill: { height: 8, backgroundColor: colors.accent },
  status: { fontSize: 13, color: colors.muted, marginTop: 8 },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  reviewTitle: { fontSize: 24, fontWeight: "700", color: colors.ink },
  reviewSub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  recallTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: 6 },
  nextLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 1 },
  nextTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: 4 },
  room: { backgroundColor: colors.inverseBg, borderRadius: radius, padding: 18, marginTop: 14, ...shadowRaised, shadowOpacity: 0.22 },
  roomKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.onInverseAccent },
  roomTitle: { fontSize: 22, fontWeight: "700", color: colors.onInverse, marginTop: 6 },
  roomBlurb: { fontSize: 13, color: colors.onInverseMuted, lineHeight: 19, marginTop: 6 },
  section: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 24, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tool: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 14, ...shadow },
  toolIcon: { fontSize: 24, color: colors.ink },
  toolTitle: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 6 },
  toolBlurb: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  tierCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 14, marginBottom: 10, ...shadow },
  lessonRow: { flexDirection: "row", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4 },
  mark: { fontSize: 15, color: colors.muted, width: 18 },
  lessonTitle: { flex: 1, fontSize: 14, color: colors.ink },
  sectionNote: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: -4, marginBottom: 10 },
  electiveRow: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4 },
  lessonRowFlat: { flexDirection: "row", gap: 10, paddingVertical: 9 },
  readFirst: { marginLeft: 28, marginTop: -4, paddingBottom: 8, alignSelf: "flex-start" },
  readFirstText: { fontSize: 12, fontWeight: "700", color: colors.accent },
});
