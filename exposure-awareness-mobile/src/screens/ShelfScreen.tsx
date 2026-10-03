import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { buildLedger, weeklyIndexSeries, matchesFor, type Ledger } from "../engine/ingredients/ledger";
import { assessProduct, STANCE_INFO, type Stance } from "../engine/ingredients/assess";
import { FREQUENCY_INFO, type Frequency, type ShelfItem } from "../engine/ingredients/types";
import { BarChart } from "../components/BarChart";
import { Collapsible } from "../components/Collapsible";
import { SecondaryButton } from "../components/ui";
import type { UserProfile } from "../engine/types";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { colors, radius, radiusSm, shadow } from "../theme";
import { tr, trn } from "../i18n";

const FREQS = Object.keys(FREQUENCY_INFO) as Frequency[];
const STANCE_COLOR = { accent: colors.accent, warn: colors.warn, danger: colors.notice };

export default function ShelfScreen({ onScan }: { onScan: () => void }) {
  const [tab, setTab] = useState<"ledger" | "items">("ledger");
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [all, setAll] = useState<ShelfItem[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [series, setSeries] = useState<{ label: string; index: number }[]>([]);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    const everything = await db.getShelfItems(true);
    setAll(everything);
    setItems(everything.filter((i) => i.removedAt === null));
    setProfile(await db.getUserProfile());
    setLedger(buildLedger(everything));
    setSeries(weeklyIndexSeries(everything, 8));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setFreq(id: string, frequency: Frequency) {
    const { receipt: r } = await runActivity("shelf_change", () => db.updateShelfItem(id, { frequency }));
    setReceipt(r);
    load();
  }

  async function retire(id: string) {
    const { receipt: r } = await runActivity("shelf_change", () => db.removeShelfItem(id));
    setReceipt(r);
    load();
  }

  const stanceOf = (it: ShelfItem): Stance => {
    const matches = matchesFor(it);
    return assessProduct({ matches, unmatchedCount: 0, kind: it.kind, nova: it.nova, frequency: it.frequency, profile }).stance;
  };

  const empty = items.length === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>{tr("My shelf")}</Text>
      {receipt && <ReceiptCard receipt={receipt} />}
      <View style={styles.segment}>
        {(["ledger", "items"] as const).map((k) => (
          <Pressable accessibilityRole="tab" key={k} onPress={() => setTab(k)} aria-selected={!!(tab === k)} style={[styles.segBtn, tab === k && styles.segOn]}>
            <Text style={[styles.segText, tab === k && { color: colors.accent }]}>{k === "ledger" ? tr("Intake ledger") : tr("Products ({itemsCount})", { itemsCount: items.length })}</Text>
          </Pressable>
        ))}
      </View>

      {empty ? (
        <View style={styles.card}>
          <Text style={styles.title}>{tr("Nothing on your shelf yet")}</Text>
          <Text style={styles.note}>{tr("Scan a product you use often. Each one you add makes your running estimates more complete.")}</Text>
          <View style={{ marginTop: 14, alignSelf: "flex-start" }}>
            <SecondaryButton title={tr("Scan a product")} onPress={onScan} />
          </View>
        </View>
      ) : tab === "ledger" && ledger ? (
        <>
          <View style={styles.card}>
            <Text style={styles.kicker}>{tr("RELATIVE EXPOSURE INDEX")}</Text>
            <Text style={styles.big}>{ledger.index}</Text>
            <Text style={styles.note}>{tr("{itemCount} products · weekly trend", { itemCount: ledger.itemCount })}</Text>
            <BarChart label={tr("Relative exposure index, week by week")} data={series.map((s) => ({ label: s.label, value: s.index }))} maxHeight={70} />
            <View style={{ marginTop: 12 }}>
              <Collapsible title={tr("How to read this")}>
                <Text style={styles.note}>{tr("Labels don't say how much of an additive is in a product, so this is not a dose. It counts how often each flagged ingredient reaches you, weighted by where it sits on the label (a main ingredient counts more than a trace one) and how consistently it's flagged. The trend is meaningful; the absolute number is not.")}</Text>
              </Collapsible>
            </View>
          </View>

          {ledger.nutrients.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.kicker}>{tr("NUTRIENTS FROM WHAT YOU'VE SCANNED, PER DAY")}</Text>
              {ledger.nutrients.map((n) => (
                <View key={n.key} style={{ marginTop: 10 }}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.nLabel}>{tr(n.label)}</Text>
                    <Text style={styles.nValue}>{n.perDay} {n.unit} <Text style={styles.pct}>{tr("{pct}% of reference", { pct: n.pctDv })}</Text></Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.min(100, n.pctDv)}%`, backgroundColor: n.limitNutrient && n.pctDv >= 50 ? colors.warn : colors.accent }]} />
                  </View>
                </View>
              ))}
              <Text style={[styles.note, { marginTop: 10 }]}>
                {tr("Real amounts from labels, so a genuine estimate -- but only for {withNutrition} of {foodItems} foods on your shelf, so it's a floor, not your whole diet. Reference values are US FDA Daily Values, not personal targets.", { withNutrition: ledger.nutrientCoverage.withNutrition, foodItems: ledger.nutrientCoverage.foodItems })}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.kicker}>{tr("MOST FREQUENT FLAGGED INGREDIENTS")}</Text>
            {ledger.substances.length === 0 ? (
              <Text style={styles.note}>{tr("Nothing on your shelf matched our database.")}</Text>
            ) : (
              ledger.substances.slice(0, 6).map((s) => (
                <View key={s.substanceId} style={styles.subRow}>
                  <Collapsible title={tr(s.name)} teaser={`${trn(s.servingsPerWeek, "{n} serving/week", "{n} servings/week")}${s.possibleOnly ? tr(" · possible") : ""}`}>
                    {s.possibleOnly && <Text style={styles.note}>{tr("Listed only as a class term (e.g. \"fragrance\"), so we can't say it's actually present.")}</Text>}
                    {s.sources.slice(0, 4).map((src) => (
                      <Text key={src.itemId} style={styles.bullet}>{"•"} {tr(src.name)}</Text>
                    ))}
                  </Collapsible>
                </View>
              ))
            )}
            {ledger.themes.length > 0 && <Text style={[styles.note, { marginTop: 12 }]}>{tr("The science behind them: {map}.", { map: ledger.themes.slice(0, 3).map((t) => t.name).join(", ") })}</Text>}
          </View>
        </>
      ) : (
        items.map((it) => {
          const st = stanceOf(it);
          const color = STANCE_COLOR[STANCE_INFO[st].color];
          return (
            <View key={it.id} style={styles.card}>
              <Collapsible title={tr(it.name)} teaser={`${tr(STANCE_INFO[st].headline)} · ${tr(FREQUENCY_INFO[it.frequency].label)}`}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.label}>{tr("How often")}</Text>
                <View style={styles.chips}>
                  {FREQS.map((f) => (
                    <Pressable accessibilityRole="radio" key={f} onPress={() => setFreq(it.id, f)} aria-checked={!!(it.frequency === f)} style={[styles.chip, it.frequency === f && styles.chipOn]}>
                      <Text style={[styles.chipText, it.frequency === f && { color: colors.onAccent }]}>{tr(FREQUENCY_INFO[f].label)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                  <SecondaryButton title={tr("Remove from shelf")} onPress={() => retire(it.id)} />
                </View>
              </Collapsible>
            </View>
          );
        })
      )}
      {!empty && (
        <View style={{ marginTop: 6, marginBottom: 24, alignSelf: "flex-start" }}>
          <SecondaryButton title={tr("Scan another product")} onPress={onScan} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 10 },
  segment: { flexDirection: "row", backgroundColor: colors.segment, borderRadius: radiusSm, padding: 3, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radiusSm, alignItems: "center" },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.muted },
  big: { fontSize: 40, fontWeight: "700", color: colors.ink, marginTop: 4 },
  title: { fontSize: 17, fontWeight: "700", color: colors.ink },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  nLabel: { fontSize: 14, color: colors.ink },
  nValue: { fontSize: 14, fontWeight: "700", color: colors.ink },
  pct: { fontSize: 12, color: colors.muted, fontWeight: "400" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: 5, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  subRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, marginTop: 8 },
  bullet: { fontSize: 13, color: colors.ink, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 8, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
});
