import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { ILLUSTRATIVE_STRATA, crudeRR, adjustedRR, type Stratum } from "../../engine/science/confounding";
import { ToolHeader, ChipRow, cardStyle } from "./viz";
import { colors } from "../../theme";
import { tr } from "../../i18n";

type Mode = "crude" | "adjusted";

const pctOf = (g: { n: number; cases: number }) => (g.cases / g.n) * 100;

function RateBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.rowBetween}>
        <Text style={styles.small}>{label}</Text>
        <Text style={styles.value}>{value.toFixed(1)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, value * 5)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function ConfoundingLab({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("crude");
  const sum = (pick: (s: Stratum) => { n: number; cases: number }) => ILLUSTRATIVE_STRATA.reduce((a, s) => ({ n: a.n + pick(s).n, cases: a.cases + pick(s).cases }), { n: 0, cases: 0 });
  const exposed = sum((s) => s.exposed);
  const unexposed = sum((s) => s.unexposed);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Confounding lab")} blurb={tr("Coffee drinkers versus non-drinkers, and an outcome. Toggle between the raw comparison and one that accounts for smoking. Made-up numbers, real logic.")} onBack={onBack} />
      <ChipRow options={["crude", "adjusted"] as Mode[]} value={mode} onChange={setMode} format={(m) => (m === "crude" ? tr("Raw comparison") : tr("Adjusted for smoking"))} />

      {mode === "crude" ? (
        <View style={cardStyle}>
          <Text style={styles.title}>{tr("Everyone together")}</Text>
          <RateBar label={tr("Coffee drinkers")} value={pctOf(exposed)} color={colors.vizOrange} />
          <RateBar label={tr("Non-drinkers")} value={pctOf(unexposed)} color={colors.vizNeutral} />
          <Text style={styles.big}>{tr("Risk ratio: {rr}×", { rr: crudeRR(ILLUSTRATIVE_STRATA).toFixed(1) })}</Text>
          <Text style={styles.note}>{tr("Coffee looks like it roughly triples the outcome. A headline would write itself.")}</Text>
        </View>
      ) : (
        <>
          {ILLUSTRATIVE_STRATA.map((s) => (
            <View key={s.label} style={cardStyle}>
              <Text style={styles.title}>{tr(s.label)}</Text>
              <RateBar label={tr("Coffee drinkers")} value={pctOf(s.exposed)} color={colors.vizOrange} />
              <RateBar label={tr("Non-drinkers")} value={pctOf(s.unexposed)} color={colors.vizNeutral} />
            </View>
          ))}
          <View style={[cardStyle, { borderColor: colors.accent }]}>
            <Text style={styles.big}>{tr("Adjusted risk ratio: {adjustedRR}×", { adjustedRR: adjustedRR(ILLUSTRATIVE_STRATA).toFixed(1) })}</Text>
            <Text style={styles.note}>{tr("Within each group the rates are identical. The whole gap came from smoking: {v}% of coffee drinkers smoked versus {v2}% of non-drinkers.", { v: Math.round((ILLUSTRATIVE_STRATA[0].exposed.n / exposed.n) * 100), v2: Math.round((ILLUSTRATIVE_STRATA[0].unexposed.n / unexposed.n) * 100) })}</Text>
          </View>
        </>
      )}
      <Text style={styles.foot}>{tr("The lesson: an association can be real in the data and still not be caused by the exposure. Good studies say what they adjusted for -- and unmeasured confounders can still remain.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 13, color: colors.ink },
  value: { fontSize: 13, fontWeight: "700", color: colors.ink },
  track: { height: 12, borderRadius: 6, backgroundColor: colors.track, marginTop: 4, overflow: "hidden" },
  fill: { height: 12, borderRadius: 6 },
  big: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: 14 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  foot: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 18, marginBottom: 24, fontStyle: "italic" },
});
