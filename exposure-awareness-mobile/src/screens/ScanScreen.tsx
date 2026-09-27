import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { lookupProduct, normalizeBarcode } from "../services/productLookup";
import { ocrAvailable, recognizeLabel } from "../services/ocr";
import { parseLabelText } from "../engine/ingredients/parse";
import type { ProductDraft, ProductKind } from "../engine/ingredients/types";
import ProductReview from "./ProductReview";
import { Card, PrimaryButton, SecondaryButton } from "../components/ui";
import { colors, radiusSm } from "../theme";

type Capture = "ingredients" | "nutrition";
type Status = { kind: "idle" } | { kind: "busy"; msg: string } | { kind: "error"; msg: string };

/** Three ways in -- barcode, photo of the label, or paste -- all ending at the same review page. */
export default function ScanScreen({ onOpenShelf }: { onOpenShelf: () => void }) {
  const [kind, setKind] = useState<ProductKind>("food");
  const [code, setCode] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [handled, setHandled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [captured, setCaptured] = useState<Partial<Record<Capture, string>>>({});
  const [backend, setBackend] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);

  useEffect(() => {
    ocrAvailable().then(setBackend);
  }, []);

  async function search(raw: string) {
    const barcode = normalizeBarcode(raw);
    if (!barcode) {
      setStatus({ kind: "error", msg: "That doesn't look like a barcode number (8-14 digits)." });
      return;
    }
    setStatus({ kind: "busy", msg: "Looking it up..." });
    const p = await lookupProduct(barcode, kind);
    if (!p) {
      setStatus({ kind: "error", msg: "Not in the database (coverage varies). Try a photo of the label or paste the ingredients." });
      return;
    }
    setStatus({ kind: "idle" });
    setDraft({ name: p.name, brand: p.brand, kind, barcode: p.barcode, source: "barcode", ingredientsText: p.ingredients, nova: p.nova, nutrition: p.nutrition, nutritionPer100g: p.nutritionPer100g, servingGrams: p.servingGrams });
  }

  async function openCamera() {
    if (!permission?.granted && !(await requestPermission()).granted) return;
    setHandled(false);
    setCameraOn(true);
  }

  async function capture(target: Capture, from: "camera" | "library") {
    const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setStatus({ kind: "error", msg: `Permission to use the ${from === "camera" ? "camera" : "photo library"} wasn't granted.` });
      return;
    }
    const opts = { base64: true, quality: 0.6 } as const;
    const res = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
    if (res.canceled || !res.assets[0]?.base64) return;
    setStatus({ kind: "busy", msg: "Reading the label..." });
    try {
      const { text } = await recognizeLabel(res.assets[0].base64);
      setCaptured((c) => ({ ...c, [target]: text }));
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", msg: `Couldn't read that photo: ${(e as Error).message}` });
    }
  }

  function reviewCaptured() {
    const both = `${captured.ingredients ?? ""}\n${captured.nutrition ?? ""}`;
    const l = parseLabelText(both);
    const ingredientsText = l.ingredientsText || (captured.ingredients ?? "").replace(/\s+/g, " ").trim();
    setDraft({ name: "Scanned product", brand: "", kind, barcode: null, source: "photo", ingredientsText, nova: null, nutrition: l.nutrition, nutritionPer100g: null, servingGrams: l.nutrition?.servingGrams ?? null });
  }

  function reviewPasted() {
    const l = parseLabelText(pasteText);
    const ingredientsText = l.ingredientsText || (l.nutrition ? "" : pasteText.replace(/\s+/g, " ").trim());
    setDraft({ name: "Pasted product", brand: "", kind, barcode: null, source: "text", ingredientsText, nova: null, nutrition: l.nutrition, nutritionPer100g: null, servingGrams: l.nutrition?.servingGrams ?? null });
  }

  if (draft) {
    return (
      <ProductReview
        draft={draft}
        onDone={() => {
          setDraft(null);
          setCode("");
          setCaptured({});
          setPasteText("");
          setPasteOpen(false);
          setStatus({ kind: "idle" });
        }}
        onOpenShelf={onOpenShelf}
      />
    );
  }

  if (cameraOn) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
          onBarcodeScanned={({ data }) => {
            if (handled) return;
            setHandled(true);
            setCameraOn(false);
            setCode(data);
            search(data);
          }}
        />
        <View style={styles.cameraBar}>
          <Text style={styles.cameraHint}>Point at the barcode</Text>
          <SecondaryButton title="Cancel" onPress={() => setCameraOn(false)} />
        </View>
      </View>
    );
  }

  const busy = status.kind === "busy";
  const hasCaptured = !!(captured.ingredients || captured.nutrition);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={styles.h1}>Scan a product</Text>
          <Text style={styles.sub}>Get its ingredients, see what they mean, and add it to your running intake ledger.</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenShelf} style={{ marginBottom: 12, paddingVertical: 8 }}>
        <Text style={styles.link}>My shelf and ledger {"›"}</Text>
      </Pressable>

      <View style={styles.row}>
        {(["food", "personal_care"] as const).map((k) => (
          <Pressable accessibilityRole="radio" key={k} onPress={() => setKind(k)} aria-checked={!!(kind === k)} style={[styles.chip, kind === k && styles.chipOn]}>
            <Text style={[styles.chipText, kind === k && { color: "#fff" }]}>{k === "food" ? "Food" : "Personal care"}</Text>
          </Pressable>
        ))}
      </View>

      {status.kind !== "idle" && (
        <View style={[styles.status, status.kind === "error" && { backgroundColor: colors.warnSoft }]}>
          <Text style={styles.statusText}>{status.msg}</Text>
        </View>
      )}

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.method}>1 {"·"} Barcode</Text>
        <Text style={styles.note}>Fastest. Pulls the real ingredient list and nutrition from a community database.</Text>
        <View style={{ marginTop: 10 }}>
          <PrimaryButton title="Scan with camera" onPress={openCamera} disabled={busy} />
        </View>
        <TextInput style={styles.input} value={code} onChangeText={setCode} accessibilityLabel="Barcode number" placeholder="or type the number, e.g. 3017620422003" keyboardType="number-pad" />
        <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
          <SecondaryButton title="Look it up" onPress={() => search(code)} />
        </View>
      </Card>

      {backend && (
        <Card>
          <Text style={styles.method}>2 {"·"} Photograph the label</Text>
          <Text style={styles.note}>For anything without a barcode match. Take one photo of the ingredients and one of the nutrition facts, or both in a single photo.</Text>
          {(["ingredients", "nutrition"] as const).map((t) => (
            <View key={t} style={styles.captureRow}>
              <Text style={styles.captureLabel}>{captured[t] ? "✓ " : ""}{t === "ingredients" ? "Ingredients" : "Nutrition facts"}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SecondaryButton title="Camera" onPress={() => capture(t, "camera")} />
                <SecondaryButton title="Library" onPress={() => capture(t, "library")} />
              </View>
            </View>
          ))}
          {hasCaptured && (
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title="Review what we read" onPress={reviewCaptured} disabled={busy} />
            </View>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.method}>{backend ? 3 : 2} {"·"} Type or paste</Text>
        <Text style={styles.note}>Paste an ingredient list and/or nutrition facts. On iPhone: open the photo, press and hold the text, tap Copy.</Text>
        {pasteOpen ? (
          <>
            <TextInput style={styles.textArea} value={pasteText} onChangeText={setPasteText} multiline accessibilityLabel="Ingredients or nutrition facts, pasted" placeholder={"Ingredients: sugar, palm oil, ...\nNutrition Facts  Calories 230 ..."} />
            <View style={{ marginTop: 10 }}>
              <PrimaryButton title="Review" onPress={reviewPasted} disabled={!pasteText.trim()} />
            </View>
          </>
        ) : (
          <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
            <SecondaryButton title="Paste text" onPress={() => setPasteOpen(true)} />
          </View>
        )}
      </Card>

      {!backend && (
        <Text style={[styles.status2, { marginHorizontal: 4, marginBottom: 16 }]}>
          Reading a label from a photo is possible if you connect a backend of your own (Connected sources {"›"} Your backend). Until then, copying the text from a photo and pasting it above works the same way.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: "row" },
  h1: { fontSize: 22, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4, marginBottom: 8 },
  link: { fontSize: 14, fontWeight: "600", color: colors.accent },
  row: { flexDirection: "row", gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  status: { backgroundColor: colors.accentSoft, borderRadius: radiusSm, padding: 10, marginTop: 12 },
  statusText: { fontSize: 13, color: colors.ink },
  method: { fontSize: 16, fontWeight: "700", color: colors.ink },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 12, fontSize: 15, backgroundColor: "#fff", marginTop: 12 },
  textArea: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 12, fontSize: 14, minHeight: 110, backgroundColor: "#fff", marginTop: 12, textAlignVertical: "top" },
  captureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  captureLabel: { fontSize: 14, fontWeight: "600", color: colors.ink },
  status2: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 10, fontStyle: "italic" },
  cameraBar: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center", gap: 10 },
  cameraHint: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
