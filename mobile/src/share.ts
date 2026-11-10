import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";

// The invite link goes on the clipboard, for whichever chat it is pasted into.
export async function copyText(text: string): Promise<"copied" | "failed"> {
  try {
    return (await Clipboard.setStringAsync(text)) ? "copied" : "failed";
  } catch {
    return "failed";
  }
}

// The share sheet natively; the clipboard on the web, where there is none.
export async function shareText(message: string): Promise<void> {
  if (Platform.OS === "web") {
    await copyText(message);
    return;
  }
  await Share.share({ message });
}
