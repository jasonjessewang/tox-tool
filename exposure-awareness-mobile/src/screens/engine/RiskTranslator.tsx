import React, { useState } from "react";
import { ScrollView, View, Text, Share, StyleSheet } from "react-native";
import { computeRisk, translate, questionsForCareTeam, formatPerThousand } from "../../engine/science/riskMath";
import { PrimaryButton, SecondaryButton } from "../../components/ui";
import { ToolHeader, ChipRow, Label, PeopleArray, cardStyle } from "./viz";
import { colors } from "../../theme";
import { tr } from "../../i18n";

const BASELINES = [100000, 10000, 1000, 100, 10];
const RRS = [1.1, 1.5, 2, 5, 10];

export default function RiskTranslator({ onBack }: { onBack: () => void }) {
  const [oneIn, setOneIn] = useState(10000);
  const [rr, setRr] = useState(10);
  const r = computeRisk({ oneIn, relativeRisk: rr });
  const t = translate({ oneIn, relativeRisk: rr });
  const questions = questionsForCareTeam({ oneIn, relativeRisk: rr });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Risk translator")} blurb={tr("Headlines give the ratio. This shows the real numbers -- try the 10-times example, then change the starting risk.")} onBack={onBack} />

      <Label>{tr("Starting (baseline) risk -- illustrative")}</Label>
      <ChipRow options={BASELINES} value={oneIn} onChange={setOneIn} format={(n) => tr("1 in {n}", { n: n.toLocaleString("en-US") })} />
      <Label>{tr("The headline says the risk is multiplied by")}</Label>
      <ChipRow options={RRS} value={rr} onChange={setRr} format={(n) => `${n}×`} />

      <View style={[cardStyle, { borderColor: colors.highlightLine, backgroundColor: colors.highlight }]}>
        <Text style={styles.kicker}>{tr("THE HEADLINE")}</Text>
        <Text style={styles.headline}>{tr(t.headline)}</Text>
      </View>
      <View style={[cardStyle, { borderColor: colors.accent }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{tr("IN REAL NUMBERS")}</Text>
        <Text style={styles.honest}>{tr(t.honest)}</Text>
        {r.numberNeededToHarm && <Text style={styles.small}>{tr("About {n} people would need the exposure for one extra case.", { n: r.numberNeededToHarm.toLocaleString("en-US") })}</Text>}
        {r.capped && <Text style={styles.small}>{tr("Risk can't exceed 100%, so this combination is capped.")}</Text>}
      </View>

      <View style={cardStyle}>
        <Text style={styles.kicker}>{tr("OUT OF 1,000 PEOPLE")}</Text>
        <PeopleArray baseline={r.perThousandBaseline} extra={r.perThousandExtra} />
        <Text style={styles.small}>
          {tr("Baseline {baseline} → {exposed} per 1,000. Fractions of a person don't show as dots.", { baseline: formatPerThousand(r.perThousandBaseline), exposed: formatPerThousand(r.perThousandExposed) })}
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={styles.kicker}>{tr("BRING IT TO YOUR CARE TEAM")}</Text>
        <Text style={styles.small}>{tr("Questions worth asking about any risk statistic -- filled in with the numbers above.")}</Text>
        {questions.map((q, i) => (
          <Text key={i} style={styles.q}>{i + 1}. {tr(q)}</Text>
        ))}
        <View style={{ marginTop: 14 }}>
          <SecondaryButton title={tr("Share these questions")} onPress={() => Share.share({ message: `${tr("Questions to ask about a health statistic:")}\n\n${questions.map((q, i) => `${i + 1}. ${tr(q)}`).join("\n")}` })} />
        </View>
      </View>

      <Text style={styles.disclaimer}>{tr("These are teaching numbers, not real baselines. Real baselines depend on age, sex and history -- your clinician can tell you yours. This is education, not medical advice.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.warn, marginBottom: 8 },
  headline: { fontSize: 20, fontWeight: "700", color: colors.ink, lineHeight: 27 },
  honest: { fontSize: 20, fontWeight: "700", color: colors.ink, lineHeight: 27 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 8 },
  q: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 10 },
  disclaimer: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 18, marginBottom: 24, fontStyle: "italic" },
});
