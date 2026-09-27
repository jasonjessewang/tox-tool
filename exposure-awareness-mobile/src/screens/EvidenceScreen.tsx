import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, Linking, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { loadEvidence, evidenceById, evidenceLearningRef, type EvidenceItem } from "../engine/evidence";
import { Collapsible } from "../components/Collapsible";
import { colors, radius, shadow } from "../theme";
import { todayISO as today } from "../util/dates";

function Badge({ text }: { text: string }) {
  return <Text style={styles.badge}>{text}</Text>;
}

export function Detail({ item, onBack }: { item: EvidenceItem; onBack: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8} style={{ marginBottom: 12, paddingVertical: 8 }}>
        <Text style={styles.back}>{"‹"} Research</Text>
      </Pressable>
      <View style={styles.badges}>
        <Badge text={item.evidence_level} />
        <Badge text={`${item.citation_count.toLocaleString()} citations`} />
      </View>
      <Text accessibilityRole="header" aria-level={1} style={styles.headline}>{item.headline}</Text>
      <Text style={styles.short}>{item.summary_short}</Text>

      <Text accessibilityRole="header" aria-level={2} style={styles.label}>Key findings</Text>
      {item.key_findings.map((f, i) => (
        <Text key={i} style={styles.bullet}>{"•"} {f}</Text>
      ))}

      {/* what the study could not show sits beside what it found, not behind a tap */}
      <Text accessibilityRole="header" aria-level={2} style={styles.label}>Limits to keep in mind</Text>
      {item.limitations.map((f, i) => (
        <Text key={i} style={styles.bullet}>{"•"} {f}</Text>
      ))}

      <Text accessibilityRole="header" aria-level={2} style={styles.label}>What you can do</Text>
      {item.practical.map((f, i) => (
        <Text key={i} style={styles.bullet}>{"→"} {f}</Text>
      ))}

      <View style={{ marginTop: 18 }}>
        <Collapsible title="Read the details">
          {item.summary_detail.split("\n\n").map((p, i) => (
            <Text key={i} style={styles.detail}>{p}</Text>
          ))}
        </Collapsible>
      </View>

      <Text style={styles.cite}>
        {item.first_author} et al. {item.journal}, {item.year}. {item.study_type}. Citations via {item.citation_source} ({item.citations_as_of}).
      </Text>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(item.url)} style={{ paddingVertical: 8 }}>
        <Text style={styles.link}>Open the original on PubMed {"›"}</Text>
      </Pressable>
    </ScrollView>
  );
}

/** List of vignettes -> one full-screen detail at a time. */
export default function EvidenceScreen({ onDetailChange, embedded = false }: { onDetailChange?: (open: boolean) => void; /** shown under the Learn page's own title, so its heading is a step down */ embedded?: boolean }) {
  const [open, setOpen] = useState<EvidenceItem | null>(null);
  const items = loadEvidence();

  function show(item: EvidenceItem | null) {
    setOpen(item);
    onDetailChange?.(item !== null);
    if (item) db.recordLearning(evidenceLearningRef(item.id), today());
  }

  if (open) return <Detail item={open} onBack={() => show(null)} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" aria-level={embedded ? 2 : 1} style={styles.h1}>Research</Text>
      <Text style={styles.sub}>The most-cited evidence, one vignette at a time. Tap one to read it.</Text>
      {items.map((e) => (
        <Pressable accessibilityRole="button" key={e.id} onPress={() => show(e)} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
          <View style={styles.badges}>
            <Badge text={e.evidence_level} />
            <Badge text={`${e.journal} ${e.year}`} />
          </View>
          <Text style={styles.cardHeadline}>{e.headline}</Text>
          <Text style={styles.cardMeta}>{e.citation_count.toLocaleString()} citations {"·"} tap to read</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 4 },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  cardHeadline: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 22, marginTop: 8 },
  cardMeta: { fontSize: 12, color: colors.muted, marginTop: 8 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  badge: { fontSize: 12, fontWeight: "600", color: colors.accent, backgroundColor: colors.accentSoft, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, overflow: "hidden" },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  headline: { fontSize: 22, fontWeight: "700", color: colors.ink, lineHeight: 29, marginTop: 12 },
  short: { fontSize: 15, color: colors.ink, lineHeight: 23, marginTop: 10 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, marginTop: 20, marginBottom: 6, textTransform: "uppercase" },
  bullet: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 4 },
  detail: { fontSize: 14, color: colors.ink, lineHeight: 22, marginTop: 8 },
  cite: { fontSize: 12, color: colors.muted, lineHeight: 16, marginTop: 22, fontStyle: "italic" },
  link: { fontSize: 14, color: colors.accent, fontWeight: "600", marginTop: 8, marginBottom: 24 },
});

/** Opens one summary by id (used from lessons); reading it counts as learning. */
export function EvidenceDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const item = evidenceById(id);
  useEffect(() => {
    if (item) db.recordLearning(evidenceLearningRef(item.id), today());
  }, [item]);
  return item ? <Detail item={item} onBack={onBack} /> : null;
}
