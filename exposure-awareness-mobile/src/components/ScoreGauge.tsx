import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { colors } from "../theme";
import { useReduceMotion } from "../util/motion";
import { tr } from "../i18n";

const TICKS = 28;
const START_DEG = -110;
const END_DEG = 110;

/**
 * A speedometer-style dial built from rotated tick Views (same technique as PlantView's
 * leaf rotation, already verified rendering correctly) -- no SVG dependency. Filled ticks
 * up to `score` are colored; the rest are the track color.
 */
export default function ScoreGauge({ score, color, size = 200, caption = "/ 100", dim = false }: { score: number | null; color: string; size?: number; caption?: string; dim?: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    Animated.timing(anim, { toValue: score ?? 0, duration: reduceMotion ? 0 : 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [score, anim, reduceMotion]);

  const tickLen = size * 0.1;
  const tickW = size * 0.026;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={score === null ? tr("Wellness score: not enough recorded yet to give a number") : (dim ? tr("Wellness score {score} out of 100, an early reading", { score: Math.round(score) }) : tr("Wellness score {score} out of 100", { score: Math.round(score) }))}
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <View style={[styles.rim, { width: size, height: size, borderRadius: size / 2 }]} />
      {Array.from({ length: TICKS }, (_, i) => {
        const angle = START_DEG + (i / (TICKS - 1)) * (END_DEG - START_DEG);
        const threshold = (i / (TICKS - 1)) * 100;
        const opacity = anim.interpolate({ inputRange: [threshold - 3, threshold], outputRange: [0.18, dim ? 0.55 : 1], extrapolate: "clamp" });
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", width: size, height: size, transform: [{ rotate: `${angle}deg` }] }}>
            <Animated.View style={{ width: tickW, height: tickLen, borderRadius: tickW / 2, backgroundColor: color, alignSelf: "center", opacity }} />
          </View>
        );
      })}
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.num, { fontSize: size * 0.24, color, opacity: dim ? 0.6 : 1 }]}>{score === null ? "\u2014" : Math.round(score)}</Text>
        <Text style={styles.of}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rim: { position: "absolute", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  center: { alignItems: "center" },
  num: { fontWeight: "700" },
  of: { fontSize: 12, color: colors.muted, marginTop: -4, fontWeight: "600" },
});
