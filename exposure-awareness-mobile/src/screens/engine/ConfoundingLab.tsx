import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { ILLUSTRATIVE_STRATA, crudeRR, adjustedRR, type Stratum } from "../../engine/science/confounding";
import { ToolHeader, ChipRow, cardStyle } from "./viz";
import { colors } from "../../theme";

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
      <ToolHeader title="Confounding lab" blurb="Coffee drinkers versus non-drinkers, and an outcome. Toggle between the raw comparison and one that accounts for smoking. Made-up numbers, real logic." onBack={onBack} />
      <ChipRow options={["crude", "adjusted"] as Mode[]} value={mode} onChange={setMode} format={(m) => (m === "crude" ? "Raw comparison" : "Adjusted for smoking")} />

      {mode === "crude" ? (
        <View style={cardStyle}>
          <Text style={styles.title}>Everyone together</Text>
          <RateBar label="Coffee drinkers" value={pctOf(exposed)} color="#d9822b" />
          <RateBar label="Non-drinkers" value={pctOf(unexposed)} color="#8b8b8b" />
          <Text style={styles.big}>Risk ratio: {crudeRR(ILLUSTRATIVE_STRATA).toFixed(1)}×</Text>
          <Text style={styles.note}>Coffee looks like it roughly triples the outcome. A headline would write itself.</Text>
        </View>
      ) : (
        <>
          {ILLUSTRATIVE_STRATA.map((s) => (
            <View key={s.label} style={cardStyle}>
              <Text style={styles.title}>{s.label}</Text>
              <RateBar label="Coffee drinkers" value={pctOf(s.exposed)} color="#d9822b" />
              <RateBar label="Non-drinkers" value={pctOf(s.unexposed)} color="#8b8b8b" />
            </View>
          ))}
          <View style={[cardStyle, { borderColor: colors.accent }]}>
            <Text style={styles.big}>Adjusted risk ratio: {adjustedRR(ILLUSTRATIVE_STRATA).toFixed(1)}×</Text>
            <Text style={styles.note}>Within each group the rates are identical. The whole gap came from smoking: {Math.round((ILLUSTRATIVE_STRATA[0].exposed.n / exposed.n) * 100)}% of coffee drinkers smoked versus {Math.round((ILLUSTRATIVE_STRATA[0].unexposed.n / unexposed.n) * 100)}% of non-drinkers.</Text>
          </View>
        </>
      )}
      <Text style={styles.foot}>The lesson: an association can be real in the data and still not be caused by the exposure. Good studies say what they adjusted for -- and unmeasured confounders can still remain.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 16, fontWeight: "700", color: colors.ink },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  small: { fontSize: 13, color: colors.ink },
  value: { fontSize: 13, fontWeight: "700", color: colors.ink },
  track: { height: 12, borderRadius: 6, backgroundColor: "#eee9dd", marginTop: 4, overflow: "hidden" },
  fill: { height: 12, borderRadius: 6 },
  big: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: 14 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6 },
  foot: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 18, marginBottom: 24, fontStyle: "italic" },
});
