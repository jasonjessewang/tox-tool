import React from "react";
import { View, Text, Pressable, StyleSheet, ViewStyle } from "react-native";
import { colors, radius, radiusPill, spacing, shadow, concernPill, ACCENT_SHADOW } from "../theme";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({ concernLevel }: { concernLevel: number }) {
  const p = concernPill[concernLevel] ?? concernPill[2];
  return (
    <View style={[styles.pill, { backgroundColor: p.bg }]}>
      <Text style={[styles.pillText, { color: p.fg }]}>{p.label}</Text>
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, disabled && styles.buttonDisabled, pressed && { opacity: 0.85 }]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

/** `label` is for a button that repeats down a list ("Bring back"): it says which one, for someone who cannot see the row it sits in. */
export function SecondaryButton({ title, onPress, label }: { title: string; onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.7 }]}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function ScoreTile({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

/**
 * Says what is missing, in words, where the person is looking. A screen reader announces it (alert + polite live region), and it is
 * never red: an empty field is not an emergency.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" aria-live="polite" style={styles.formError}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  pill: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radiusPill, alignSelf: "flex-start" },
  pillText: { fontSize: 12, fontWeight: "600" },
  button: {
    backgroundColor: colors.accentFill,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radiusPill,
    alignItems: "center",
    shadowColor: ACCENT_SHADOW,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0 },
  buttonText: { color: colors.onAccent, fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radiusPill,
    alignSelf: "flex-start",
    backgroundColor: colors.card,
  },
  secondaryButtonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  tile: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius,
    padding: spacing.md,
    flexGrow: 1,
    flexBasis: "45%",
    marginBottom: spacing.sm,
    ...shadow,
  },
  tileLabel: { fontSize: 12, color: colors.muted, textTransform: "uppercase", marginBottom: 4 },
  tileValue: { fontSize: 22, fontWeight: "700", color: colors.ink },
  tileSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: spacing.md, lineHeight: 19 },
  formError: { fontSize: 13, fontWeight: "600", color: colors.warn, marginTop: spacing.sm, lineHeight: 18 },
});
