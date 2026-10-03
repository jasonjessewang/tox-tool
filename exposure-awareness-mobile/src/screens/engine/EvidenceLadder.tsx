import React, { useState } from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { ToolHeader } from "./viz";
import { colors, radius, shadow } from "../../theme";
import { msg, tr } from "../../i18n";

interface Rung {
  id: string;
  icon: string;
  name: string;
  what: string;
  tells: string;
  blind: string;
  speed: number; // 1-5
  human: number; // 1-5
}

const RUNGS: Rung[] = [
  { id: "silico", icon: "💻", name: msg("In silico (computer models)"), what: msg("Predicts a chemical's behavior from its structure and existing data -- QSAR, read-across, toxicokinetic and PBPK models."), tells: msg("Fast, cheap screening for thousands of chemicals; estimates how a dose in a dish translates to a dose in a person."), blind: msg("Only as good as the data it learned from. Unfamiliar chemicals can be predicted badly."), speed: 5, human: 1 },
  { id: "vitro", icon: "🧫", name: msg("In vitro (cells in a dish)"), what: msg("Tests cells or tissues, including high-throughput robotic screens and omics readouts."), tells: msg("Mechanism clues: which pathways a chemical touches, at what concentration."), blind: msg("No whole body: no digestion, metabolism, or organ interaction. A cell effect is not a health outcome."), speed: 4, human: 2 },
  { id: "vivo", icon: "🐭", name: msg("In vivo (animal studies)"), what: msg("Tests whole animals across doses and durations, including development and reproduction."), tells: msg("Integrated whole-body effects; the source of most no-effect doses used for safety limits."), blind: msg("Species differ from humans in metabolism and sensitivity, and lab doses are far higher than real exposure."), speed: 2, human: 3 },
  { id: "epi", icon: "👥", name: msg("Epidemiology (people, observed)"), what: msg("Studies real exposures and outcomes in populations: cohorts, case-control studies."), tells: msg("What actually happens to people at real-world doses, including sensitive groups."), blind: msg("Confounding, imperfect exposure measurement, and 'linked to' is not 'causes'."), speed: 2, human: 4 },
  { id: "rct", icon: "🎯", name: msg("Randomized trials"), what: msg("Randomly assigns people to an exposure or not, then compares outcomes."), tells: msg("The strongest evidence for cause and effect, because randomization balances confounders."), blind: msg("Rarely ethical or practical for toxicants; short and small compared with lifetime exposure."), speed: 1, human: 5 },
];

const Dots = ({ n, color }: { n: number; color: string }) => (
  <View style={{ flexDirection: "row", gap: 3 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: i <= n ? color : colors.vizEmpty }} />
    ))}
  </View>
);

export default function EvidenceLadder({ onBack }: { onBack: () => void }) {
  const [open, setOpen] = useState<string>("vivo");
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <ToolHeader title={tr("Evidence ladder")} blurb={tr("Every safety limit comes from combining evidence of different kinds. Tap a rung to see what it tells you -- and what it can't.")} onBack={onBack} />
      {RUNGS.map((r, i) => {
        const isOpen = open === r.id;
        return (
          <Pressable accessibilityRole="button" key={r.id} onPress={() => setOpen(r.id)} style={[styles.rung, { marginHorizontal: (RUNGS.length - 1 - i) * 3 }, isOpen && styles.rungOpen]}>
            <Text style={styles.name}>{r.icon} {tr(r.name)}</Text>
            <View style={styles.meters}>
              <View><Text style={styles.meterLabel}>{tr("Speed & cost")}</Text><Dots n={r.speed} color={colors.vizBlue} /></View>
              <View><Text style={styles.meterLabel}>{tr("Human relevance")}</Text><Dots n={r.human} color={colors.accent} /></View>
            </View>
            {isOpen && (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.body}>{tr(r.what)}</Text>
                <Text style={styles.sectionLabel}>{tr("What it tells you")}</Text>
                <Text style={styles.body}>{tr(r.tells)}</Text>
                <Text style={[styles.sectionLabel, { color: colors.warn }]}>{tr("Blind spot")}</Text>
                <Text style={styles.body}>{tr(r.blind)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
      <View style={styles.wrap}>
        <Text style={styles.wrapTitle}>{tr("Weight of evidence")}</Text>
        <Text style={styles.body}>{tr("Confidence comes when independent methods with different weaknesses point the same way: a model predicts it, cells show a mechanism, animals show the effect, and people show it at real exposures. One rung alone rarely settles anything.")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  rung: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 14, marginBottom: 10, ...shadow },
  rungOpen: { borderColor: colors.accent, borderWidth: 2 },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink },
  meters: { flexDirection: "row", gap: 24, marginTop: 10 },
  meterLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 4, textTransform: "uppercase" },
  body: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.accent, marginTop: 12, textTransform: "uppercase" },
  wrap: { backgroundColor: colors.accentSoft, borderRadius: radius, padding: 16, marginTop: 8, marginBottom: 24 },
  wrapTitle: { fontSize: 15, fontWeight: "700", color: colors.accent },
});
