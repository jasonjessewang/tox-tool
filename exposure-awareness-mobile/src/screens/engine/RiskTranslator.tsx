import React, { useState } from "react";
import { ScrollView, View, Text, Share, StyleSheet } from "react-native";
import { computeRisk, translate, questionsForCareTeam, formatPerThousand } from "../../engine/science/riskMath";
import { PrimaryButton, SecondaryButton } from "../../components/ui";
import { ToolHeader, ChipRow, Label, PeopleArray, cardStyle } from "./viz";
import { colors } from "../../theme";

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
      <ToolHeader title="Risk translator" blurb="Headlines give the ratio. This shows the real numbers -- try the 10-times example, then change the starting risk." onBack={onBack} />

      <Label>Starting (baseline) risk -- illustrative</Label>
      <ChipRow options={BASELINES} value={oneIn} onChange={setOneIn} format={(n) => `1 in ${n.toLocaleString("en-US")}`} />
      <Label>The headline says the risk is multiplied by</Label>
      <ChipRow options={RRS} value={rr} onChange={setRr} format={(n) => `${n}×`} />

      <View style={[cardStyle, { borderColor: "#e3c9a4", backgroundColor: "#fbf3e6" }]}>
        <Text style={styles.kicker}>THE HEADLINE</Text>
        <Text style={styles.headline}>{t.headline}</Text>
      </View>
      <View style={[cardStyle, { borderColor: colors.accent }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>IN REAL NUMBERS</Text>
        <Text style={styles.honest}>{t.honest}</Text>
        {r.numberNeededToHarm && <Text style={styles.small}>About {r.numberNeededToHarm.toLocaleString("en-US")} people would need the exposure for one extra case.</Text>}
        {r.capped && <Text style={styles.small}>Risk can't exceed 100%, so this combination is capped.</Text>}
      </View>

      <View style={cardStyle}>
        <Text style={styles.kicker}>OUT OF 1,000 PEOPLE</Text>
        <PeopleArray baseline={r.perThousandBaseline} extra={r.perThousandExtra} />
        <Text style={styles.small}>
          Baseline {formatPerThousand(r.perThousandBaseline)} {"→"} {formatPerThousand(r.perThousandExposed)} per 1,000. Fractions of a person don't show as dots.
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={styles.kicker}>BRING IT TO YOUR CARE TEAM</Text>
        <Text style={styles.small}>Questions worth asking about any risk statistic -- filled in with the numbers above.</Text>
        {questions.map((q, i) => (
          <Text key={i} style={styles.q}>{i + 1}. {q}</Text>
        ))}
        <View style={{ marginTop: 14 }}>
          <SecondaryButton title="Share these questions" onPress={() => Share.share({ message: `Questions to ask about a health statistic:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` })} />
        </View>
      </View>

      <Text style={styles.disclaimer}>These are teaching numbers, not real baselines. Real baselines depend on age, sex and history -- your clinician can tell you yours. This is education, not medical advice.</Text>
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
