import React, { useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { deriveRfD, EXTRA_FACTORS } from "../../engine/science/thresholds";
import { marginOfExposure } from "../../engine/science/doseResponse";
import { ToolHeader, ChipRow, Label, cardStyle } from "./viz";
import { colors, radiusSm } from "../../theme";
import { tr } from "../../i18n";

const NOAELS = [5, 50, 500];
const PCTS = [1, 10, 100, 300];
const fmt = (n: number) => (n >= 10 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n >= 0.01 ? n.toFixed(2) : n.toPrecision(2));

export default function ThresholdBuilder({ onBack }: { onBack: () => void }) {
  const [noael, setNoael] = useState(50);
  const [on, setOn] = useState<string[]>([]);
  const [pct, setPct] = useState(10);
  const extra = EXTRA_FACTORS.filter((f) => on.includes(f.id)).map(() => 10);
  const { rfd, totalFactor } = deriveRfD({ noael, extra });
  const exposure = (rfd * pct) / 100;
  const moe = marginOfExposure(noael, exposure);

  const steps = [
    { label: tr("Animal no-effect dose (NOAEL)"), value: noael, div: null as string | null },
    { label: tr("Animal to human"), value: noael / 10, div: "÷ 10" },
    { label: tr("Differences between people"), value: noael / 100, div: "÷ 10" },
    ...EXTRA_FACTORS.filter((f) => on.includes(f.id)).map((f, i) => ({ label: tr(f.label), value: noael / 100 / 10 ** (i + 1), div: "÷ 10" })),
  ];
  const max = Math.log10(noael) + 1;
  const width = (v: number) => `${Math.max(4, ((Math.log10(v) + 4) / (max + 4)) * 100)}%` as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Safety-threshold builder")} blurb={tr("Watch a 'safe level' get derived: start from the highest no-effect dose, then divide by safety factors. Values are illustrative (mg per kg body weight per day).")} onBack={onBack} />

      <Label>{tr("Highest dose with no observed effect in animals")}</Label>
      <ChipRow options={NOAELS} value={noael} onChange={setNoael} format={(n) => `${n} mg/kg/day`} />

      <View style={cardStyle}>
        {steps.map((s, i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <View style={styles.stepHead}>
              <Text style={styles.stepLabel}>{s.label}</Text>
              <Text style={styles.stepValue}>{s.div ? `${s.div} = ` : ""}{fmt(s.value)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: width(s.value), backgroundColor: i === 0 ? colors.vizNeutral : colors.accent }]} />
            </View>
          </View>
        ))}
        <Text style={styles.result}>{tr("Reference dose (RfD) = {rfd} mg/kg/day", { rfd: fmt(rfd) })}</Text>
        <Text style={styles.note}>{tr("That's the NOAEL divided by {totalFactor}.", { totalFactor: totalFactor.toLocaleString("en-US") })}</Text>
      </View>

      <Label>{tr("Add caution factors")}</Label>
      {EXTRA_FACTORS.map((f) => {
        const active = on.includes(f.id);
        return (
          <Pressable accessibilityRole="checkbox" key={f.id} onPress={() => setOn(active ? on.filter((x) => x !== f.id) : [...on, f.id])} aria-checked={!!(active)} style={[styles.toggle, active && styles.toggleOn]}>
            <Text style={styles.toggleTitle}>{active ? "✓ " : "+ "}{tr(f.label)} {"÷"} 10</Text>
            <Text style={styles.note}>{tr(f.why)}</Text>
          </Pressable>
        );
      })}

      <Label>{tr("If someone's exposure were this % of the limit")}</Label>
      <ChipRow options={PCTS} value={pct} onChange={setPct} format={(p) => `${p}%`} />
      <View style={[cardStyle, { borderColor: colors.accent }]}>
        <Text style={styles.result}>{tr("Still {moe}× below the animal no-effect dose", { moe: moe.toLocaleString("en-US", { maximumFractionDigits: 0 }) })}</Text>
        <Text style={styles.note}>
          {pct > 100
            ? tr("Above the regulatory limit -- but the limit already has a 100-fold cushion built in. Over the limit means 'look closer', not 'harm has occurred'.")
            : tr("Well within the limit. Limits are protective conventions, not cliffs.")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  stepHead: { flexDirection: "row", justifyContent: "space-between" },
  stepLabel: { fontSize: 13, color: colors.ink, flex: 1, paddingRight: 8 },
  stepValue: { fontSize: 13, fontWeight: "700", color: colors.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, marginTop: 5, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  result: { fontSize: 17, fontWeight: "700", color: colors.ink, marginTop: 4 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  toggle: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: radiusSm, padding: 12, marginBottom: 8 },
  toggleOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
});
