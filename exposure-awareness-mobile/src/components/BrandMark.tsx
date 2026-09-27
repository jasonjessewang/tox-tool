import React from "react";
import { View } from "react-native";
import { colors } from "../theme";

/**
 * The app's leaf mark, reused everywhere in-app (loading screens, empty states) so the
 * same glyph on the home-screen icon reappears inside the product. Built the same way a
 * CSS "leaf" shape is: a square with two opposite corners fully rounded, rotated 45deg --
 * no image asset, so it always matches the current theme color exactly.
 */
export default function BrandMark({ size = 28, color = colors.accent, style }: { size?: number; color?: string; style?: object }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={[{ width: size, height: size, alignItems: "center", justifyContent: "center" }, style]}>
      <View
        style={{
          width: size * 0.86,
          height: size * 0.86,
          backgroundColor: color,
          borderTopLeftRadius: size,
          borderBottomRightRadius: size,
          borderTopRightRadius: size * 0.06,
          borderBottomLeftRadius: size * 0.06,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}
