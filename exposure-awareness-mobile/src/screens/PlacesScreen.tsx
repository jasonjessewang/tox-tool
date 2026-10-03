import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { checksFor } from "../data/placeChecks";
import { addPlace, answerCheck, clearAnswer, getPlacesOverview, removeOccupant, removePlace, renamePlace, saveOccupant, setPlaceHours, type PlacesOverview } from "../engine/places/state";
import { countReadings, householdNotes, needsRecheck, peopleIn, placeHours, readPlace } from "../engine/places/evaluate";
import { PLACE_INFO, PLACE_KINDS, type Occupant, type Place, type PlaceKind } from "../engine/places/types";
import { loadHazardDb } from "../engine/scoring";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { CheckCard } from "../components/CheckCard";
import { HouseholdEditor } from "../components/HouseholdEditor";
import { Collapsible } from "../components/Collapsible";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { colors, radius, radiusPill, radiusSm, shadow } from "../theme";
import { todayISO } from "../util/dates";
import { msg, tr, trn } from "../i18n";

type Filter = "all" | "attention" | "unknown";

const NEXT_KICKER = { recheck: msg("YOU MARKED A TIP DONE -- HAS THIS CHANGED?"), stale: msg("WORTH A FRESH LOOK"), unanswered: msg("A GOOD NEXT QUESTION") };

