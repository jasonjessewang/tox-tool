import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { Collapsible } from "./Collapsible";
import { useContentComplexity } from "../util/complexity";
import { ReceiptCard } from "./ReceiptCard";
import { colors, radiusSm } from "../theme";
import type { HouseholdNote } from "../engine/places/evaluate";
import type { AnswerStatus, CheckReading, PlaceCheck } from "../engine/places/types";
import type { Receipt } from "../engine/receipts";
import type { Substance } from "../engine/types";

const STATUS_LABEL: Record<AnswerStatus, string> = { meets: "Meets the reference", attention: "Worth a look", unknown: "Not answered yet", na: "Doesn't apply here" };
const STATUS_COLOR: Record<AnswerStatus, string> = { meets: colors.accent, attention: colors.warn, unknown: colors.muted, na: colors.muted };

/**
 * One question about a place, and the comparison it makes: what you answered, what that is compared with (and who says so),
 * why it is worth knowing, and -- if a small change would bring it in line -- what the change is. The answer's standing
 * is never shown as a verdict; "worth a look" is amber, never red.
 */
export function CheckCard({
  check,
  reading,
  substance,
  household,
  receipt,
  onAnswer,
  onClear,
  defaultOpen = false,
  recheck = false,
}: {
  check: PlaceCheck;
  reading: CheckReading;
  substance: Substance | undefined;
  household: HouseholdNote[];
  receipt: Receipt | null;
  onAnswer: (value: string) => void;
  onClear: () => void;
  defaultOpen?: boolean;
  /** a tip about this was marked done since the answer was given */
  recheck?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const level = useContentComplexity();
  const status = reading.status;
  const tips = status === "attention" ? (substance?.mitigation_tips ?? []).slice(0, 2) : [];
  const studies = (substance?.references ?? []).slice(0, 2);
  const comptox = substance?.regulatory?.comptox_url ?? null;

  return (
    <View style={[styles.card, status === "attention" && styles.cardAttention]}>
      <Pressable accessibilityRole="button" aria-expanded={open} onPress={() => setOpen(!open)} style={styles.head}>
        <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.question}>{check.question}</Text>
          <Text style={[styles.status, { color: STATUS_COLOR[status] }]}>
            {reading.answerLabel ? (status === "unknown" ? reading.answerLabel : `${STATUS_LABEL[status]} · ${reading.answerLabel}`) : STATUS_LABEL[status]}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </Pressable>

      {open && (
        <View style={styles.body}>
          {recheck && <Text style={styles.recheck}>You marked a tip about this done since you answered. If something changed, choose the answer that fits now.</Text>}
          {check.help ? <Text style={styles.help}>{check.help}</Text> : null}
          <View style={{ marginTop: 6 }}>
            {check.options.map((o) => {
              const selected = reading.answerLabel === o.label;
              return (
                <Pressable key={o.value} accessibilityRole="radio" aria-checked={selected} onPress={() => onAnswer(o.value)} style={[styles.option, selected && styles.optionOn]}>
                  <View style={[styles.radio, selected && styles.radioOn]} />
                  <Text style={[styles.optionText, selected && { color: colors.accent, fontWeight: "600" }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.reference}>
            <Text style={styles.kicker}>COMPARED WITH</Text>
            <Text style={styles.refText}>{check.reference.text}</Text>
            <Text style={styles.refSource}>{check.reference.source}</Text>
          </View>

          <Text style={styles.why}>{check.why}</Text>

          {household.length > 0 && (
            <Text style={styles.household}>
              Matters a little more for {household.map((h) => `${h.who === "You" ? "you" : h.who} (${h.reasons[0].label.toLowerCase()})`).join(", ")}.
            </Text>
          )}

          {tips.length > 0 && (
            <View style={styles.tips}>
              <Text style={styles.kicker}>A SMALL CHANGE</Text>
              {tips.map((t, i) => (
                <Text key={i} style={styles.tip}>
                  {"•"} {t}
                </Text>
              ))}
              <Text style={styles.refSource}>This also appears in This week's focus on your Dashboard until you change it or decide to keep it.</Text>
            </View>
          )}

          {level !== "simple" && studies.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Collapsible title="The science behind this" defaultOpen={level === "technical"} teaser={`From PubMed · ${studies.length} stud${studies.length === 1 ? "y" : "ies"}`}>
                <Text style={styles.refSource}>Real citations from PubMed (US National Library of Medicine), fetched for {substance!.name}.</Text>
                {studies.map((r) => (
                  <View key={r.pmid} style={styles.study}>
                    <Text style={styles.studyTitle}>{r.title}</Text>
                    <Text style={styles.refSource}>{[r.journal, r.year].filter(Boolean).join(" · ")}</Text>
                    <View style={styles.links}>
                      <Pressable accessibilityRole="link" onPress={() => Linking.openURL(r.url)} style={{ paddingVertical: 8 }}>
                        <Text style={styles.link}>PubMed {"›"}</Text>
                      </Pressable>
                      {r.doi ? (
                        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`https://doi.org/${r.doi}`)} style={{ paddingVertical: 8 }}>
                          <Text style={styles.link}>DOI {"›"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
                {comptox ? (
                  <Pressable accessibilityRole="link" onPress={() => Linking.openURL(comptox)} style={{ marginTop: 8, paddingVertical: 8 }}>
                    <Text style={styles.link}>EPA CompTox Chemicals Dashboard {"›"}</Text>
                  </Pressable>
                ) : null}
              </Collapsible>
            </View>
          )}

          {receipt && <ReceiptCard receipt={receipt} />}

          {reading.answerLabel !== null && (
            <Pressable accessibilityRole="button" onPress={onClear} style={{ marginTop: 6, paddingVertical: 8 }}>
              <Text style={styles.clear}>Take my answer back</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, marginBottom: 8, overflow: "hidden" },
  cardAttention: { borderColor: colors.warn },
  head: { flexDirection: "row", alignItems: "center", padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  question: { fontSize: 14, fontWeight: "600", color: colors.ink },
  status: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 12, color: colors.muted, marginLeft: 8 },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  help: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  recheck: { fontSize: 12, color: colors.accent, fontWeight: "600", lineHeight: 17, marginBottom: 6 },
  option: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: radiusSm },
  optionOn: { backgroundColor: colors.accentSoft },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.line, marginRight: 10 },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionText: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18 },
  reference: { marginTop: 10, padding: 10, borderRadius: radiusSm, backgroundColor: "#f3efe4" },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, color: colors.muted },
  refText: { fontSize: 12, color: colors.ink, marginTop: 4, lineHeight: 17 },
  refSource: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 15 },
  why: { fontSize: 12, color: colors.ink, marginTop: 10, lineHeight: 17 },
  household: { fontSize: 12, color: colors.accent, marginTop: 8, lineHeight: 17, fontWeight: "600" },
  tips: { marginTop: 10, padding: 10, borderRadius: radiusSm, backgroundColor: colors.warnSoft },
  tip: { fontSize: 12, color: colors.ink, marginTop: 4, lineHeight: 17 },
  clear: { fontSize: 12, color: colors.muted, textDecorationLine: "underline" },
  study: { marginTop: 10 },
  studyTitle: { fontSize: 12, fontWeight: "600", color: colors.ink, lineHeight: 17 },
  links: { flexDirection: "row", gap: 16, marginTop: 4 },
  link: { fontSize: 12, color: colors.accent, fontWeight: "600" },
});
