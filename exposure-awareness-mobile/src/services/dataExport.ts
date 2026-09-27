import { Platform, Share } from "react-native";

/**
 * Hands a JSON copy of the person's data to them: a file download in a browser, the system share sheet on a phone (where they
 * can save it to Files, mail it to themselves, or send it anywhere they choose). Nothing is uploaded by the app.
 */
export async function deliverExport(json: string, filename: string): Promise<"downloaded" | "shared" | "cancelled" | "unavailable"> {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return "downloaded";
    } catch {
      return "unavailable";
    }
  }
  try {
    const result = await Share.share({ message: json, title: filename });
    return result.action === Share.dismissedAction ? "cancelled" : "shared";
  } catch {
    return "unavailable";
  }
}
