import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Linking, StyleSheet } from "react-native";
import * as db from "../storage/db";
import * as backend from "../services/backend";
import { planImport } from "../engine/samples";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { colors, radiusSm } from "../theme";
import { daysAgoISO as daysAgo } from "../util/dates";
import { msg, tr, trn } from "../i18n";

interface CatalogEntry {
  id: string;
  icon: string;
  name: string;
  blurb: string;
  kind: "native" | "server";
}

// What each source gives the engine, and how it connects. Native health platforms can only
// be read by code running on the device with the OS health SDK, so they need a real build.
const CATALOG: CatalogEntry[] = [
  { id: "strava", icon: "🏃", name: "Strava", // i18n-ignore: a brand name
    blurb: msg("Imports your activity time."), kind: "server" },
  { id: "apple_health", icon: "❤️", name: msg("Apple Health"), blurb: msg("Sleep, activity and heart rate from your iPhone."), kind: "native" },
  { id: "health_connect", icon: "🤖", name: msg("Health Connect · Samsung Health"), blurb: msg("Android's shared health store; Samsung Health syncs into it."), kind: "native" },
  { id: "google", icon: "🔑", name: msg("Google account"), blurb: msg("Sign-in only. Never reads your Gmail."), kind: "server" },
];

export default function ConnectionsScreen() {
  const [configured, setConfigured] = useState(false);
  const [server, setServer] = useState<backend.ServerProvider[]>([]);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const cfg = await backend.getBackendConfig();
    setConfigured(!!cfg);
    if (cfg) {
      setUrl(cfg.baseUrl);
      try {
        setServer(await backend.listIntegrations());
        setMessage(null);
      } catch (e) {
        setServer([]);
        setMessage(tr("Couldn't reach your backend: {error}", { error: (e as Error).message }));
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveConfig() {
    await backend.saveBackendConfig({ baseUrl: url, apiKey: key });
    setKey("");
    refresh();
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setBusy(false);
  }

  const connect = (id: string) =>
    run(async () => {
      await Linking.openURL(await backend.startAuthorize(id));
      setMessage(tr("Finish in your browser, then come back and tap Refresh."));
    });

  const sync = () =>
    run(async () => {
      await backend.syncStrava();
      const samples = await backend.fetchDailyMetrics(daysAgo(30));
      const plan = planImport(samples, await db.getDailyMetrics(90), (await db.getLogsForRange(daysAgo(30), daysAgo(-1))).practices);
      for (const m of plan.metricUpserts) await db.upsertDailyMetrics({ log_date: m.date, calories: m.calories, active_minutes: m.active_minutes, screen_hours: m.screen_hours });
      for (const s of plan.sleepLogs) await db.insertPracticeLog({ log_date: s.date, practice_type: "sleep", duration_minutes: s.minutes, detail: `Imported from ${s.source}`, notes: "" }); // i18n-ignore: stored with the entry; shown as recorded
      setMessage(trn(plan.sleepLogs.length, "Imported {days} day(s) of activity and {n} sleep entry. Your own entries were left untouched.", "Imported {days} day(s) of activity and {n} sleep entries. Your own entries were left untouched.", { days: plan.metricUpserts.length }));
      refresh();
    });

  const unlink = (id: string) => run(async () => { await backend.disconnect(id); refresh(); });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.h1}>{tr("Connected sources")}</Text>
      <Text style={styles.sub}>{tr("Bring in data you already have. Your own entries always win over imported ones.")}</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      {CATALOG.map((c) => {
        const s = server.find((x) => x.id === c.id);
        return (
          <Card key={c.id}>
            <Text style={styles.name}>{c.icon} {tr(c.name)}</Text>
            <Text style={styles.note}>{tr(c.blurb)}</Text>

            {c.kind === "native" && (
              <Text style={styles.status}>{tr("Arrives with the App Store build. Apple and Android only allow health data to be read by the app itself, which needs a native build (Expo Go can't do it).")}</Text>
            )}
            {c.kind === "server" && !configured && <Text style={styles.status}>{tr("Needs your backend (see \"Your backend\" below).")}</Text>}
            {c.kind === "server" && configured && s && !s.configured && (
              <Text style={styles.status}>{tr("Your backend doesn't have {name} credentials yet. Add them in its environment, then Refresh.", { name: tr(c.name) })}</Text>
            )}
            {c.kind === "server" && configured && s?.configured && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {s.connected ? (
                  <>
                    <Text style={styles.connected}>{tr("✓ Connected")}{s.account ? tr(" as {account}", { account: s.account }) : ""}{s.last_sync ? tr(" · synced {slice}", { slice: s.last_sync.slice(0, 10) }) : ""}</Text>
                    {c.id === "strava" && <PrimaryButton title={busy ? tr("Syncing...") : tr("Sync now")} onPress={sync} disabled={busy} />}
                    <SecondaryButton title={tr("Disconnect")} onPress={() => unlink(c.id)} />
                  </>
                ) : (
                  <PrimaryButton title={tr("Connect {name}", { name: tr(c.name) })} onPress={() => connect(c.id)} disabled={busy} />
                )}
              </View>
            )}
          </Card>
        );
      })}

      {configured && <SecondaryButton title={tr("Refresh")} onPress={refresh} />}

      <View style={{ marginTop: 20 }}>
        <Collapsible title={tr("Your backend")} teaser={configured ? tr("Configured") : tr("Needed for Strava and Google sign-in")}>
          <Text style={styles.note}>{tr("Run exposure-awareness-backend (README has the steps), then paste its address and an API key made with `npm run create-key`. Stored only on this phone.")}</Text>
          <TextInput style={styles.input} value={url} onChangeText={setUrl} accessibilityLabel={tr("Backend address")} placeholder={tr("http://192.168.1.10:4000")} autoCapitalize="none" autoCorrect={false} />
          <TextInput style={styles.input} value={key} onChangeText={setKey} accessibilityLabel={tr("API key")} placeholder={tr("API key (eak_...)")} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <PrimaryButton title={tr("Save")} onPress={saveConfig} disabled={!url.trim() || !key.trim()} />
        </Collapsible>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4, marginBottom: 14 },
  message: { fontSize: 13, color: colors.ink, backgroundColor: colors.warnSoft, padding: 10, borderRadius: radiusSm, marginBottom: 12, overflow: "hidden" },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  status: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 10, fontStyle: "italic" },
  connected: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 14, backgroundColor: colors.surface, marginTop: 10 },
});
