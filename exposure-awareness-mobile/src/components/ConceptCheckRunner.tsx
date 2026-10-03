import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ConceptCheckCard } from "./ConceptCheckCard";
import { PrimaryButton } from "./ui";
import { colors } from "../theme";
import type { ConceptCheck } from "../data/conceptChecks";
import { anyLessonById } from "../data/modules";
import { tr } from "../i18n";

/**
 * A short run of questions, one at a time. Each answer is recorded as it is given (so leaving half way loses nothing), and the run ends
 * with what stuck and what will come back -- never a grade.
 */
export function ConceptCheckRunner({
  checks,
  onAnswer,
  onDone,
  kickerFor,
  doneLabel = tr("Done"),
}: {
  checks: ConceptCheck[];
  onAnswer: (check: ConceptCheck, correct: boolean) => void | Promise<unknown>;
  onDone: (results: { check: ConceptCheck; correct: boolean }[]) => void;
  kickerFor?: (check: ConceptCheck) => string;
  doneLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<{ check: ConceptCheck; correct: boolean }[]>([]);
  const check = checks[index];
  const last = index === checks.length - 1;
  const title = (c: ConceptCheck) => tr(anyLessonById(c.lessonId)?.title ?? "");

  if (!check) return null;

  return (
    <View>
      {checks.length > 1 && <Text style={styles.count}>{tr("Question {index} of {total}", { index: index + 1, total: checks.length })}</Text>}
      <ConceptCheckCard
        key={check.id}
        check={check}
        kicker={kickerFor ? kickerFor(check) : tr("FROM \"{title}\"", { title: title(check).toUpperCase() })}
        onAnswered={(correct) => {
          setResults((r) => [...r, { check, correct }]);
          onAnswer(check, correct);
        }}
      >
        <View style={{ marginTop: 12 }}>
          <PrimaryButton title={last ? doneLabel : tr("Next question")} onPress={() => (last ? onDone(results) : setIndex(index + 1))} />
        </View>
      </ConceptCheckCard>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 12, color: colors.muted, fontWeight: "600", marginBottom: 6 },
});
