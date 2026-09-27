import React, { useState } from "react";
import { ScrollView, View, Text, Pressable, Share, StyleSheet } from "react-native";
import { TIER_INFO, TOOL_INFO, type Lesson, type ToolId } from "../../data/curriculum";
import { evidenceById } from "../../engine/evidence";
import { PrimaryButton, SecondaryButton } from "../../components/ui";
import { ConceptCheckRunner } from "../../components/ConceptCheckRunner";
import { wrapUp } from "../../engine/learningChecks";
import type { ConceptCheck } from "../../data/conceptChecks";
import { colors, radius, radiusSm, shadow } from "../../theme";

/** One idea per screen: the point, the misleading pattern to watch for, and a conversation to have. */
export default function LessonView({
  lesson,
  completed,
  onComplete,
  onBack,
  onOpenTool,
  onOpenEvidence,
  checks = [],
  onCheckAnswer,
}: {
  lesson: Lesson;
  completed: boolean;
  onComplete: () => void;
  onBack: () => void;
  onOpenTool: (t: ToolId) => void;
  onOpenEvidence: (id: string) => void;
  /** the questions that follow this lesson, and where each answer is recorded */
  checks?: ConceptCheck[];
  onCheckAnswer?: (check: ConceptCheck, correct: boolean) => void | Promise<unknown>;
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [summary, setSummary] = useState<{ right: number; total: number } | null>(null);
  const share = () =>
    Share.share({ message: `${lesson.title}\n\n${lesson.headline}\n\nWatch for: ${lesson.watchFor}\n\nWorth talking about: ${lesson.talkAbout}` });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={{ marginBottom: 14, paddingVertical: 8 }}>
        <Text style={styles.back}>{"‹"} Engine</Text>
      </Pressable>
      <Text style={styles.kicker}>{TIER_INFO[lesson.tier].label.toUpperCase()} {"·"} LESSON</Text>
      <Text accessibilityRole="header" style={styles.title}>{lesson.title}</Text>
      <Text style={styles.headline}>{lesson.headline}</Text>
      {lesson.body.map((p, i) => (
        <Text key={i} style={styles.body}>{p}</Text>
      ))}

      <View style={styles.watch}>
        <Text style={styles.watchLabel}>WATCH FOR</Text>
        <Text style={styles.watchText}>{lesson.watchFor}</Text>
      </View>

      <View style={styles.talk}>
        <Text style={styles.talkLabel}>TALK ABOUT IT</Text>
        <Text style={styles.talkText}>{lesson.talkAbout}</Text>
        <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
          <SecondaryButton title="Share with someone" onPress={share} />
        </View>
      </View>

      {lesson.tool && (
        <View style={{ marginTop: 16 }}>
          <PrimaryButton title={`Try it: ${TOOL_INFO[lesson.tool].title}`} onPress={() => onOpenTool(lesson.tool!)} />
        </View>
      )}

      {lesson.evidenceIds && lesson.evidenceIds.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={styles.sectionLabel}>The research behind this</Text>
          {lesson.evidenceIds.map((id) => {
            const e = evidenceById(id);
            return e ? (
              <Pressable accessibilityRole="button" key={id} onPress={() => onOpenEvidence(id)} style={styles.evidence}>
                <Text style={styles.evidenceHeadline}>{e.headline}</Text>
                <Text style={styles.evidenceMeta}>{e.journal} {e.year} {"·"} read the summary {"›"}</Text>
              </Pressable>
            ) : null;
          })}
        </View>
      )}

      {checks.length > 0 && onCheckAnswer && (
        <View style={styles.check}>
          <Text style={styles.checkLabel}>CHECK WHAT STUCK</Text>
          {phase === "idle" && (
            <>
              <Text style={styles.checkText}>{checks.length} quick question{checks.length === 1 ? "" : "s"} on this lesson. Nothing is scored against you: a miss just brings the question back tomorrow, and each one you get right comes back further apart.</Text>
              <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                <SecondaryButton title="Try the questions" onPress={() => setPhase("running")} />
              </View>
            </>
          )}
          {phase === "running" && (
            <View style={{ marginTop: 10 }}>
              <ConceptCheckRunner
                checks={checks}
                onAnswer={onCheckAnswer}
                kickerFor={() => "ON THIS LESSON"}
                onDone={(results) => {
                  setSummary({ right: results.filter((r) => r.correct).length, total: results.length });
                  setPhase("done");
                }}
              />
            </View>
          )}
          {phase === "done" && summary && (
            <Text style={styles.checkText}>{wrapUp(summary.right, summary.total)}</Text>
          )}
        </View>
      )}

      <View style={{ marginTop: 24, marginBottom: 28 }}>
        {completed ? <Text style={styles.done}>{"✓"} Lesson complete</Text> : <PrimaryButton title="Got it" onPress={onComplete} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, marginTop: 8, lineHeight: 33 },
  headline: { fontSize: 17, color: colors.ink, lineHeight: 25, marginTop: 12, fontWeight: "600" },
  body: { fontSize: 15, color: colors.ink, lineHeight: 23, marginTop: 12 },
  watch: { backgroundColor: colors.warnSoft, borderRadius: radius, padding: 16, marginTop: 20 },
  watchLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.warn },
  watchText: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 6 },
  talk: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: 16, marginTop: 12 },
  talkLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  talkText: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 6 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginBottom: 8 },
  evidence: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 14, marginBottom: 8, ...shadow },
  evidenceHeadline: { fontSize: 14, fontWeight: "700", color: colors.ink, lineHeight: 20 },
  evidenceMeta: { fontSize: 12, color: colors.muted, marginTop: 6 },
  done: { fontSize: 15, fontWeight: "700", color: colors.accent, textAlign: "center" },
  check: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: 16, marginTop: 20 },
  checkLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.accent },
  checkText: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 6 },
});
