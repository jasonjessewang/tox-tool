import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import * as SystemUI from "expo-system-ui";
import { getUserProfile } from "./storage/db";
import { applyTheme, colors } from "./theme";
import { getLanguage, onLanguageChange, resolveLanguage, setLanguage } from "./i18n";

/**
 * Chooses the theme and the language before the app's screens load. On a phone every style sheet reads its colours once, when
 * its module first loads, so the saved preference has to be applied first; on the web the colours are CSS variables and this only
 * sets which set is showing. A failed read falls back to the device's own settings.
 *
 * A language change later re-renders everything below (every string is looked up as it is drawn), so it shows at once and the
 * person stays where they are.
 */
export default function Root() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  const [, setLang] = useState(getLanguage());

  useEffect(() => {
    let alive = true;
    const unsubscribe = onLanguageChange(setLang);
    getUserProfile()
      .catch(() => null)
      .then((profile) => {
        applyTheme(profile?.theme ?? "system");
        setLanguage(resolveLanguage(profile?.language));
        if (Platform.OS !== "web") SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const loaded = require("../App").default as React.ComponentType;
        if (alive) setApp(() => loaded);
      });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return App ? <App /> : <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
