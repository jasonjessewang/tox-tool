import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { PrimaryButton, SecondaryButton } from "./ui";
import { colors, radiusPill, radiusSm } from "../theme";
import { newOccupant } from "../engine/places/state";
import type { Occupant } from "../engine/places/types";
import type { Condition } from "../engine/types";

const CONDITION_CHIPS: { key: Condition; label: string }[] = [
  { key: "asthma", label: "Asthma" },
  { key: "immunocompromised", label: "Weakened immunity" },
  { key: "kidney", label: "Kidney condition" },
  { key: "liver", label: "Liver condition" },
  { key: "fragrance_sensitivity", label: "Fragrance sensitivity" },
];

const describe = (o: Occupant) => {
  if (o.isPet) return "Pet";
  const bits = [o.ageYears !== null ? `${o.ageYears}` : null, o.pregnant ? "pregnant" : null, ...o.conditions.map((c) => CONDITION_CHIPS.find((x) => x.key === c)?.label.toLowerCase() ?? c)].filter(Boolean);
  return bits.length ? bits.join(" · ") : "Nothing that changes what matters most";
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" aria-checked={on} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.accent, fontWeight: "700" }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The people (and pets) who share a home. Nothing here is required: it only changes which findings count a little more
 * ("who does this matter most for?"), and it never leaves the device.
 */
export function HouseholdEditor({ occupants, onSave, onRemove }: { occupants: Occupant[]; onSave: (o: Occupant) => void; onRemove: (id: string) => void }) {
  const [draft, setDraft] = useState<Occupant | null>(null);

  const start = () => setDraft(newOccupant({ label: "" }));
  const commit = () => {
    if (!draft) return;
    const label = draft.label.trim() || (draft.isPet ? "Pet" : "Someone");
    onSave({ ...draft, label, ageYears: draft.isPet ? null : draft.ageYears, pregnant: draft.isPet ? false : draft.pregnant, conditions: draft.isPet ? [] : draft.conditions });
    setDraft(null);
  };

  return (
    <View>
      {occupants.length === 0 && !draft && <Text style={styles.note}>You are counted through your own profile. Add anyone who shares your home if something matters more for them.</Text>}
      {occupants.map((o) => (
        <View key={o.id} style={styles.person}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{o.isPet ? "🐾 " : ""}{o.label}</Text>
            <Text style={styles.detail}>{describe(o)}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${o.label}`} onPress={() => setDraft(o)} style={styles.linkHit}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${o.label}`} onPress={() => onRemove(o.id)} style={[styles.linkHit, { marginLeft: 6 }]}>
            <Text style={styles.link}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {draft ? (
        <View style={styles.form}>
          <TextInput style={styles.input} value={draft.label} onChangeText={(label) => setDraft({ ...draft, label })} accessibilityLabel="Name or role" placeholder={draft.isPet ? "Name (e.g. Miso)" : "Name or role (e.g. Priya, my daughter)"} />
          <View style={styles.chips}>
            <Chip label="A pet" on={draft.isPet} onPress={() => setDraft({ ...draft, isPet: !draft.isPet })} />
          </View>
          {!draft.isPet && (
            <>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={draft.ageYears === null ? "" : String(draft.ageYears)}
                onChangeText={(t) => {
                  const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
                  setDraft({ ...draft, ageYears: Number.isFinite(n) ? Math.min(120, n) : null });
                }}
                accessibilityLabel="Age in years"
                placeholder="Age in years (optional)"
                keyboardType="number-pad"
              />
              <View style={styles.chips}>
                <Chip label="Pregnant" on={draft.pregnant} onPress={() => setDraft({ ...draft, pregnant: !draft.pregnant })} />
                {CONDITION_CHIPS.map((c) => (
                  <Chip
                    key={c.key}
                    label={c.label}
                    on={draft.conditions.includes(c.key)}
                    onPress={() => setDraft({ ...draft, conditions: draft.conditions.includes(c.key) ? draft.conditions.filter((x) => x !== c.key) : [...draft.conditions, c.key] })}
                  />
                ))}
              </View>
            </>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton title="Save" onPress={commit} />
            <SecondaryButton title="Cancel" onPress={() => setDraft(null)} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
          <SecondaryButton title="Add someone who shares this home" onPress={start} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  person: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  name: { fontSize: 14, fontWeight: "600", color: colors.ink },
  detail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  link: { fontSize: 12, color: colors.accent, textDecorationLine: "underline" },
  // a target of at least 40 x 32, so a finger or pointer does not have to be exact
  linkHit: { minWidth: 40, minHeight: 32, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  form: { marginTop: 10, padding: 12, borderRadius: radiusSm, backgroundColor: "#f3efe4" },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 14, color: colors.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: radiusPill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 12, color: colors.ink },
});
