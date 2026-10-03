import React, { useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { curve, MODEL_INFO, marginOfExposure, type DoseModel } from "../../engine/science/doseResponse";
import { ToolHeader, ChipRow, Label, cardStyle } from "./viz";
import { colors } from "../../theme";
import { tr } from "../../i18n";

const MODELS: DoseModel[] = ["threshold", "linear", "nonmonotonic"];
const EXPOSURES = [0.001, 0.01, 0.1, 1, 10];
const FROM = -3;
const TO = 2;
const H = 130;

const pct = (x: number) => `${((x - FROM) / (TO - FROM)) * 100}%` as const;

export default function DoseResponseExplorer({ onBack, initialModel = "threshold" }: { onBack: () => void; initialModel?: DoseModel }) {
  const [model, setModel] = useState<DoseModel>(initialModel);
  const [exposure, setExposure] = useState(0.01);
  const points = curve(model, FROM, TO, 56);
  const moe = marginOfExposure(1, exposure);
  const exposureX = Math.log10(exposure);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Dose-response explorer")} blurb={tr("Effect changes with amount. Pick a shape, then place your own exposure on the chart. Illustrative curves, not a specific chemical.")} onBack={onBack} />

      <ChipRow options={MODELS} value={model} onChange={setModel} format={(m) => tr(MODEL_INFO[m].label)} />

      <View style={cardStyle}>
        <View style={{ height: H, flexDirection: "row", alignItems: "flex-end", gap: 1 }}>
          {points.map((p, i) => (
            <View key={i} style={{ flex: 1, height: Math.max(2, p.response * H), backgroundColor: p.dose <= 1 ? colors.vizGreen : colors.vizOrange, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          ))}
          <View pointerEvents="none" style={[styles.marker, { left: pct(0), backgroundColor: colors.ink }]} />
          <View pointerEvents="none" style={[styles.marker, { left: pct(-2), backgroundColor: colors.accent }]} />
          <View pointerEvents="none" style={[styles.marker, { left: pct(exposureX), backgroundColor: colors.vizBlue, width: 3 }]} />
        </View>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{tr("1/1000 of study dose")}</Text>
          <Text style={styles.axisText}>100×</Text>
        </View>
        <View style={styles.keyRow}>
          <Text style={[styles.key, { color: colors.ink }]}>{tr("● study's no-effect dose (NOAEL)")}</Text>
          <Text style={[styles.key, { color: colors.accent }]}>{tr("● regulatory limit (NOAEL ÷ 100)")}</Text>
          <Text style={[styles.key, { color: colors.vizBlue }]}>{tr("● your exposure")}</Text>
        </View>
        <Text style={styles.note}>{tr("Horizontal axis is dose on a log scale: each step right is 10× more.")}</Text>
      </View>

      <Label>{tr("Where is your exposure? (multiple of the study's no-effect dose)")}</Label>
      <ChipRow options={EXPOSURES} value={exposure} onChange={setExposure} format={(v) => (v < 1 ? `1/${Math.round(1 / v).toLocaleString("en-US")}` : `${v}×`)} />

      <View style={[cardStyle, { borderColor: colors.accent }]}>
        <Text style={styles.moeTitle}>
          {moe >= 1 ? tr("Margin of exposure: {moe}×", { moe: moe.toLocaleString("en-US", { maximumFractionDigits: 0 }) }) : tr("Exposure is {v}× above the no-effect dose", { v: Math.round(1 / moe) })}
        </Text>
        <Text style={styles.note}>
          {moe >= 100
            ? tr("Your exposure is at least 100 times below the dose where no effect was seen -- the usual protective margin.")
            : moe >= 1
            ? tr("Below the no-effect dose, but with less than the usual 100-fold protective margin.")
            : tr("Above the dose tested as safe in the study -- the region where effects were actually observed.")}
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={styles.moeTitle}>{tr(MODEL_INFO[model].label)}</Text>
        <Text style={styles.note}>{tr(MODEL_INFO[model].blurb)}</Text>
      </View>
      <Text style={styles.note2}>{tr("Most real-world exposures sit far to the left of the doses studies use -- which is why \"does it cause harm at the study dose?\" and \"does it matter at my dose?\" are different questions.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  marker: { position: "absolute", top: 0, bottom: 0, width: 2 },
  axis: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  axisText: { fontSize: 12, color: colors.muted },
  keyRow: { marginTop: 12, gap: 4 },
  key: { fontSize: 12, fontWeight: "600" },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 8 },
  note2: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 16, marginBottom: 24, fontStyle: "italic" },
  moeTitle: { fontSize: 17, fontWeight: "700", color: colors.ink },
});
