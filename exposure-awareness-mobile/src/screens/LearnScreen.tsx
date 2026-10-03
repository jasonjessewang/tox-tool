import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, Pressable, Linking, StyleSheet } from "react-native";
import * as Speech from "expo-speech";
import * as db from "../storage/db";
import { loadHazardDb, loadConcepts, summaryFor } from "../engine/scoring";
import { PILLARS, lessonsFor, estimateMinutes, type PillarKey, type Lesson } from "../data/pillars";
import type { Substance, Category, Concept } from "../engine/types";
import EvidenceScreen from "./EvidenceScreen";
import EngineScreen from "./EngineScreen";
import { Card, Pill } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { contextEvidenceForSubstance, evidenceForSubstance } from "../engine/evidence";
import { colors, radiusSm, shadow } from "../theme";
import { todayISO } from "../util/dates";
import { useContentComplexity } from "../util/complexity";
import { msg, tr, trn, charBudget, languageTag } from "../i18n";

const THEMES: { key: Category; icon: string; title: string; blurb: string }[] = [
  { key: "food", icon: "🥣", title: msg("Food"), blurb: msg("Additives, packaging, what's on your plate") },
  { key: "personal_care", icon: "🧴", title: msg("Personal care"), blurb: msg("Shampoo, skin, everyday products") },
  { key: "environment", icon: "🏠", title: msg("Environment"), blurb: msg("Air, water, and the spaces you live in") },
];

type View_ =
  | { type: "home" }
  | { type: "theme"; cat: Category }
  | { type: "substance"; cat: Category; id: string }
  | { type: "pillar"; key: PillarKey }
  | { type: "concept"; id: string };

function truncate(text: string, englishMax: number) {
  const max = charBudget(englishMax);
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function ListenButton({ id, title, text, speakingId, setSpeakingId }: { id: string; title: string; text: string; speakingId: string | null; setSpeakingId: (id: string | null) => void }) {
  const active = speakingId === id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? tr("Stop listening to {title}", { title }) : tr("Listen to {title}", { title })}
      aria-pressed={active}
      onPress={() => {
        Speech.stop();
        if (active) {
          setSpeakingId(null);
          return;
        }
        setSpeakingId(id);
        Speech.speak(text, {
          language: languageTag(),
          rate: 0.95,
          onDone: () => setSpeakingId(null),
          onStopped: () => setSpeakingId(null),
          onError: () => setSpeakingId(null),
        });
      }}
      style={[styles.listen, active && styles.listenActive]}
    >
      <Text style={[styles.listenText, active && { color: colors.onAccent }]}>{active ? tr("■ Stop") : tr("▶ Listen")}</Text>
    </Pressable>
  );
}

function Tile({ icon, title, blurb, right, onPress }: { icon: string; title: string; blurb: string; right?: React.ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileBlurb}>{blurb}</Text>
      {right ? <View style={{ marginTop: 8 }}>{right}</View> : null}
    </Pressable>
  );
}

