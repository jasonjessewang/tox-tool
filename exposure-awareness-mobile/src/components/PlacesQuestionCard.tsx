import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCard } from "./CheckCard";
import { SecondaryButton } from "./ui";
import { colors, radiusLg } from "../theme";
import { checkById } from "../data/placeChecks";
import { answerCheck, clearAnswer, getPlacesOverview, type PlacesOverview } from "../engine/places/state";
import { householdNotes, peopleIn, readPlace } from "../engine/places/evaluate";
import { loadHazardDb } from "../engine/scoring";
import { runActivity, type Receipt } from "../engine/receipts";
import { todayISO } from "../util/dates";

/**
 * One question a day about the places a person spends their days in, answered right where they already check in -- so the
 * picture fills in a little at a time instead of as a fourteen-question form. One card, no notification: the research on
 * reminders is that each extra prompt makes the next one less welcome, so this asks once and stays out of the way.
 */
export function PlacesQuestionCard({ onOpenPlaces }: { onOpenPlaces?: () => void }) {
  const [overview, setOverview] = useState<PlacesOverview | null>(null);
  // The question is fixed when the card first loads, so answering it does not swap in the next one under the person's thumb.
  const [pinned, setPinned] = useState<{ placeId: string; checkId: string } | null>(null);
  const [answeredEarlier, setAnsweredEarlier] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const substances = useMemo(() => new Map(loadHazardDb().map((s) => [s.id, s])), []);

  async function load(first: boolean) {
    const o = await getPlacesOverview();
    setOverview(o);
    if (!first) return;
    const today = todayISO();
    const already = o.places.some((p) => Object.values(p.answers).some((list) => list.some((a) => a.day === today)));
    setAnsweredEarlier(already);
    if (o.next && !already) setPinned({ placeId: o.next.place.id, checkId: o.next.check.id });
  }

  useEffect(() => {
    load(true);
  }, []);

  if (!overview) return null;

  if (overview.places.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>WHERE DO YOU SPEND YOUR DAYS?</Text>
        <Text style={styles.text}>A few plain questions about home, work and everyday places, each compared with published guidance. One a day is plenty.</Text>
        {onOpenPlaces && (
          <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
            <SecondaryButton title="Set up my places" onPress={onOpenPlaces} />
          </View>
        )}
      </View>
    );
  }

  const place = pinned ? overview.places.find((p) => p.id === pinned.placeId) : undefined;
  const check = pinned ? checkById(pinned.checkId) : undefined;
  if (!pinned || !place || !check) {
    return answeredEarlier ? (
      <View style={styles.card}>
        <Text style={styles.kicker}>YOUR PLACES</Text>
        <Text style={styles.text}>You answered a question about your places today. That is plenty for one day.</Text>
      </View>
    ) : null;
  }

  const reading = readPlace(place, todayISO()).find((r) => r.checkId === check.id)!;
  const substance = substances.get(reading.status === "attention" ? reading.substanceId : check.substanceId);

  async function answer(value: string) {
    const { receipt: r } = await runActivity("place_check", () => (value === "" ? clearAnswer(place!.id, check!.id) : answerCheck(place!.id, check!.id, value)));
    setReceipt(r);
    await load(false);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>ONE QUESTION ABOUT {place.label.toUpperCase()}</Text>
      <CheckCard
        check={check}
        reading={reading}
        substance={substance}
        household={substance ? householdNotes(substance, peopleIn(place, overview.profile)) : []}
        receipt={receipt}
        defaultOpen
        onAnswer={answer}
        onClear={() => answer("")}
      />
      {onOpenPlaces && (
        <View style={{ alignSelf: "flex-start" }}>
          <SecondaryButton title="See all my places" onPress={onOpenPlaces} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderRadius: radiusLg, padding: 16, marginTop: 16 },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, color: colors.accent, marginBottom: 8 },
  text: { fontSize: 13, color: colors.ink, lineHeight: 19 },
});
