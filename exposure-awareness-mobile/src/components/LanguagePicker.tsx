import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { LANGUAGES, READY, inLanguage, resolveLanguage, tr, type LanguagePreference } from "../i18n";

/**
 * The app's languages, each named in itself, plus following the device. Choosing one changes the app at once; the parent saves it.
 * Used under About you and at the top of the first-run questions, so someone whose phone is set to another language can switch
 * before answering anything. Only languages whose translation is complete are offered (READY); with English alone there is no
 * choice to make, and the places that show this leave it out (see `languageChoiceOffered`).
 */
export const languageChoiceOffered = () => READY.length > 1;

export function LanguagePicker({ value, onChange }: { value: LanguagePreference; onChange: (next: LanguagePreference) => void }) {
  const device = LANGUAGES.find((l) => l.id === resolveLanguage("system"))!;
  return (
    <View style={styles.rowWrap} accessibilityRole="radiogroup" aria-label={tr("Language")}>
      <Pressable accessibilityRole="radio" aria-checked={value === "system"} onPress={() => onChange("system")} style={[styles.chip, value === "system" && styles.chipActive]}>
        <Text style={[styles.chipText, value === "system" && styles.chipTextActive]}>
          {tr("Match my device")} · <Text {...inLanguage(device.id)}>{device.native}</Text>
        </Text>
      </Pressable>
      {LANGUAGES.filter((l) => READY.includes(l.id)).map((l) => (
        <Pressable key={l.id} accessibilityRole="radio" aria-checked={value === l.id} onPress={() => onChange(l.id)} style={[styles.chip, value === l.id && styles.chipActive]}>
          <Text {...inLanguage(l.id)} style={[styles.chipText, value === l.id && styles.chipTextActive]}>{l.native}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.ink, fontSize: 13 },
  chipTextActive: { color: colors.onAccent },
});
