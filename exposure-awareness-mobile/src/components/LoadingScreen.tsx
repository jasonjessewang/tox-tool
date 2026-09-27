import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Pressable, StyleSheet } from "react-native";
import { KIND_LABEL, WISDOM, wisdomForTier } from "../data/wisdom";
import { getLiteracy } from "../engine/literacyState";
import { colors, shadowRaised } from "../theme";
import BrandMark from "./BrandMark";
import { useReduceMotion } from "../util/motion";

const ROTATE_MS = 5500;

/** Calm interstitial: a slowly breathing circle over soft layered shapes, with one
 * toxicology quote / historical moment / concept at a time. Used at launch, between tabs,
 * and while the engine works. */
export default function LoadingScreen({
  message = "Preparing your view",
  minMs,
  onDone,
  onLearnMore,
}: {
  message?: string;
  minMs?: number;
  onDone?: () => void;
  /** When provided (launch/transition screens only), shows a "Learn more" link that
   * navigates to the Learn tab instead of waiting out the timer. */
  onLearnMore?: () => void;
}) {
  const interactive = minMs !== undefined && onDone !== undefined;
  const [progress, setProgress] = useState(0);
  const [pinned, setPinned] = useState(false);
  const [holding, setHolding] = useState(false);
  const paused = pinned || holding;
  const [rotation, setRotation] = useState(WISDOM);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * WISDOM.length));
  const breathe = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return; // a device set to less motion gets a still orb
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe, reduceMotion]);

  useEffect(() => {
    let alive = true;
    getLiteracy().then((l) => alive && setRotation(wisdomForTier(l.tier)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!interactive || paused) return;
    const TICK = 50;
    const t = setInterval(() => setProgress((p) => Math.min(1, p + TICK / minMs!)), TICK);
    return () => clearInterval(t);
  }, [interactive, paused, minMs]);

  useEffect(() => {
    if (interactive && progress >= 1) onDone!();
  }, [interactive, progress, onDone]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: reduceMotion ? 0 : 700, useNativeDriver: true }).start();
  }, [index, fade, reduceMotion]);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [index, paused]);

  const w = rotation[((index % rotation.length) + rotation.length) % rotation.length];
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] });
  const haloScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const haloOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.1] });

  const Wrapper: React.ElementType = interactive ? Pressable : View;
  const wrapperProps = interactive
    ? { onPressIn: () => setHolding(true), onPressOut: () => setHolding(false), onPress: () => setPinned((p) => !p), accessible: false }
    : {};

  return (
    <Wrapper style={styles.screen} {...wrapperProps}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <BrandMark size={22} color={colors.accent} style={styles.brand} />

      <View style={styles.orbWrap}>
        <Animated.View style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity }]} />
        <Animated.View style={[styles.orb, { transform: [{ scale }] }]}>
          <Text style={styles.orbIcon}>{w.icon}</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.card, { opacity: fade }]}>
        <Text style={styles.kind}>{KIND_LABEL[w.kind].toUpperCase()}</Text>
        {w.year ? <Text style={styles.year}>{w.year}</Text> : null}
        <Text style={styles.text}>{w.kind === "quote" ? `“${w.text}”` : w.text}</Text>
        {w.attribution ? <Text style={styles.attribution}>{w.kind === "quote" ? `— ${w.attribution}` : w.attribution}</Text> : null}
      </Animated.View>

      {interactive ? (
        <View style={styles.bar} pointerEvents="none">
          <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, opacity: paused ? 0.55 : 1 }]} />
        </View>
      ) : (
        <Text style={styles.message}>{message}...</Text>
      )}

      {interactive && onLearnMore ? (
        <Pressable accessibilityRole="button" onPress={onLearnMore} hitSlop={10} style={styles.learnMore}>
          <Text style={styles.learnMoreText}>Learn more {"›"}</Text>
        </Pressable>
      ) : null}

      {interactive ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Skip this and continue" onPress={() => onDone!()} hitSlop={10} style={styles.skip}>
          <Text style={styles.skipText}>Skip {"›"}</Text>
        </Pressable>
      ) : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f0f4ef", alignItems: "center", justifyContent: "center", padding: 28, overflow: "hidden" },
  blob: { position: "absolute", borderRadius: 999 },
  blobTop: { width: 380, height: 380, top: -140, right: -120, backgroundColor: "#e2ebe1" },
  blobBottom: { width: 320, height: 320, bottom: -120, left: -110, backgroundColor: "#eaf0e6" },
  brand: { position: "absolute", top: 20, left: 22, opacity: 0.55 },
  orbWrap: { width: 140, height: 140, alignItems: "center", justifyContent: "center", marginBottom: 28 },
  halo: { position: "absolute", width: 112, height: 112, borderRadius: 56, backgroundColor: colors.accent },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d6e2d4",
    ...shadowRaised,
  },
  orbIcon: { fontSize: 40 },
  card: { alignItems: "center", maxWidth: 340, minHeight: 190 },
  kind: { fontSize: 12, letterSpacing: 1.4, color: colors.accent, fontWeight: "700", marginBottom: 6 },
  year: { fontSize: 34, fontWeight: "300", color: colors.ink, marginBottom: 8 },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink, textAlign: "center" },
  attribution: { fontSize: 12, color: colors.muted, marginTop: 10, textAlign: "center", fontStyle: "italic" },
  bar: { position: "absolute", top: 12, left: 16, right: 16, height: 3, borderRadius: 2, backgroundColor: "rgba(63,107,82,0.2)", overflow: "hidden" },
  barFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  message: { position: "absolute", bottom: 36, fontSize: 12, color: colors.muted, letterSpacing: 0.5 },
  learnMore: { position: "absolute", bottom: 34, paddingVertical: 6, paddingHorizontal: 12 },
  learnMoreText: { fontSize: 13, fontWeight: "700", color: colors.accent },
  skip: { position: "absolute", top: 22, right: 18, paddingVertical: 8, paddingHorizontal: 12 },
  skipText: { fontSize: 13, fontWeight: "700", color: colors.muted },
});
