import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";

/**
 * One interaction pattern reused everywhere text gets heavy: a one-line summary is
 * always visible, detail is one tap away, closed by default. Applied consistently
 * across Dashboard notes, Journey quest cards, and Learn substance cards so a user
 * only has to learn this once.
 */
export function Collapsible({
  title,
  teaser,
  children,
  defaultOpen = false,
  icon,
}: {
  title: string;
  teaser?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <Pressable accessibilityRole="button" aria-expanded={open} onPress={() => setOpen(!open)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {icon ? `${icon} ` : ""}
            {title}
          </Text>
          {!open && teaser ? (
            <Text style={styles.teaser} numberOfLines={1}>
              {teaser}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  title: { fontSize: 14, fontWeight: "600", color: colors.ink },
  teaser: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 12, color: colors.muted, marginLeft: 8 },
  body: { marginTop: 8 },
});