function SubstanceDetail({ s, onOpenRelated }: { s: Substance; onOpenRelated: (id: string) => void }) {
  const level = useContentComplexity();
  const simple = level === "simple";
  const technical = level === "technical";
  const concepts = loadConcepts();
  const allSubstances = loadHazardDb();
  const byId = new Map(allSubstances.map((x) => [x.id, x]));
  const substituteFor = (s.regrettable_substitute_for ?? []).map((id) => byId.get(id)).filter((x): x is Substance => !!x);
  const substitutedBy = (s.known_regrettable_substitutes ?? []).map((id) => byId.get(id)).filter((x): x is Substance => !!x);
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text accessibilityRole="header" style={styles.detailTitle}>{tr(s.name)}</Text>
        <Pill concernLevel={s.concern_level} />
      </View>
      <Text style={styles.body}>{tr(summaryFor(s, level))}</Text>

      {(substituteFor.length > 0 || substitutedBy.length > 0) && (
        <View style={styles.swapBox}>
          <Text style={styles.swapKicker}>{"⇄"} {substituteFor.length > 0 ? tr("OFTEN USED TO REPLACE") : tr("SOMETIMES REPLACED WITH")}</Text>
          {(substituteFor.length > 0 ? substituteFor : substitutedBy).map((rel) => (
            <Pressable key={rel.id} accessibilityRole="button" onPress={() => onOpenRelated(rel.id)} hitSlop={4}>
              <Text style={styles.swapLink}>{tr(rel.name)} {"›"}</Text>
            </Pressable>
          ))}
          <Text style={styles.swapNote}>
            {substituteFor.length > 0
              ? tr("Research generally finds comparable, not reduced, concern for close chemical relatives like this one.")
              : tr("A close chemical relative sometimes used in its place -- often with comparable, not reduced, concern.")}
          </Text>
        </View>
      )}

      {!simple && evidenceForSubstance(s.id).length > 0 && (
        <>
          <Text accessibilityRole="header" aria-level={2} style={styles.label}>{tr("Research behind this")}</Text>
          {evidenceForSubstance(s.id).map((e) => (
            <Text key={e.id} style={styles.bullet}>{"\u2022"} {tr(e.headline)}</Text>
          ))}
        </>
      )}

      {!simple && contextEvidenceForSubstance(s.id).length > 0 && (
        <>
          <Text accessibilityRole="header" aria-level={2} style={styles.label}>{tr("Wider context")}</Text>
          <Text style={styles.contextNote}>{tr("These studies looked at something close by, not at this exactly -- useful background, not a test of it.")}</Text>
          {contextEvidenceForSubstance(s.id).map((e) => (
            <Text key={e.id} style={styles.bullet}>{"\u2022"} {tr(e.headline)}</Text>
          ))}
        </>
      )}

      <Text accessibilityRole="header" aria-level={2} style={styles.label}>{tr("What you can do")}</Text>
      {s.mitigation_tips.map((tip, i) => (
        <Text key={i} style={styles.bullet}>{"•"} {tr(tip)}</Text>
      ))}

      {!simple && s.references && s.references.length > 0 && (
        <>
          <Text accessibilityRole="header" aria-level={2} style={styles.label}>{tr("From the literature (citations from PubMed)")}</Text>
          {s.references.map((ref) => (
            <View key={ref.pmid} style={styles.headline}>
              <Text style={styles.headlineTitle}>{ref.title}</Text>
              <Text style={styles.byline}>{[ref.journal, ref.year].filter(Boolean).join(" · ")}</Text>
            </View>
          ))}
        </>
      )}

      {!simple && (
      <View style={{ marginTop: 12 }}>
        <Collapsible title={tr("Go deeper (mechanism / technical)")} defaultOpen={technical}>
          <Text style={styles.body}>{tr(s.technical_note)}</Text>
          {s.concept_tags.map((tag) => {
            const c = concepts[tag];
            if (!c) return null;
            return (
              <Text key={tag} style={styles.conceptText}>
                <Text style={{ fontWeight: "700" }}>{tr(c.name)}: </Text>
                {tr(c.technical)}
              </Text>
            );
          })}
        </Collapsible>
      </View>
      )}

      {!simple && s.regulatory && (
        <View style={{ marginTop: 12 }}>
          <Collapsible title={tr("Official hazard classification")} icon={"🏵️"} defaultOpen={technical} teaser={s.regulatory.cas ? tr("CAS {cas} · government data", { cas: s.regulatory.cas }) : tr("Government data")}>
            <Text style={styles.govNote}>
              {tr("Pulled live from PubChem (NIH/NLM), which aggregates GHS hazard classifications from OSHA and UN sources. These describe the pure, concentrated substance as handled industrially -- not a diluted trace amount in a consumer product.")}
            </Text>
            {s.regulatory.cas && (
              <Text style={styles.bullet}>{tr("• CAS Registry Number: {cas}", { cas: s.regulatory.cas })}</Text>
            )}
            {s.regulatory.ghs_hazards.slice(0, 6).map((h, i) => (
              <Text key={i} style={styles.bullet}>{"•"} {h}</Text>
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
              <Pressable accessibilityRole="link" onPress={() => Linking.openURL(s.regulatory!.pubchem_url)} style={{ paddingVertical: 8 }}>
                <Text style={styles.govLink}>{tr("View on PubChem ›")}</Text>
              </Pressable>
              {s.regulatory.comptox_url && (
                <Pressable accessibilityRole="link" onPress={() => Linking.openURL(s.regulatory!.comptox_url!)} style={{ paddingVertical: 8 }}>
                  <Text style={styles.govLink}>{tr("View on EPA CompTOX Dashboard ›")}</Text>
                </Pressable>
              )}
            </View>
          </Collapsible>
        </View>
      )}
    </Card>
  );
}

export default function LearnScreen({ onDetailChange, initialSegment }: { onDetailChange?: (open: boolean) => void; initialSegment?: "topics" | "research" | "engine" | "concepts" }) {
  const [segment, setSegment] = useState<"topics" | "research" | "engine" | "concepts">(initialSegment ?? "topics");
  const [view, setView] = useState<View_>({ type: "home" });
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [researchOpen, setResearchOpen] = useState(false);
  const level = useContentComplexity();

  const substances = useMemo(() => loadHazardDb(), []);
  const concepts = useMemo(() => Object.values(loadConcepts()), []);
  const byCategory = useMemo(() => {
    const grouped: Record<Category, Substance[]> = { food: [], personal_care: [], environment: [] };
    for (const s of substances) grouped[s.category].push(s);
    for (const c of Object.keys(grouped) as Category[]) grouped[c].sort((a, b) => b.concern_level - a.concern_level);
    return grouped;
  }, [substances]);

  useEffect(() => () => {
    Speech.stop();
    onDetailChange?.(false);
  }, []);

  function go(next: View_) {
    Speech.stop();
    setSpeakingId(null);
    setView(next);
    onDetailChange?.(next.type !== "home");
    if (next.type === "substance") db.recordLearning(`substance:${next.id}`, todayISO());
    else if (next.type === "concept") db.recordLearning(`concept:${next.id}`, todayISO());
    else if (next.type === "pillar") db.recordLearning(`pillar:${next.key}`, todayISO());
  }

  function back() {
    if (view.type === "substance") go({ type: "theme", cat: view.cat });
    else go({ type: "home" });
  }

  const backBar = (label: string) => (
    <Pressable accessibilityRole="button" onPress={back} hitSlop={8} style={{ marginBottom: 10, paddingVertical: 8 }}>
      <Text style={styles.back}>{"‹"} {label}</Text>
    </Pressable>
  );

  let body: React.ReactNode;

  if (view.type === "theme") {
    const theme = THEMES.find((t) => t.key === view.cat)!;
    body = (
      <>
        {backBar(tr("Topics"))}
        <Text accessibilityRole="header" style={styles.h1}>{theme.icon} {tr(theme.title)}</Text>
        <Text style={styles.subtitle}>{tr("{blurb}. Tap any box to read more.", { blurb: tr(theme.blurb) })}</Text>
        <View style={styles.grid}>
          {byCategory[view.cat].map((s) => (
            <Tile key={s.id} icon="" title={tr(s.name)} blurb={truncate(tr(summaryFor(s, level)), 80)} right={<Pill concernLevel={s.concern_level} />} onPress={() => go({ type: "substance", cat: view.cat, id: s.id })} />
          ))}
        </View>
      </>
    );
  } else if (view.type === "substance") {
    const s = substances.find((x) => x.id === view.id)!;
    const openRelated = (id: string) => {
      const target = substances.find((x) => x.id === id);
      if (target) go({ type: "substance", cat: target.category, id: target.id });
    };
    body = (
      <>
        {backBar(tr(THEMES.find((t) => t.key === view.cat)!.title))}
        <SubstanceDetail s={s} onOpenRelated={openRelated} />
      </>
    );
  } else if (view.type === "pillar") {
    const pillar = PILLARS.find((p) => p.key === view.key)!;
    body = (
      <>
        {backBar(tr("Concepts & audio"))}
        <Text accessibilityRole="header" style={styles.h1}>{pillar.icon} {tr(pillar.title)}</Text>
        <Text style={styles.subtitle}>{tr("{tagline}. Read it or press Listen.", { tagline: tr(pillar.tagline) })}</Text>
        {lessonsFor(view.key).map((l: Lesson) => (
          <Card key={l.id}>
            <Text accessibilityRole="header" aria-level={2} style={styles.detailTitle}>{tr(l.title)}</Text>
            <Text style={styles.meta}>{tr("~{minutes} min", { minutes: estimateMinutes(l.script) })}</Text>
            <Text style={styles.body}>{tr(l.script)}</Text>
            <View style={{ marginTop: 12 }}>
              <ListenButton id={l.id} title={tr(l.title)} text={`${tr(l.title)}. ${tr(l.script)}`} speakingId={speakingId} setSpeakingId={setSpeakingId} />
            </View>
          </Card>
        ))}
      </>
    );
  } else if (view.type === "concept") {
    const c = concepts.find((x: Concept) => x.id === view.id)!;
    body = (
      <>
        {backBar(tr("Concepts & audio"))}
        <Card>
          <Text accessibilityRole="header" style={styles.detailTitle}>{tr(c.name)}</Text>
          <Text style={styles.body}>{tr(c.general)}</Text>
          <View style={{ marginTop: 12 }}>
            <ListenButton id={c.id} title={tr(c.name)} text={`${tr(c.name)}. ${tr(c.general)}`} speakingId={speakingId} setSpeakingId={setSpeakingId} />
          </View>
          <View style={{ marginTop: 12 }}>
            <Collapsible title={tr("Go deeper (technical)")}>
              <Text style={styles.body}>{tr(c.technical)}</Text>
            </Collapsible>
          </View>
        </Card>
      </>
    );
  } else {
    body = (
      <>
        <Text accessibilityRole="header" style={styles.h1}>{tr("Learn")}</Text>
        <View style={styles.segment}>
          {(["topics", "research", "engine", "concepts"] as const).map((k) => (
            <Pressable accessibilityRole="tab" key={k} onPress={() => setSegment(k)} aria-selected={!!(segment === k)} style={[styles.segBtn, segment === k && styles.segBtnActive]}>
              <Text style={[styles.segText, segment === k && styles.segTextActive]}>{k === "topics" ? tr("Topics") : k === "research" ? tr("Research") : k === "engine" ? tr("Engine") : tr("Concepts")}</Text>
            </Pressable>
          ))}
        </View>

        {segment === "topics" ? (
          <>
            <Text style={styles.subtitle}>{tr("Headlines from real research, simplified. Pick a theme, then a box.")}</Text>
            <View style={styles.grid}>
              {THEMES.map((t) => (
                <Tile key={t.key} icon={t.icon} title={tr(t.title)} blurb={tr(t.blurb)} right={<Text style={styles.meta}>{trn(byCategory[t.key].length, "{n} topic", "{n} topics")}</Text>} onPress={() => go({ type: "theme", cat: t.key })} />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>{tr("Three pillars of a life you want to protect. Every lesson can be read or listened to.")}</Text>
            <View style={styles.grid}>
              {PILLARS.map((p) => (
                <Tile key={p.key} icon={p.icon} title={tr(p.title)} blurb={tr(p.tagline)} right={<Text style={styles.meta}>{trn(lessonsFor(p.key).length, "{n} lesson", "{n} lessons")}</Text>} onPress={() => go({ type: "pillar", key: p.key })} />
              ))}
            </View>
            <Text accessibilityRole="header" aria-level={2} style={styles.section}>{tr("Toxicology concepts")}</Text>
            <View style={styles.grid}>
              {concepts.map((c: Concept) => (
                <Tile key={c.id} icon="" title={tr(c.name)} blurb={truncate(tr(c.general), 70)} onPress={() => go({ type: "concept", id: c.id })} />
              ))}
            </View>
          </>
        )}
      </>
    );
  }

  if (view.type === "home" && (segment === "research" || segment === "engine")) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {!researchOpen && <View style={{ padding: 16, paddingBottom: 0 }}>
          <Text accessibilityRole="header" style={styles.h1}>{tr("Learn")}</Text>
          <View style={styles.segment}>
            {(["topics", "research", "engine", "concepts"] as const).map((k) => (
              <Pressable accessibilityRole="tab" key={k} onPress={() => setSegment(k)} aria-selected={!!(segment === k)} style={[styles.segBtn, segment === k && styles.segBtnActive]}>
                <Text style={[styles.segText, segment === k && styles.segTextActive]}>{k === "topics" ? tr("Topics") : k === "research" ? tr("Research") : k === "engine" ? tr("Engine") : tr("Concepts")}</Text>
              </Pressable>
            ))}
          </View>
        </View>}
        {segment === "research" ? (
          <EvidenceScreen embedded onDetailChange={(open) => { setResearchOpen(open); onDetailChange?.(open); }} />
        ) : (
          <EngineScreen onDetailChange={(open) => { setResearchOpen(open); onDetailChange?.(open); }} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: view.type === "home" ? 16 : 56 }}>
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  section: { fontSize: 16, fontWeight: "700", color: colors.ink, marginTop: 22, marginBottom: 10 },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  segment: { flexDirection: "row", backgroundColor: colors.segment, borderRadius: radiusSm, padding: 3, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radiusSm, alignItems: "center" },
  segBtnActive: { backgroundColor: colors.card },
  segText: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  segTextActive: { color: colors.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 14, minHeight: 120, ...shadow },
  tileIcon: { fontSize: 26, marginBottom: 4, color: colors.ink },
  tileTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  tileBlurb: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 17 },
  meta: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  detailTitle: { fontSize: 17, fontWeight: "700", color: colors.ink, flex: 1 },
  body: { fontSize: 14, color: colors.ink, marginTop: 8, lineHeight: 21 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 14, marginBottom: 4, textTransform: "uppercase" },
  bullet: { fontSize: 14, color: colors.ink, marginTop: 4, lineHeight: 19 },
  contextNote: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 2, fontStyle: "italic" },
  conceptText: { fontSize: 13, color: colors.ink, marginTop: 8, lineHeight: 19 },
  headline: { marginTop: 8 },
  headlineTitle: { fontSize: 13, fontWeight: "700", color: colors.accent, lineHeight: 18 },
  byline: { fontSize: 12, color: colors.muted, marginTop: 2, fontStyle: "italic" },
  govNote: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 8, fontStyle: "italic" },
  govLink: { fontSize: 13, fontWeight: "700", color: colors.accent },
  swapBox: { backgroundColor: colors.warnSoft, borderRadius: radiusSm, padding: 12, marginTop: 10 },
  swapKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.warn, marginBottom: 6 },
  swapLink: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 2 },
  swapNote: { fontSize: 12, color: colors.muted, lineHeight: 17, marginTop: 6 },
  listen: { alignSelf: "flex-start", borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  listenActive: { backgroundColor: colors.accentFill },
  listenText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
});
