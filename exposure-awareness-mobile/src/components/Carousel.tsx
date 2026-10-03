import React, { useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { colors, radius, shadow } from "../theme";
import { tr } from "../i18n";

const GAP = 12;
const SIDE = 16;

/**
 * One dashboard block: a titled row of swipeable pages with page dots, feed-style. The "2/4 ›" counter is a real control: it shows
 * the next page, and wraps to the first, so a keyboard or switch user can reach every page without a swipe.
 */
export function Carousel({ icon, title, pages }: { icon: string; title: string; pages: React.ReactNode[] }) {
  const { width } = useWindowDimensions();
  const pageW = width - SIDE * 2;
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const show = (i: number) => {
    const next = (i + pages.length) % pages.length;
    setIndex(next);
    scroller.current?.scrollTo({ x: next * (pageW + GAP), animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (pageW + GAP));
    if (i !== index) setIndex(Math.max(0, Math.min(pages.length - 1, i)));
  };

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text accessibilityRole="header" aria-level={2} style={styles.title}>
          {icon} {title}
        </Text>
        {pages.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={index + 1 === pages.length ? tr("{title}: page {page} of {count}. Show the first page", { title, page: index + 1, count: pages.length }) : tr("{title}: page {page} of {count}. Show the next page", { title, page: index + 1, count: pages.length })}
            onPress={() => show(index + 1)}
            hitSlop={12}
            style={styles.countButton}
          >
            <Text style={styles.count}>
              {index + 1}/{pages.length} {"›"}
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageW + GAP}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}
      >
        {pages.map((p, i) => (
          <View key={i} style={[styles.page, { width: pageW }]}>
            {p}
          </View>
        ))}
      </ScrollView>
      {pages.length > 1 && (
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 22, marginHorizontal: -SIDE },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: SIDE, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  count: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  // a target big enough to hit (24px at the least), without moving anything: the padding is taken back with negative margins
  countButton: { paddingVertical: 8, paddingHorizontal: 10, marginVertical: -8, marginRight: -10 },
  page: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius, padding: 18, minHeight: 210, ...shadow },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.accent, width: 16 },
});
