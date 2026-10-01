import React from "react";
import { View, Text, StyleSheet, SafeAreaView } from "react-native";
import { colors } from "../theme";
import { PrimaryButton, SecondaryButton } from "./ui";
import BrandMark from "./BrandMark";
import { openFeedback } from "../services/feedback";

interface State {
  error: Error | null;
}

/**
 * Catches a render-time error anywhere below it so the screen stays calm instead of going
 * blank. Storage is separate from rendering, so a crash here never touches what's already
 * saved -- "Try again" (re-rendering the same tree fresh) is a safe first offer, with
 * feedback one tap away if it keeps happening. Must be a class: React has no hook for this.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <SafeAreaView style={styles.screen}>
        <BrandMark size={22} color={colors.accent} style={styles.brand} />
        <Text style={styles.heading}>This screen hit a snag.</Text>
        <Text style={styles.body}>
          Nothing you've logged was lost -- it lives on this device, separately from what just broke.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton title="Try again" onPress={() => this.setState({ error: null })} />
          <SecondaryButton title="Send feedback" onPress={() => openFeedback(`${error.name}: ${error.message}`)} />
        </View>
      </SafeAreaView>
    );
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 28 },
  brand: { marginBottom: 24 },
  heading: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 10, textAlign: "center" },
  body: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: "center", maxWidth: 300, marginBottom: 24 },
  actions: { alignItems: "center", gap: 12 },
});
