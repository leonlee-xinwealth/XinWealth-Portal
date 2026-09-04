// Font registration for the CFP report.
//
// Kept separate from pdf/insuranceReport/fonts.ts, which the insurance and
// suitability PDFs share and which registers a single regular weight.
//
// ⚠️ Never register a *-VF.ttf here. @react-pdf/renderer 4.5.1 cannot use
// variable fonts: registering one with a named instance crashes fontkit's
// subsetter ("First argument to DataView constructor must be an ArrayBuffer"),
// and registering one without an instance silently embeds the font's DEFAULT
// axis position — Thin (100) for NotoSansSC-VF, ExtraLight (200) for
// NotoSerifSC-VF. Every sample rendered before 2026-08-18 was hairline because
// of this. Use the static faces baked by scripts/build-cfp-fonts.mjs.

import { Font } from "@react-pdf/renderer";
import { splitForCjkWrap } from "../cjkWrap";

/** Serif carries display headings and every figure; sans carries labels and
 *  prose. That contrast is the main source of the private-bank feel — with one
 *  weight there is no hierarchy to build from. */
export const FONT = {
  serif: "XwSerifSC",
  sans: "XwSansSC",
  /** full-coverage body face: handles arbitrary client names and LLM prose,
   *  which the subsetted display faces deliberately do not cover */
  body: "NotoSansSC",
} as const;

export const WEIGHT = { medium: 500, bold: 700 } as const;

let registered = false;

/**
 * @param base `/fonts` in the browser; an absolute directory under Node so
 *             fontkit can read the files without a dev server.
 */
export function registerCfpFonts(base = "/fonts"): void {
  if (registered) return;

  Font.register({
    family: FONT.serif,
    fonts: [
      { src: `${base}/XwSerifSC-Medium.ttf`, fontWeight: WEIGHT.medium },
      { src: `${base}/XwSerifSC-Bold.ttf`, fontWeight: WEIGHT.bold },
    ],
  });
  Font.register({
    family: FONT.sans,
    fonts: [
      { src: `${base}/XwSansSC-Medium.ttf`, fontWeight: WEIGHT.medium },
      { src: `${base}/XwSansSC-Bold.ttf`, fontWeight: WEIGHT.bold },
    ],
  });
  Font.register({
    family: FONT.body,
    fonts: [{ src: `${base}/NotoSansSC-Regular.ttf` }],
  });

  // Must come last — registering a family installs react-pdf's own callback,
  // which only recognises ASCII spaces and would run CJK prose off the page.
  // See pdf/cjkWrap.ts for what this costs and what has been ruled out.
  Font.registerHyphenationCallback(splitForCjkWrap);

  registered = true;
}

/** Test seam — lets a suite register against a different directory. */
export function resetCfpFontsForTest(): void {
  registered = false;
}