export default function PlacesScreen({ onOpenScore }: { onOpenScore?: () => void }) {
  const [overview, setOverview] = useState<PlacesOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusCheck, setFocusCheck] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [adding, setAdding] = useState<{ kind: PlaceKind; label: string } | null>(null);
  const substances = useMemo(() => new Map(loadHazardDb().map((s) => [s.id, s])), []);

  const load = useCallback(async () => setOverview(await getPlacesOverview()), []);
  useEffect(() => {
    load();
  }, [load]);

  const remember = (key: string, receipt: Receipt) => setReceipts((r) => ({ ...r, [key]: receipt }));

  async function create(kind: PlaceKind, label?: string) {
    const place = await addPlace(kind, label);
    await load();
    setSelectedId(place.id);
    setAdding(null);
  }

  if (!overview) return <View style={styles.screen} />;
  const selected = overview.places.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return (
      <PlaceDetail
        place={selected}
        overview={overview}
        substances={substances}
        receipts={receipts}
        focusCheck={focusCheck}
        onBack={() => {
          setSelectedId(null);
          setFocusCheck(null);
        }}
        onChanged={load}
        remember={remember}
      />
    );
  }

  const { summary, next } = overview;
  const missing = PLACE_KINDS.filter((k) => !overview.places.some((p) => p.kind === k));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>{tr("Your places")}</Text>
      <Text style={styles.sub}>{tr("The spaces your days happen in. Each answer is compared with published guidance, so you can see what a small change would bring in line.")}</Text>

      {summary.compared > 0 && (
        <View style={styles.card}>
          <Text style={styles.kicker}>{tr("WHAT YOU HAVE COMPARED SO FAR")}</Text>
          <Text style={styles.big}>
            {summary.meets} <Text style={styles.bigOf}>{tr("of {compared} meet the reference", { compared: summary.compared })}</Text>
          </Text>
          {summary.attention > 0 ? (
            <Text style={styles.note}>
              {tr("Worth a look first: {items}.", { items: summary.worth.slice(0, 3).map((w) => `${tr(w.placeLabel)}: ${tr(w.short)}`).join("; ") })}
            </Text>
          ) : (
            <Text style={styles.note}>{tr("Everything you have compared meets its reference.")}</Text>
          )}
          {summary.unanswered > 0 && <Text style={styles.note}>{trn(summary.unanswered, "{n} more question would fill in the picture.", "{n} more questions would fill in the picture.")}</Text>}
          {onOpenScore && (
            <Pressable accessibilityRole="button" onPress={onOpenScore} style={{ marginTop: 8, paddingVertical: 8 }}>
              <Text style={styles.link}>{tr("See how this counts in your score ›")}</Text>
            </Pressable>
          )}
        </View>
      )}

      {next && (
        <View style={styles.nextCard}>
          <Text style={styles.nextKicker}>{tr(NEXT_KICKER[next.reason])} {"·"} {tr(next.place.label).toUpperCase()}</Text>
          <Text style={styles.nextTitle}>{tr(next.check.question)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setFocusCheck(next.check.id);
              setSelectedId(next.place.id);
            }}
            style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.nextButtonText}>{tr("Answer it ›")}</Text>
          </Pressable>
        </View>
      )}

      {overview.places.map((p) => {
        const c = countReadings(readPlace(p, todayISO()));
        const info = PLACE_INFO[p.kind];
        return (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => setSelectedId(p.id)} style={({ pressed }) => [styles.placeCard, pressed && { opacity: 0.9 }]}>
            <Text style={styles.icon}>{info.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeTitle}>{tr(p.label)}</Text>
              <Text style={styles.placeMeta}>
                {tr("About {hours} hours a week · {answered} of {total} answered", { hours: placeHours(p), answered: c.answered, total: c.total })}
              </Text>
              <Text style={styles.placeMeta}>
                {c.attention > 0 ? tr("{meets} meet the reference · {attention} worth a look", { meets: c.meets, attention: c.attention }) : c.meets > 0 ? tr("{meets} meet the reference", { meets: c.meets }) : tr("Nothing compared yet")}
              </Text>
              {p.occupants.length > 0 && <Text style={styles.placeMeta}>{tr("With {names}", { names: p.occupants.map((o) => tr(o.label)).join(", ") })}</Text>}
            </View>
            <Text style={styles.chevron}>{"›"}</Text>
          </Pressable>
        );
      })}

      {missing.map((kind) => (
        <View key={kind} style={[styles.placeCard, styles.placeEmpty]}>
          <Text style={styles.icon}>{PLACE_INFO[kind].icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.placeTitle}>{tr(PLACE_INFO[kind].label)}</Text>
            <Text style={styles.placeMeta}>{tr(PLACE_INFO[kind].blurb)}</Text>
            <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
              <SecondaryButton title={tr("Set up {label}", { label: tr(PLACE_INFO[kind].label).toLowerCase() })} onPress={() => create(kind)} />
            </View>
          </View>
        </View>
      ))}

      {adding ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>{tr("ANOTHER PLACE")}</Text>
          <View style={styles.chips}>
            {PLACE_KINDS.map((k) => (
              <Pressable key={k} accessibilityRole="radio" aria-checked={adding.kind === k} onPress={() => setAdding({ ...adding, kind: k })} style={[styles.chip, adding.kind === k && styles.chipOn]}>
                <Text style={[styles.chipText, adding.kind === k && { color: colors.accent, fontWeight: "700" }]}>{PLACE_INFO[k].icon} {tr(PLACE_INFO[k].label)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput style={styles.input} value={adding.label} onChangeText={(label) => setAdding({ ...adding, label })} accessibilityLabel={tr("Name for the new place")} placeholder={tr("Name it (e.g. Parents' house, the gym)")} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton title={tr("Add")} onPress={() => create(adding.kind, adding.label)} />
            <SecondaryButton title={tr("Cancel")} onPress={() => setAdding(null)} />
          </View>
        </View>
      ) : (
        overview.places.length > 0 && (
          <View style={{ alignSelf: "flex-start", marginBottom: 12 }}>
            <SecondaryButton title={tr("Add another place")} onPress={() => setAdding({ kind: "home", label: "" })} />
          </View>
        )
      )}

      <View style={styles.card}>
        <Collapsible title={tr("How places are read")} teaser={tr("Every answer is a comparison")}>
          <Text style={styles.note}>
            {tr("Each question is compared with a published reference: the US EPA (radon, lead, mold, indoor air), the WHO air-quality guideline, the US Surgeon General on secondhand smoke. Where no authority publishes a number, the check says it is this app's own curated guidance.")}
          </Text>
          <Text style={styles.note}>
            {tr("The hours you spend in a place set how much its findings count, and people who share it and for whom a finding matters more make it count a little more. Answers are dated and kept, so the score can be compared with an earlier you. Everything stays on this device.")}
          </Text>
        </Collapsible>
      </View>
    </ScrollView>
  );
}

function PlaceDetail({
  place,
  overview,
  substances,
  receipts,
  focusCheck,
  onBack,
  onChanged,
  remember,
}: {
  place: Place;
  overview: PlacesOverview;
  substances: Map<string, import("../engine/types").Substance>;
  receipts: Record<string, Receipt>;
  focusCheck: string | null;
  onBack: () => void;
  onChanged: () => Promise<void>;
  remember: (key: string, r: Receipt) => void;
}) {
  const info = PLACE_INFO[place.kind];
  const [filter, setFilter] = useState<Filter>("all");
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(tr(place.label));
  const [hoursText, setHoursText] = useState(String(placeHours(place)));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const readings = readPlace(place, todayISO());
  const counts = countReadings(readings);
  const people = peopleIn(place, overview.profile);
  const checks = checksFor(place.kind);
  const shown = checks.filter((c) => {
    const r = readings.find((x) => x.checkId === c.id)!;
    return filter === "all" || (filter === "attention" ? r.status === "attention" : r.status === "unknown");
  });

  async function answer(checkId: string, value: string) {
    const { receipt } = await runActivity("place_check", () => (value === "" ? clearAnswer(place.id, checkId) : answerCheck(place.id, checkId, value)));
    remember(`${place.id}:${checkId}`, receipt);
    await onChanged();
  }

  async function changeHours(hours: number | null) {
    const { receipt } = await runActivity("place_context", () => setPlaceHours(place.id, hours));
    remember(`${place.id}:hours`, receipt);
    setHoursText(String(hours ?? info.defaultHours));
    await onChanged();
  }

  async function saveOne(o: Occupant) {
    const { receipt } = await runActivity("place_context", () => saveOccupant(place.id, o));
    remember(`${place.id}:household`, receipt);
    await onChanged();
  }

  async function removeOne(id: string) {
    const { receipt } = await runActivity("place_context", () => removeOccupant(place.id, id));
    remember(`${place.id}:household`, receipt);
    await onChanged();
  }

  async function removeThis() {
    await runActivity("place_context", () => removePlace(place.id));
    await onChanged();
    onBack();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ paddingVertical: 8 }}>
        <Text style={styles.link}>{tr("‹ Your places")}</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={styles.iconBig}>{info.icon}</Text>
        {renaming ? (
          <TextInput
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel={tr("Name of this place")}
            value={label}
            onChangeText={setLabel}
            autoFocus
            onSubmitEditing={async () => {
              await renamePlace(place.id, label);
              setRenaming(false);
              await onChanged();
            }}
            onBlur={async () => {
              await renamePlace(place.id, label);
              setRenaming(false);
              await onChanged();
            }}
          />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setRenaming(true)} style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.h1}>{tr(place.label)}</Text>
            <Text style={styles.linkSmall}>{tr("Rename")}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.sub}>{tr(info.blurb)}</Text>

      <View style={styles.card}>
        <Text style={styles.kicker}>{tr("TIME HERE")}</Text>
        <Text style={styles.note}>{tr("About {hours} hours a week. More time here means what you find here counts for more.", { hours: placeHours(place) })}</Text>
        <View style={styles.chips}>
          {info.hourPresets.map((p) => (
            <Pressable key={p.hours} accessibilityRole="radio" aria-checked={placeHours(place) === p.hours} onPress={() => changeHours(p.hours)} style={[styles.chip, placeHours(place) === p.hours && styles.chipOn]}>
              <Text style={[styles.chipText, placeHours(place) === p.hours && { color: colors.accent, fontWeight: "700" }]}>
                {tr("{label} ({hours} h)", { label: tr(p.label), hours: p.hours })}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hoursRow}>
          <TextInput
            style={[styles.input, { width: 90 }]}
            value={hoursText}
            onChangeText={(t) => setHoursText(t.replace(/[^0-9]/g, ""))}
            onEndEditing={() => {
              const n = parseInt(hoursText, 10);
              if (Number.isFinite(n) && n !== placeHours(place)) changeHours(n);
            }}
            keyboardType="number-pad"
            accessibilityLabel={tr("Hours a week")}
          />
          <Text style={[styles.note, { marginLeft: 8 }]}>{tr("hours a week")}</Text>
        </View>
        {receipts[`${place.id}:hours`] && <ReceiptCard receipt={receipts[`${place.id}:hours`]} />}
      </View>

      {place.kind === "home" && (
        <View style={styles.card}>
          <Text style={styles.kicker}>{tr("WHO SHARES IT")}</Text>
          <HouseholdEditor occupants={place.occupants} onSave={saveOne} onRemove={removeOne} />
          {receipts[`${place.id}:household`] && (
            <View style={{ marginTop: 10 }}>
              <ReceiptCard receipt={receipts[`${place.id}:household`]} />
            </View>
          )}
        </View>
      )}

      <View style={styles.segment}>
        {(
          [
            ["all", tr("All ({n})", { n: counts.total })],
            ["attention", tr("Worth a look ({n})", { n: counts.attention })],
            ["unknown", tr("Not answered ({n})", { n: counts.total - counts.answered })],
          ] as [Filter, string][]
        ).map(([k, text]) => (
          <Pressable key={k} accessibilityRole="tab" aria-selected={filter === k} onPress={() => setFilter(k)} style={[styles.segBtn, filter === k && styles.segOn]}>
            <Text style={[styles.segText, filter === k && { color: colors.accent }]}>{text}</Text>
          </Pressable>
        ))}
      </View>

      {shown.length === 0 && <Text style={styles.note}>{filter === "attention" ? tr("Nothing here is worth a look right now.") : tr("Everything here has been answered.")}</Text>}
      {shown.map((c) => {
        const reading = readings.find((r) => r.checkId === c.id)!;
        const substance = substances.get(reading.status === "attention" ? reading.substanceId : c.substanceId);
        return (
          <CheckCard
            key={c.id}
            check={c}
            reading={reading}
            substance={substance}
            household={substance ? householdNotes(substance, people) : []}
            receipt={receipts[`${place.id}:${c.id}`] ?? null}
            defaultOpen={focusCheck === c.id}
            recheck={needsRecheck(reading, overview.completedOn)}
            onAnswer={(v) => answer(c.id, v)}
            onClear={() => answer(c.id, "")}
          />
        );
      })}

      <View style={{ marginTop: 16, marginBottom: 24 }}>
        {confirmRemove ? (
          <View>
            <Text style={styles.note}>{tr("This removes {label} and every answer about it from this device.", { label: tr(place.label) })}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <SecondaryButton title={tr("Yes, remove it")} onPress={removeThis} />
              <SecondaryButton title={tr("Keep it")} onPress={() => setConfirmRemove(false)} />
            </View>
          </View>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(true)} style={{ paddingVertical: 8 }}>
            <Text style={styles.linkSmall}>{tr("Remove this place")}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 24, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 14, lineHeight: 18 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.muted },
  big: { fontSize: 30, fontWeight: "700", color: colors.accent, marginTop: 4 },
  bigOf: { fontSize: 14, fontWeight: "600", color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 17 },
  link: { fontSize: 13, color: colors.accent, fontWeight: "600" },
  linkSmall: { fontSize: 12, color: colors.muted, textDecorationLine: "underline", marginTop: 2 },
  nextCard: { backgroundColor: colors.accentFill, borderRadius: radius, padding: 16, marginBottom: 12 },
  nextKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.onAccentMuted },
  nextTitle: { fontSize: 16, fontWeight: "700", color: colors.onAccent, marginTop: 4, lineHeight: 22 },
  nextButton: { alignSelf: "flex-start", marginTop: 12, backgroundColor: colors.onAccent, paddingVertical: 9, paddingHorizontal: 18, borderRadius: radiusPill },
  nextButtonText: { fontSize: 13, fontWeight: "700", color: colors.accentFill },
  placeCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  placeEmpty: { alignItems: "flex-start", borderStyle: "dashed", shadowOpacity: 0 },
  icon: { fontSize: 26, marginRight: 14, color: colors.ink },
  iconBig: { fontSize: 30, marginRight: 12, color: colors.ink },
  placeTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  placeMeta: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  chevron: { fontSize: 22, color: colors.muted, marginLeft: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radiusPill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 12, color: colors.ink },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 14, color: colors.ink, marginTop: 10 },
  hoursRow: { flexDirection: "row", alignItems: "center" },
  segment: { flexDirection: "row", backgroundColor: colors.track, borderRadius: radiusSm, padding: 3, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radiusSm - 2 },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 12, fontWeight: "600", color: colors.muted },
});
