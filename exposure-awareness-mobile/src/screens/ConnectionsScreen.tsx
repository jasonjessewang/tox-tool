import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Linking, StyleSheet } from "react-native";
import * as db from "../storage/db";
import * as backend from "../services/backend";
import { planImport } from "../engine/samples";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { Collapsible } from "../components/Collapsible";
import { colors, radiusSm } from "../theme";
import { daysAgoISO as daysAgo } from "../util/dates";

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
  { id: "strava", icon: "🏃", name: "Strava", blurb: "Imports your activity time.", kind: "server" },
  { id: "apple_health", icon: "❤️", name: "Apple Health", blurb: "Sleep, activity and heart rate from your iPhone.", kind: "native" },
  { id: "health_connect", icon: "🤖", name: "Health Connect · Samsung Health", blurb: "Android's shared health store; Samsung Health syncs into it.", kind: "native" },
  { id: "google", icon: "🔑", name: "Google account", blurb: "Sign-in only. Never reads your Gmail.", kind: "server" },
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
        setMessage(`Couldn't reach your backend: ${(e as Error).message}`);
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
      setMessage("Finish in your browser, then come back and tap Refresh.");
    });

  const sync = () =>
    run(async () => {
      await backend.syncStrava();
      const samples = await backend.fetchDailyMetrics(daysAgo(30));
      const plan = planImport(samples, await db.getDailyMetrics(90), (await db.getLogsForRange(daysAgo(30), daysAgo(-1))).practices);
      for (const m of plan.metricUpserts) await db.upsertDailyMetrics({ log_date: m.date, calories: m.calories, active_minutes: m.active_minutes, screen_hours: m.screen_hours });
      for (const s of plan.sleepLogs) await db.insertPracticeLog({ log_date: s.date, practice_type: "sleep", duration_minutes: s.minutes, detail: `Imported from ${s.source}`, notes: "" });
      setMessage(`Imported ${plan.metricUpserts.length} day(s) of activity and ${plan.sleepLogs.length} sleep entr${plan.sleepLogs.length === 1 ? "y" : "ies"}. Your own entries were left untouched.`);
      refresh();
    });

  const unlink = (id: string) => run(async () => { await backend.disconnect(id); refresh(); });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.h1}>Connected sources</Text>
      <Text style={styles.sub}>Bring in data you already have. Your own entries always win over imported ones.</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      {CATALOG.map((c) => {
        const s = server.find((x) => x.id === c.id);
        return (
          <Card key={c.id}>
            <Text style={styles.name}>{c.icon} {c.name}</Text>
            <Text style={styles.note}>{c.blurb}</Text>

            {c.kind === "native" && (
              <Text style={styles.status}>Arrives with the App Store build. Apple and Android only allow health data to be read by the app itself, which needs a native build (Expo Go can't do it).</Text>
            )}
            {c.kind === "server" && !configured && <Text style={styles.status}>Needs your backend (see "Your backend" below).</Text>}
            {c.kind === "server" && configured && s && !s.configured && (
              <Text style={styles.status}>Your backend doesn't have {c.name} credentials yet. Add them in its environment, then Refresh.</Text>
            )}
            {c.kind === "server" && configured && s?.configured && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {s.connected ? (
                  <>
                    <Text style={styles.connected}>{"✓"} Connected{s.account ? ` as ${s.account}` : ""}{s.last_sync ? ` · synced ${s.last_sync.slice(0, 10)}` : ""}</Text>
                    {c.id === "strava" && <PrimaryButton title={busy ? "Syncing..." : "Sync now"} onPress={sync} disabled={busy} />}
                    <SecondaryButton title="Disconnect" onPress={() => unlink(c.id)} />
                  </>
                ) : (
                  <PrimaryButton title={`Connect ${c.name}`} onPress={() => connect(c.id)} disabled={busy} />
                )}
              </View>
            )}
          </Card>
        );
      })}

      {configured && <SecondaryButton title="Refresh" onPress={refresh} />}

      <View style={{ marginTop: 20 }}>
        <Collapsible title="Your backend" teaser={configured ? "Configured" : "Needed for Strava and Google sign-in"}>
          <Text style={styles.note}>Run exposure-awareness-backend (README has the steps), then paste its address and an API key made with `npm run create-key`. Stored only on this phone.</Text>
          <TextInput style={styles.input} value={url} onChangeText={setUrl} accessibilityLabel="Backend address" placeholder="http://192.168.1.10:4000" autoCapitalize="none" autoCorrect={false} />
          <TextInput style={styles.input} value={key} onChangeText={setKey} accessibilityLabel="API key" placeholder="API key (eak_...)" autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <PrimaryButton title="Save" onPress={saveConfig} disabled={!url.trim() || !key.trim()} />
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
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 10, fontSize: 14, backgroundColor: "#fff", marginTop: 10 },
});
