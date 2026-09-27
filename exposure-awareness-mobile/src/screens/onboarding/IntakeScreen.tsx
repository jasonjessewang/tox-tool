import React, { useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { PrimaryButton, Card } from "../../components/ui";
import { colors, radiusSm } from "../../theme";
import type { UserProfile, Condition } from "../../engine/types";

const CONDITIONS: { key: Condition; label: string }[] = [
  { key: "asthma", label: "Asthma / respiratory" },
  { key: "kidney", label: "Kidney condition" },
  { key: "liver", label: "Liver condition" },
  { key: "immunocompromised", label: "Immunocompromised" },
  { key: "fragrance_sensitivity", label: "Fragrance/chemical sensitivity" },
];

function Chip({ label, active, onPress, single = false }: { label: string; active: boolean; onPress: () => void; single?: boolean }) {
  return (
    <Pressable accessibilityRole={single ? "radio" : "checkbox"} onPress={onPress} aria-checked={!!(active)} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function IntakeScreen({
  initial,
  onContinue,
  continueLabel = "Continue",
  extraSection,
}: {
  initial: Partial<UserProfile> | null;
  onContinue: (profile: Omit<UserProfile, "contentComplexity" | "completedAt" | "locationEnabled" | "checkInTime">) => void;
  continueLabel?: string;
  extraSection?: React.ReactNode;
}) {
  const [age, setAge] = useState(initial?.ageYears ? String(initial.ageYears) : "");
  const [sex, setSex] = useState<UserProfile["sex"]>(initial?.sex ?? null);
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [weight, setWeight] = useState(initial?.weightKg ? String(Math.round(initial.weightKg)) : "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "in">("cm");
  const [height, setHeight] = useState(initial?.heightCm ? String(Math.round(initial.heightCm)) : "");
  const [pregnant, setPregnant] = useState(initial?.pregnant ?? false);
  const [breastfeeding, setBreastfeeding] = useState(initial?.breastfeeding ?? false);
  const [conditions, setConditions] = useState<Condition[]>(initial?.conditions ?? []);
  const [noneConditions, setNoneConditions] = useState(false);

  function toggleCondition(key: Condition) {
    setNoneConditions(false);
    setConditions((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  }

  function toggleNone() {
    setNoneConditions(!noneConditions);
    setConditions([]);
  }

  function submit() {
    const ageYears = age.trim() ? parseInt(age, 10) : null;
    const weightNum = weight.trim() ? parseFloat(weight) : null;
    const heightNum = height.trim() ? parseFloat(height) : null;
    onContinue({
      ageYears: ageYears && ageYears > 0 && ageYears < 130 ? ageYears : null,
      sex,
      weightKg: weightNum ? (weightUnit === "lb" ? weightNum * 0.453592 : weightNum) : null,
      heightCm: heightNum ? (heightUnit === "in" ? heightNum * 2.54 : heightNum) : null,
      pregnant,
      breastfeeding,
      conditions,
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header" style={styles.h1}>A few quick things</Text>
      <Text style={styles.subtitle}>
        Helps tailor which flagged items matter more for you specifically -- e.g. kidney/liver conditions,
        pregnancy, and age all change which exposures are worth extra attention. Everything here is optional
        and stored only on this device.
      </Text>

      <Card>
        <Text style={styles.label}>Age</Text>
        <TextInput style={styles.input} value={age} onChangeText={setAge} accessibilityLabel="Age in years" placeholder="e.g. 34" keyboardType="number-pad" />

        <Text style={styles.label}>Sex (for physiological reference ranges)</Text>
        <View style={styles.rowWrap}>
          <Chip single label="Female" active={sex === "female"} onPress={() => setSex("female")} />
          <Chip single label="Male" active={sex === "male"} onPress={() => setSex("male")} />
          <Chip single label="Prefer not to say" active={sex === "unspecified"} onPress={() => setSex("unspecified")} />
        </View>

        <Text style={styles.label}>Weight</Text>
        <View style={styles.rowInline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Weight"
            value={weight}
            onChangeText={setWeight}
            placeholder={weightUnit === "kg" ? "e.g. 70" : "e.g. 155"}
            keyboardType="decimal-pad"
          />
          <Chip single label="kg" active={weightUnit === "kg"} onPress={() => setWeightUnit("kg")} />
          <Chip single label="lb" active={weightUnit === "lb"} onPress={() => setWeightUnit("lb")} />
        </View>

        <Text style={styles.label}>Height (optional)</Text>
        <View style={styles.rowInline}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Height"
            value={height}
            onChangeText={setHeight}
            placeholder={heightUnit === "cm" ? "e.g. 170" : "e.g. 67"}
            keyboardType="decimal-pad"
          />
          <Chip single label="cm" active={heightUnit === "cm"} onPress={() => setHeightUnit("cm")} />
          <Chip single label="in" active={heightUnit === "in"} onPress={() => setHeightUnit("in")} />
        </View>

        <Text style={styles.label}>If applicable (optional)</Text>
        <View style={styles.rowWrap}>
          <Chip label="Pregnant" active={pregnant} onPress={() => setPregnant(!pregnant)} />
          <Chip label="Breastfeeding" active={breastfeeding} onPress={() => setBreastfeeding(!breastfeeding)} />
        </View>

        <Text style={styles.label}>Any of these apply to you? (optional)</Text>
        <View style={styles.rowWrap}>
          {CONDITIONS.map((c) => (
            <Chip key={c.key} label={c.label} active={conditions.includes(c.key)} onPress={() => toggleCondition(c.key)} />
          ))}
          <Chip label="None of these" active={noneConditions} onPress={toggleNone} />
        </View>
      </Card>

      {extraSection}

      <Text style={styles.privacy}>Your answers stay on this device and are never sent anywhere. You can change them, export them or delete them any time under About you.</Text>

      <PrimaryButton title={continueLabel} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  subtitle: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 15, backgroundColor: "#fff" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowInline: { flexDirection: "row", gap: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: "#fff" },
  privacy: { fontSize: 12, color: colors.muted, textAlign: "center", marginVertical: 12 },
});
