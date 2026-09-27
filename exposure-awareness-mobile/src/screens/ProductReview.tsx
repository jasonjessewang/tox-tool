import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as db from "../storage/db";
import { parseIngredients, type Nutrition } from "../engine/ingredients/parse";
import { matchIngredients } from "../engine/ingredients/match";
import { assessProduct, STANCE_INFO } from "../engine/ingredients/assess";
import { FREQUENCY_INFO, type Frequency, type ProductDraft } from "../engine/ingredients/types";
import { NUTRIENTS } from "../data/dailyValues";
import { scaleNutrition } from "../services/productLookup";
import { SCAN_NOTE_PREFIX } from "../engine/journeyState";
import type { UserProfile } from "../engine/types";
import { PrimaryButton, SecondaryButton } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { colors, radius, radiusSm, shadow, shadowRaised } from "../theme";
import { todayISO as today } from "../util/dates";
import { runActivity, type Receipt } from "../engine/receipts";
import { ReceiptCard } from "../components/ReceiptCard";
import { useContentComplexity } from "../util/complexity";

const FREQS = Object.keys(FREQUENCY_INFO) as Frequency[];
const GRAMS = [15, 30, 50, 100];
const STANCE_COLOR = { accent: colors.accent, warn: colors.warn, danger: colors.notice };

