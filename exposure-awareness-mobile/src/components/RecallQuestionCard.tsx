import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { ConceptCheckCard } from "./ConceptCheckCard";
import { ReceiptCard } from "./ReceiptCard";
import { colors, radiusLg } from "../theme";
import type { ConceptCheck } from "../data/conceptChecks";
import { LESSONS } from "../data/curriculum";
import { answerConceptCheck, getRecallState } from "../engine/learningChecksState";
import type { Receipt } from "../engine/receipts";

/**
 * One question a day from lessons already read -- a due one first, then one not yet tried -- answered right where the day's learning
 * already is. A single card, no notification: an idea sticks when it is recalled a little later, not when it is nagged about, and
 * the rest of what is due waits in the Engine for whenever the person wants it.
 */
export function RecallQuestionCard() {
  // The question is fixed when the card first loads, so answering it does not swap in the next one under the person's thumb.
  const [pinned, setPinned] = useState<{ check: ConceptCheck; reason: "due" | "new" } | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [answeredEarlier, setAnsweredEarlier] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    getRecallState(new Date(), 3).then((s) => {
      if (!live) return;
      setAnsweredEarlier(s.answeredToday);
      setWaiting(Math.max(0, s.recall.due + s.recall.unanswered - (s.answeredToday ? 0 : 1)));
      if (!s.answeredToday && s.next[0]) setPinned(s.next[0]);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!loaded) return null;

  if (!pinned) {
    // Nothing read yet, or nothing due: say nothing. When something was answered today, say that is plenty.
    return answeredEarlier ? (
      <View style={styles.card}>
        <Text style={styles.kicker}>KEEPING IT FRESH</Text>
        <Text style={styles.text}>
          You checked in on an idea today. That is plenty for one day.
          {waiting > 0 ? " More are ready whenever you want them, under Learn › Engine." : ""}
        </Text>
      </View>
    ) : null;
  }

  const title = LESSONS.find((l) => l.id === pinned.check.lessonId)?.title ?? "";
  const kicker = pinned.reason === "due" ? `COMING BACK TO AN IDEA · ${title.toUpperCase()}` : `A QUESTION ON WHAT YOU READ · ${title.toUpperCase()}`;

  return (
    <View style={styles.card}>
      <ConceptCheckCard
        check={pinned.check}
        kicker={kicker}
        onAnswered={async (correct) => setReceipt(await answerConceptCheck(pinned.check.id, correct))}
      >
        {receipt && (
          <View style={{ marginTop: 12 }}>
            <ReceiptCard receipt={receipt} />
          </View>
        )}
        {waiting > 0 && <Text style={[styles.text, { marginTop: 4 }]}>More are ready whenever you want them, under Learn › Engine.</Text>}
      </ConceptCheckCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.accent, marginBottom: 8 },
  text: { fontSize: 13, color: colors.ink, lineHeight: 19, backgroundColor: colors.accentSoft, borderRadius: radiusLg, padding: 16 },
});
