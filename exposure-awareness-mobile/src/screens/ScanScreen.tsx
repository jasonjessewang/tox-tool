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
import { tr } from "../i18n";

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
      setStatus({ kind: "error", msg: tr("That doesn't look like a barcode number (8-14 digits).") });
      return;
    }
    setStatus({ kind: "busy", msg: tr("Looking it up...") });
    const p = await lookupProduct(barcode, kind);
    if (!p) {
      setStatus({ kind: "error", msg: tr("Not in the database (coverage varies). Try a photo of the label or paste the ingredients.") });
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
      setStatus({ kind: "error", msg: from === "camera" ? tr("Permission to use the camera wasn't granted.") : tr("Permission to use the photo library wasn't granted.") });
      return;
    }
    const opts = { base64: true, quality: 0.6 } as const;
    const res = from === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync({ ...opts, mediaTypes: ["images"] });
    if (res.canceled || !res.assets[0]?.base64) return;
    setStatus({ kind: "busy", msg: tr("Reading the label...") });
    try {
      const { text } = await recognizeLabel(res.assets[0].base64);
      setCaptured((c) => ({ ...c, [target]: text }));
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", msg: tr("Couldn't read that photo: {error}", { error: (e as Error).message }) });
    }
  }

  function reviewCaptured() {
    const both = `${captured.ingredients ?? ""}\n${captured.nutrition ?? ""}`;
    const l = parseLabelText(both);
    const ingredientsText = l.ingredientsText || (captured.ingredients ?? "").replace(/\s+/g, " ").trim();
    setDraft({ name: tr("Scanned product"), brand: "", kind, barcode: null, source: "photo", ingredientsText, nova: null, nutrition: l.nutrition, nutritionPer100g: null, servingGrams: l.nutrition?.servingGrams ?? null });
  }

  function reviewPasted() {
    const l = parseLabelText(pasteText);
    const ingredientsText = l.ingredientsText || (l.nutrition ? "" : pasteText.replace(/\s+/g, " ").trim());
    setDraft({ name: tr("Pasted product"), brand: "", kind, barcode: null, source: "text", ingredientsText, nova: null, nutrition: l.nutrition, nutritionPer100g: null, servingGrams: l.nutrition?.servingGrams ?? null });
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
          <Text style={styles.cameraHint}>{tr("Point at the barcode")}</Text>
          <SecondaryButton title={tr("Cancel")} onPress={() => setCameraOn(false)} />
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
          <Text accessibilityRole="header" style={styles.h1}>{tr("Scan a product")}</Text>
          <Text style={styles.sub}>{tr("Get its ingredients, see what they mean, and add it to your running intake ledger.")}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenShelf} style={{ marginBottom: 12, paddingVertical: 8 }}>
        <Text style={styles.link}>{tr("My shelf and ledger ›")}</Text>
      </Pressable>

      <View style={styles.row}>
        {(["food", "personal_care"] as const).map((k) => (
          <Pressable accessibilityRole="radio" key={k} onPress={() => setKind(k)} aria-checked={!!(kind === k)} style={[styles.chip, kind === k && styles.chipOn]}>
            <Text style={[styles.chipText, kind === k && { color: colors.onAccent }]}>{k === "food" ? tr("Food") : tr("Personal care")}</Text>
          </Pressable>
        ))}
      </View>

      {status.kind !== "idle" && (
        <View style={[styles.status, status.kind === "error" && { backgroundColor: colors.warnSoft }]}>
          <Text style={styles.statusText}>{status.msg}</Text>
        </View>
      )}

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.method}>{tr("1 · Barcode")}</Text>
        <Text style={styles.note}>{tr("Fastest. Pulls the real ingredient list and nutrition from a community database.")}</Text>
        <View style={{ marginTop: 10 }}>
          <PrimaryButton title={tr("Scan with camera")} onPress={openCamera} disabled={busy} />
        </View>
        <TextInput style={styles.input} value={code} onChangeText={setCode} accessibilityLabel={tr("Barcode number")} placeholder={tr("or type the number, e.g. 3017620422003")} keyboardType="number-pad" />
        <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
          <SecondaryButton title={tr("Look it up")} onPress={() => search(code)} />
        </View>
      </Card>

      {backend && (
        <Card>
          <Text style={styles.method}>{tr("2 · Photograph the label")}</Text>
          <Text style={styles.note}>{tr("For anything without a barcode match. Take one photo of the ingredients and one of the nutrition facts, or both in a single photo.")}</Text>
          {(["ingredients", "nutrition"] as const).map((t) => (
            <View key={t} style={styles.captureRow}>
              <Text style={styles.captureLabel}>{captured[t] ? "✓ " : ""}{t === "ingredients" ? tr("Ingredients") : tr("Nutrition facts")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <SecondaryButton title={tr("Camera")} onPress={() => capture(t, "camera")} />
                <SecondaryButton title={tr("Library")} onPress={() => capture(t, "library")} />
              </View>
            </View>
          ))}
          {hasCaptured && (
            <View style={{ marginTop: 12 }}>
              <PrimaryButton title={tr("Review what we read")} onPress={reviewCaptured} disabled={busy} />
            </View>
          )}
        </Card>
      )}

      <Card>
        <Text style={styles.method}>{backend ? 3 : 2}{" "}{tr("· Type or paste")}</Text>
        <Text style={styles.note}>{tr("Paste an ingredient list and/or nutrition facts. On iPhone: open the photo, press and hold the text, tap Copy.")}</Text>
        {pasteOpen ? (
          <>
            <TextInput style={styles.textArea} value={pasteText} onChangeText={setPasteText} multiline accessibilityLabel={tr("Ingredients or nutrition facts, pasted")} placeholder={tr("Ingredients: sugar, palm oil, ...\nNutrition Facts  Calories 230 ...")} />
            <View style={{ marginTop: 10 }}>
              <PrimaryButton title={tr("Review")} onPress={reviewPasted} disabled={!pasteText.trim()} />
            </View>
          </>
        ) : (
          <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
            <SecondaryButton title={tr("Paste text")} onPress={() => setPasteOpen(true)} />
          </View>
        )}
      </Card>

      {!backend && (
        <Text style={[styles.status2, { marginHorizontal: 4, marginBottom: 16 }]}>
          {tr("Reading a label from a photo is possible if you connect a backend of your own (Connected sources › Your backend). Until then, copying the text from a photo and pasting it above works the same way.")}
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
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accentFill, borderColor: colors.accentFill },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  status: { backgroundColor: colors.accentSoft, borderRadius: radiusSm, padding: 10, marginTop: 12 },
  statusText: { fontSize: 13, color: colors.ink },
  method: { fontSize: 16, fontWeight: "700", color: colors.ink },
  note: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 12, fontSize: 15, backgroundColor: colors.surface, marginTop: 12 },
  textArea: { borderWidth: 1, borderColor: colors.line, borderRadius: radiusSm, padding: 12, fontSize: 14, minHeight: 110, backgroundColor: colors.surface, marginTop: 12, textAlignVertical: "top" },
  captureRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  captureLabel: { fontSize: 14, fontWeight: "600", color: colors.ink },
  status2: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 10, fontStyle: "italic" },
  cameraBar: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center", gap: 10 },
  cameraHint: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
