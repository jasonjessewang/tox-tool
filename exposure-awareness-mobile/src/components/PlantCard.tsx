import React from "react";
import { View, Text, StyleSheet } from "react-native";
import PlantView from "./PlantView";
import type { PlantState, PlantNeed } from "../engine/plant";
import { colors, radiusLg, shadow } from "../theme";
import { tr } from "../i18n";

const NEED_EMOJI: Record<PlantNeed, string> = { water: "\ud83d\udca7", learn: "\ud83d\udcd6", checkin: "\u2600\ufe0f" };

/** Compact: the plant on the left, one line of state on the right. */
export default function PlantCard({ plant }: { plant: PlantState }) {
  return (
    <View style={styles.card}>
      <PlantView stage={plant.stage} health={plant.health} fruits={plant.fruits} size={128} />
      <View style={styles.text}>
        <Text style={styles.stage}>
          {tr(plant.stageLabel)}
          {plant.fruits > 0 ? `  ${"\ud83c\udf4e".repeat(plant.fruits)}` : ""}
        </Text>
        <Text style={styles.message}>{plant.message}</Text>
        {plant.needs.length > 0 && (
          <Text style={styles.needs}>{tr("Needs: {map}", { map: plant.needs.map((n) => NEED_EMOJI[n]).join("  ") })}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: colors.calmCard, borderRadius: radiusLg, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: colors.calmLine, ...shadow },
  text: { flex: 1, marginLeft: 8 },
  stage: { fontSize: 17, fontWeight: "700", color: colors.ink },
  message: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 3 },
  needs: { fontSize: 12, fontWeight: "600", color: colors.warn, marginTop: 6 },
});