/** One product, one screen: what we read, what it means, how often you use it, and add. */
export default function ProductReview({ draft, onDone, onOpenShelf }: { draft: ProductDraft; onDone: () => void; onOpenShelf: () => void }) {
  const [name, setName] = useState(draft.name);
  const [text, setText] = useState(draft.ingredientsText);
  const [frequency, setFrequency] = useState<Frequency>("few_week");
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(draft.servingGrams ?? 30);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [added, setAdded] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const level = useContentComplexity();

  useEffect(() => {
    db.getUserProfile().then(setProfile);
  }, []);

  const parsed = useMemo(() => parseIngredients(text), [text]);
  const match = useMemo(() => matchIngredients(parsed), [parsed]);
  const assessment = useMemo(
    () => assessProduct({ matches: match.matches, unmatchedCount: match.unmatched.length, kind: draft.kind, nova: draft.nova, frequency, profile }),
    [match, draft.kind, draft.nova, frequency, profile]
  );

  const nutrition: Nutrition | null = draft.nutrition ?? (draft.nutritionPer100g ? scaleNutrition(draft.nutritionPer100g, grams) : null);
  const needsGrams = !draft.nutrition && !!draft.nutritionPer100g;
  const color = STANCE_COLOR[STANCE_INFO[assessment.stance].color];

  async function add() {
    const contains = match.matches.map((m) => m.name).join(", ");
    const notes = `${SCAN_NOTE_PREFIX}${draft.barcode ?? "label"}.${contains ? ` Contains: ${contains}.` : ""}`;
    const { receipt: r } = await runActivity("shelf_change", async () => {
      await db.insertShelfItem({ name: name.trim() || "Unnamed product", brand: draft.brand, kind: draft.kind, barcode: draft.barcode, source: draft.source, ingredientsText: text, nova: draft.nova, nutrition, frequency, servingsPerUse: servings });
      if (draft.kind === "food") await db.insertFoodLog({ log_date: today(), meal: "snack", food_item: name.trim() || "Scanned food", processing_level: draft.nova, notes });
      else await db.insertProductLog({ log_date: today(), product_type: "scanned", product_name: name.trim() || "Scanned product", ingredients_text: contains, notes });
    });
    setReceipt(r);
    setAdded(true);
  }

  if (added) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: "center" }}>
        <Text accessibilityRole="header" aria-level={1} style={styles.addedTitle}>{"✓"} Added to your shelf</Text>
        <Text style={styles.body}>{name} now counts toward your running intake ledger, at the frequency you chose. Change it any time from My shelf.</Text>
        {receipt && (
          <View style={{ marginTop: 16 }}>
            <ReceiptCard receipt={receipt} />
          </View>
        )}
        <View style={{ marginTop: 12, gap: 10 }}>
          <PrimaryButton title="See my ledger" onPress={onOpenShelf} />
          <SecondaryButton title="Scan another" onPress={onDone} />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingTop: 20 }} keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" onPress={onDone} hitSlop={8} style={{ marginBottom: 12, paddingVertical: 8 }}>
        <Text style={styles.back}>{"‹"} Scan</Text>
      </Pressable>
      <TextInput style={styles.nameInput} value={name} onChangeText={setName} accessibilityLabel="Product name" placeholder="Product name" />
      {draft.brand ? <Text style={styles.brand}>{draft.brand}</Text> : null}

      <View style={[styles.stance, { borderColor: color }]}>
        <Text style={[styles.stanceKicker, { color }]}>OUR READ {draft.source === "photo" ? "· FROM YOUR PHOTO" : ""}</Text>
        <Text accessibilityRole="header" aria-level={1} style={styles.stanceHeadline}>{assessment.headline}</Text>
        {assessment.reasons.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {assessment.reasons.slice(0, 4).map((r) => (
              <View key={r.substanceId} style={{ marginTop: 8 }}>
                <Text accessibilityRole="header" aria-level={2} style={styles.reasonName}>{r.name}</Text>
                <Text style={styles.reasonLine}>{level === "simple" ? r.linePlain : r.line}</Text>
              </View>
            ))}
          </View>
        )}
        {assessment.personal.length > 0 && (
          <View style={styles.personal}>
            <Text style={styles.personalKicker}>WHY IT MAY MATTER MORE FOR YOU</Text>
            {assessment.personal.slice(0, 2).map((p) => (
              <Text key={p.substance} style={styles.reasonLine}>
                <Text style={{ fontWeight: "700" }}>{p.substance}: </Text>
                {p.reasons[0].reason}
              </Text>
            ))}
          </View>
        )}
      </View>

      {assessment.substitutions.length > 0 && (
        <View style={styles.substitution}>
          <Text accessibilityRole="header" aria-level={2} style={styles.substitutionKicker}>{"⇄"} LOOKS LIKE A SWAP-IN</Text>
          {assessment.substitutions.map((sub) => (
            <Text key={`${sub.substanceId}-${sub.relatedId}`} style={styles.substitutionLine}>
              <Text style={{ fontWeight: "700" }}>{sub.substanceName}</Text> is a close chemical relative of <Text style={{ fontWeight: "700" }}>{sub.relatedName}</Text>, often used in its place. Research comparing the two generally finds similar, not reduced, concern -- so it's worth weighing this the same way you'd weigh {sub.relatedName}.
            </Text>
          ))}
        </View>
      )}

      {assessment.suggestions.length > 0 && (
        <View style={styles.card}>
          <Text accessibilityRole="header" aria-level={2} style={styles.kicker}>IF YOU WANT TO CHANGE IT</Text>
          {assessment.suggestions.map((s, i) => (
            <Text key={i} style={styles.bullet}>{"→"} {s}</Text>
          ))}
        </View>
      )}

      <Text accessibilityRole="header" aria-level={2} style={styles.label}>How often do you use it?</Text>
      <View style={styles.chips}>
        {FREQS.map((f) => (
          <Pressable accessibilityRole="radio" key={f} onPress={() => setFrequency(f)} aria-checked={!!(frequency === f)} style={[styles.chip, frequency === f && styles.chipOn]}>
            <Text style={[styles.chipText, frequency === f && { color: "#fff" }]}>{FREQUENCY_INFO[f].label}</Text>
          </Pressable>
        ))}
      </View>

      {draft.kind === "food" && (
        <>
          <Text style={styles.label}>Servings each time</Text>
          <View style={styles.chips}>
            {[0.5, 1, 2].map((n) => (
              <Pressable accessibilityRole="radio" key={n} onPress={() => setServings(n)} aria-checked={!!(servings === n)} style={[styles.chip, servings === n && styles.chipOn]}>
                <Text style={[styles.chipText, servings === n && { color: "#fff" }]}>{n}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {needsGrams && (
        <>
          <Text style={styles.label}>How much is one serving? (grams)</Text>
          <View style={styles.chips}>
            {GRAMS.map((g) => (
              <Pressable accessibilityRole="radio" key={g} onPress={() => setGrams(g)} aria-checked={!!(grams === g)} style={[styles.chip, grams === g && styles.chipOn]}>
                <Text style={[styles.chipText, grams === g && { color: "#fff" }]}>{g} g</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {nutrition && (
        <View style={styles.card}>
          <Text style={styles.kicker}>PER SERVING {nutrition.servingLabel ? `(${nutrition.servingLabel})` : ""}</Text>
          {NUTRIENTS.map((n) => {
            const v = nutrition[n.key];
            if (typeof v !== "number") return null;
            return (
              <View key={n.key} style={styles.nRow}>
                <Text style={styles.nLabel}>{n.label}</Text>
                <Text style={styles.nValue}>{Math.round(v * 10) / 10} {n.unit} <Text style={styles.nPct}>{Math.round((v / n.dv) * 100)}% DV</Text></Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 14 }}>
        <Collapsible title={draft.source === "photo" ? "Check what we read from your photo" : "Ingredients we're using"} teaser={`${parsed.filter((p) => !p.parent).length} ingredients`} defaultOpen={draft.source !== "barcode"}>
          {draft.source === "photo" && <Text style={styles.note}>Photo reading can misread small print. Fix any mistakes -- the read above updates as you edit.</Text>}
          <TextInput style={styles.textArea} value={text} onChangeText={setText} multiline accessibilityLabel="Ingredients list" placeholder="Ingredients" />
        </Collapsible>
      </View>

      <View style={{ marginTop: 14 }}>
        {assessment.caveats.map((c, i) => (
          <Text key={i} style={styles.caveat}>{c}</Text>
        ))}
      </View>

      <View style={{ marginTop: 18, marginBottom: 30 }}>
        <PrimaryButton title="Add to my shelf" onPress={add} disabled={!text.trim() && !nutrition} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { fontSize: 16, fontWeight: "600", color: colors.accent },
  nameInput: { fontSize: 22, fontWeight: "700", color: colors.ink, paddingVertical: 4 },
  brand: { fontSize: 13, color: colors.muted, marginTop: 2 },
  stance: { backgroundColor: colors.card, borderWidth: 2, borderRadius: radius, padding: 16, marginTop: 14, ...shadowRaised },
  stanceKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1 },
  stanceHeadline: { fontSize: 20, fontWeight: "700", color: colors.ink, marginTop: 6, lineHeight: 26 },
  reasonName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  reasonLine: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 2 },
  personal: { marginTop: 14, backgroundColor: colors.accentSoft, borderRadius: radiusSm, padding: 12 },
  personalKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.accent, marginBottom: 4 },
  substitution: { backgroundColor: colors.warnSoft, borderRadius: radiusSm, padding: 14, marginTop: 12 },
  substitutionKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: colors.warn, marginBottom: 6 },
  substitutionLine: { fontSize: 13, color: colors.ink, lineHeight: 19, marginTop: 6 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 16, marginTop: 12, ...shadow },
  kicker: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: colors.muted },
  bullet: { fontSize: 14, color: colors.ink, lineHeight: 21, marginTop: 8 },
  label: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  nRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 6 },
  nLabel: { fontSize: 14, color: colors.ink },
  nValue: { fontSize: 14, fontWeight: "600", color: colors.ink },
  nPct: { fontSize: 12, color: colors.muted, fontWeight: "400" },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 8, fontStyle: "italic" },
  textArea: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 14, minHeight: 100, backgroundColor: "#fff", textAlignVertical: "top" },
  caveat: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 4, fontStyle: "italic" },
  addedTitle: { fontSize: 24, fontWeight: "700", color: colors.accent },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22, marginTop: 10 },
});
