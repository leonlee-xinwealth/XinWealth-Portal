// Registers the CJK-capable font used by the client PDF. Noto Sans SC covers
// Latin + digits + Simplified Chinese in one family, so a single registration
// renders both en and zh reports. Served as a static asset from /public/fonts.
import { Font } from "@react-pdf/renderer";

let registered = false;

// `src` defaults to the browser static-asset URL. Tests / Node renders pass an
// absolute filesystem path so fontkit can read the TTF without a dev server.
export function registerFonts(src = "/fonts/NotoSansSC-Regular.ttf"): void {
  if (registered) return;
  Font.register({
    family: "NotoSansSC",
    fonts: [{ src }],
  });
  // CJK has no word boundaries — disable react-pdf's Latin hyphenation so
  // Chinese wraps per-character instead of being mangled.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
