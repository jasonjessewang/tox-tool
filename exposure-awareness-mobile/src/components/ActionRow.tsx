import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SecondaryButton } from "./ui";
import { colors } from "../theme";
import { tr } from "../i18n";

/**
 * Compact-by-default recommendation row: one line visible (the tip itself, truncated),
 * tap to expand the source + "Mark as done" button. Cuts the default vertical footprint
 * of This Week's Focus / Quick Wins from ~4 lines per item to 1.
 *
 * `via` names the shelf products behind a tip, `viaPlaces` the places. `onKeep` offers the other honest answer to advice:
 * "I've looked at this and I'm leaving it as it is" -- the person decides, and the tip stops
 * coming back for a while instead of repeating every week.
 */
export function ActionRow({
  tip,
  source,
  meta,
  via,
  viaPlaces,
  onOpenPlaces,
  completed,
  onMarkDone,
  onKeep,
  keepDays,
}: {
  tip: string;
  source: string;
  meta?: string;
  via?: string[];
  viaPlaces?: string[];
  /** when the tip comes from a place: opens Places, so an answer that has changed can be updated */
  onOpenPlaces?: () => void;
  completed: boolean;
  onMarkDone: () => void;
  onKeep?: () => void;
  keepDays?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable accessibilityRole="button" aria-expanded={open} onPress={() => setOpen(!open)} style={styles.row}>
        <View style={[styles.dot, completed && styles.dotDone]} />
        <Text style={styles.tip} numberOfLines={open ? undefined : 1}>
          {tr(tip)}
        </Text>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open && (
        <View style={styles.detail}>
          <Text style={styles.source}>
            {tr("re: {source}", { source: tr(source) })}
            {meta ? ` · ${meta}` : ""}
          </Text>
          {via && via.length > 0 && <Text style={styles.via}>{tr("On your shelf: {via}", { via: via.map((v) => tr(v)).join(", ") })}</Text>}
          {viaPlaces && viaPlaces.length > 0 && <Text style={styles.via}>{tr("In your places: {places}", { places: viaPlaces.map((v) => tr(v)).join("; ") })}</Text>}
          <View style={{ marginTop: 6, gap: 6 }}>
            <SecondaryButton title={completed ? tr("Mark done again") : tr("Mark as done")} onPress={onMarkDone} />
            {onKeep && <SecondaryButton title={tr("I'm keeping this")} onPress={onKeep} />}
            {onOpenPlaces && viaPlaces && viaPlaces.length > 0 && <SecondaryButton title={tr("Update my answer in Places")} onPress={onOpenPlaces} />}
          </View>
          {onKeep && <Text style={styles.keepNote}>{keepDays ? tr("Keeping it is a fine answer. It stays out of your focus for {days} days -- you can bring it back any time.", { days: keepDays }) : tr("Keeping it is a fine answer. It stays out of your focus -- you can bring it back any time.")}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotDone: { backgroundColor: colors.accent },
  tip: { flex: 1, fontSize: 13, color: colors.ink, lineHeight: 18 },
  chevron: { fontSize: 12, color: colors.muted },
  detail: { paddingLeft: 16, paddingBottom: 8 },
  source: { fontSize: 12, color: colors.muted, textTransform: "uppercase" },
  via: { fontSize: 12, color: colors.ink, marginTop: 4 },
  keepNote: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 15 },
});
