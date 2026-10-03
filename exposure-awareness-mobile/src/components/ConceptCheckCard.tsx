import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radius, radiusSm } from "../theme";
import type { ConceptCheck } from "../data/conceptChecks";
import { tr } from "../i18n";

/**
 * One question: read it, choose, and see at once whether it landed and why. A wrong choice is answered with the idea, not a
 * verdict -- "not quite", the explanation, and the fact that the question comes back tomorrow. Nothing is scored against the person.
 */
export function ConceptCheckCard({
  check,
  kicker,
  onAnswered,
  children,
}: {
  check: ConceptCheck;
  kicker?: string;
  /** called once, with whether the choice was right, the moment the person chooses */
  onAnswered: (correct: boolean) => void;
  /** shown once answered: the way on (next question, done) */
  children?: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const correct = picked === check.answer;

  function choose(i: number) {
    if (answered) return;
    setPicked(i);
    onAnswered(i === check.answer);
  }

  return (
    <View style={styles.card}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text accessibilityRole="header" aria-level={2} style={styles.prompt}>{tr(check.prompt)}</Text>
      <View style={{ marginTop: 10 }} accessibilityRole="radiogroup">
        {check.options.map((option, i) => {
          const isAnswer = i === check.answer;
          const isPicked = picked === i;
          return (
            <Pressable
              key={i}
              accessibilityRole="radio"
              aria-checked={isPicked}
              aria-disabled={answered}
              onPress={() => choose(i)}
              style={[styles.option, isPicked && !answered && styles.optionOn, answered && isAnswer && styles.optionRight, answered && isPicked && !isAnswer && styles.optionMissed, answered && !isAnswer && !isPicked && styles.optionDim]}
            >
              <View style={[styles.radio, answered && isAnswer && styles.radioRight, answered && isPicked && !isAnswer && styles.radioMissed]} />
              <Text style={styles.optionText}>
                {answered && isAnswer ? "✓ " : ""}
                {tr(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {answered && (
        <View style={styles.feedback}>
          <View accessibilityRole="alert" aria-live="polite">
            <Text style={[styles.verdict, { color: correct ? colors.accent : colors.notice }]}>{correct ? tr("Right.") : tr("Not quite -- that's what practice is for. It comes back tomorrow.")}</Text>
            <Text style={styles.explain}>{tr(check.explain)}</Text>
          </View>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.accent, marginBottom: 6 },
  prompt: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 23 },
  option: { flexDirection: "row", alignItems: "flex-start", padding: 12, borderRadius: radiusSm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: 8 },
  optionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionRight: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  optionMissed: { borderColor: colors.notice, backgroundColor: colors.noticeSoft },
  optionDim: { opacity: 0.6 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.line, marginRight: 10, marginTop: 2 },
  radioRight: { borderColor: colors.accent, backgroundColor: colors.accent },
  radioMissed: { borderColor: colors.notice, backgroundColor: colors.notice },
  optionText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
  feedback: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  verdict: { fontSize: 14, fontWeight: "700" },
  explain: { fontSize: 13, color: colors.ink, lineHeight: 19, marginTop: 6 },
});
