import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import type { PlantHealth, PlantStage } from "../engine/plant";
import { useReduceMotion } from "../util/motion";

const PALETTE = {
  thriving: { leaf: "#4f9a67", leafLight: "#6fb883", stem: "#3f7d55", glow: "#fbf1c9" },
  thirsty: { leaf: "#a9b25c", leafLight: "#bfc673", stem: "#8b9257", glow: "#f1eedc" },
  wilting: { leaf: "#b39a5c", leafLight: "#c4ad74", stem: "#8a7a52", glow: "#ece8de" },
} as const;

interface LeafSpec {
  t: number; // 0..1 up the stem
  side: 1 | -1;
  w: number; // fraction of size
}

const LEAVES: Record<PlantStage, LeafSpec[]> = {
  seed: [],
  sprout: [
    { t: 1, side: 1, w: 0.11 },
    { t: 1, side: -1, w: 0.11 },
  ],
  seedling: [
    { t: 0.55, side: 1, w: 0.14 },
    { t: 0.55, side: -1, w: 0.14 },
    { t: 1, side: 1, w: 0.12 },
    { t: 1, side: -1, w: 0.12 },
  ],
  sapling: [
    { t: 0.3, side: 1, w: 0.17 },
    { t: 0.3, side: -1, w: 0.17 },
    { t: 0.62, side: 1, w: 0.16 },
    { t: 0.62, side: -1, w: 0.16 },
    { t: 1, side: 1, w: 0.13 },
    { t: 1, side: -1, w: 0.13 },
  ],
  mature: [
    { t: 0.25, side: 1, w: 0.17 },
    { t: 0.25, side: -1, w: 0.17 },
    { t: 0.5, side: 1, w: 0.16 },
    { t: 0.5, side: -1, w: 0.16 },
  ],
};

const STEM_H: Record<PlantStage, number> = { seed: 0, sprout: 0.14, seedling: 0.26, sapling: 0.4, mature: 0.5 };

// canopy circles for the full-grown tree: [dx, dy, diameter] as fractions of size
const CANOPY: [number, number, number][] = [
  [0, 0.06, 0.4],
  [-0.15, 0.0, 0.3],
  [0.15, 0.0, 0.3],
  [-0.08, 0.16, 0.28],
  [0.09, 0.16, 0.28],
];
const FRUIT_SLOTS: [number, number][] = [
  [-0.14, 0.05],
  [0.13, 0.09],
  [0.0, 0.2],
];

/** Hand-drawn plant from plain Views -- no image assets, scales with `size`. */
export default function PlantView({ stage, health, fruits, size = 220 }: { stage: PlantStage; health: PlantHealth; fruits: number; size?: number }) {
  const c = PALETTE[health];
  const sway = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (health !== "thriving" || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [health, sway, reduceMotion]);
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ["-1.5deg", "1.5deg"] });

  const potW = size * 0.42;
  const potH = size * 0.17;
  const rimH = size * 0.045;
  const base = potH + rimH; // stem starts on top of the pot
  const stemH = STEM_H[stage] * size * (health === "wilting" ? 0.9 : 1);
  const stemW = Math.max(4, size * 0.03);
  const cx = size / 2;
  const droop = health === "wilting" ? 38 : health === "thirsty" ? 14 : 0;
  const mature = stage === "mature";
  const topY = base + stemH;

  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size * 1.05, alignItems: "center" }}>
      <View style={{ position: "absolute", top: size * 0.08, width: size * 0.78, height: size * 0.78, borderRadius: size, backgroundColor: c.glow, opacity: 0.8 }} />

      <Animated.View style={{ position: "absolute", left: 0, bottom: 0, width: size, height: size, transform: [{ rotate: health === "thriving" ? rotate : "0deg" }] }}>
        {/* stem */}
        {stemH > 0 && (
          <View style={{ position: "absolute", left: cx - stemW / 2, bottom: base, width: stemW, height: stemH, backgroundColor: c.stem, borderRadius: stemW }} />
        )}

        {/* leaves */}
        {LEAVES[stage].map((l, i) => {
          const w = l.w * size;
          const h = w * 0.58;
          const angle = l.side * -(28 - droop * 1.6 - (l.t < 0.5 ? 0 : 6));
          return (
            <View
              key={i}
              style={{
                position: "absolute",
                bottom: base + l.t * stemH - (l.t === 1 ? 0 : h / 2),
                left: l.side === 1 ? cx : cx - w,
                width: w,
                height: h,
                backgroundColor: i % 2 === 0 ? c.leaf : c.leafLight,
                borderTopLeftRadius: l.side === 1 ? w : 2,
                borderBottomRightRadius: l.side === 1 ? w : 2,
                borderTopRightRadius: l.side === 1 ? 2 : w,
                borderBottomLeftRadius: l.side === 1 ? 2 : w,
                transform: [{ rotate: `${angle}deg` }],
              }}
            />
          );
        })}

        {/* canopy + fruit for the full-grown tree */}
        {mature &&
          CANOPY.map(([dx, dy, d], i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: cx + dx * size - (d * size) / 2,
                bottom: topY - size * 0.1 + dy * size,
                width: d * size * (health === "wilting" ? 0.82 : 1),
                height: d * size * (health === "wilting" ? 0.82 : 1),
                borderRadius: d * size,
                backgroundColor: i % 2 === 0 ? c.leaf : c.leafLight,
                opacity: health === "wilting" ? 0.9 : 1,
              }}
            />
          ))}
        {mature &&
          FRUIT_SLOTS.slice(0, fruits).map(([dx, dy], i) => (
            <View
              key={`f${i}`}
              style={{
                position: "absolute",
                left: cx + dx * size - size * 0.04,
                bottom: topY - size * 0.02 + dy * size,
                width: size * 0.08,
                height: size * 0.08,
                borderRadius: size,
                backgroundColor: "#d24a3d",
                borderWidth: 1.5,
                borderColor: "#a93428",
              }}
            />
          ))}

        {/* seed on the soil */}
        {stage === "seed" && (
          <View style={{ position: "absolute", left: cx - size * 0.035, bottom: base - 2, width: size * 0.07, height: size * 0.045, borderRadius: size, backgroundColor: "#8a6a45" }} />
        )}
      </Animated.View>

      {/* pot */}
      <View style={{ position: "absolute", bottom: 0, width: potW, height: potH, backgroundColor: "#b8734a", borderBottomLeftRadius: potW * 0.18, borderBottomRightRadius: potW * 0.18 }} />
      <View style={{ position: "absolute", bottom: potH - 1, width: potW * 1.1, height: rimH, backgroundColor: "#c98559", borderRadius: 4 }} />
      <View style={{ position: "absolute", bottom: potH + rimH - 2, width: potW * 0.92, height: 4, backgroundColor: "#5b4030", borderRadius: 2 }} />

      {health !== "thriving" && (
        <Text style={{ position: "absolute", right: size * 0.08, top: size * 0.12, fontSize: size * 0.14 }}>{"💧"}</Text>
      )}
      {health === "thriving" && stage !== "seed" && (
        <Text style={{ position: "absolute", right: size * 0.06, top: size * 0.06, fontSize: size * 0.12 }}>{"☀️"}</Text>
      )}
    </View>
  );
}
