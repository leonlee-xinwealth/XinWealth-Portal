// Server-side entry for the Investor Suitability PDF.
//
// Unlike pdf/cfpReport and pdf/insuranceReport — which render in the advisor's
// BROWSER on a button click — this one runs inside the Vercel Node function,
// because the PDF is produced the moment a prospect submits and is pushed
// straight to the advisor's Telegram with no browser in the loop.
//
// The 10.5 MB CJK font is not importable, so it ships via vercel.json's
// `functions.includeFiles` and is resolved from disk at runtime.
//
// This module owns ALL font setup. SuitabilityReportPdf is a pure component with
// no module-scope side effects, which is what lets it be imported STATICALLY —
// required because @vercel/nft traces the graph at build time and cannot follow
// a dynamic import whose ".js" specifier has no matching file on disk. An
// earlier dynamic-import version deployed a function that was missing the
// document entirely and failed every render with ERR_MODULE_NOT_FOUND.
//
// Explicit .js extensions throughout: Vercel transpiles (does not bundle) this
// graph into an ESM function, where Node's resolver requires a real extension.
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { registerFonts } from "../insuranceReport/fonts.js";
import { splitForCjkWrap } from "../cjkWrap.js";
import SuitabilityReportPdf from "./SuitabilityReportPdf.js";
import type { SuitabilityReportData } from "./model.js";

const FONT_REL = "public/fonts/NotoSansSC-Regular.ttf";

// package.json is `"type": "module"`, so __dirname does not exist. cwd is the
// project root locally and /var/task on Vercel, where includeFiles assets are
// laid down preserving their project-relative path.
const FONT_CANDIDATES = [
  path.join(process.cwd(), FONT_REL),
  path.join(process.cwd(), "..", FONT_REL),
  path.join("/var/task", FONT_REL),
];

export function fontCandidates(): string[] {
  return [...FONT_CANDIDATES];
}

export function resolveFontPath(): string | null {
  for (const p of FONT_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

export async function renderSuitabilityPdf(data: SuitabilityReportData): Promise<Buffer> {
  const fontPath = resolveFontPath();
  if (!fontPath) {
    throw new Error(
      `CJK font not found. Tried: ${FONT_CANDIDATES.join(", ")}. ` +
        `Check vercel.json functions["api/suitability.ts"].includeFiles.`,
    );
  }

  // Order is explicit rather than dependent on module-init sequence:
  // registerFonts() installs a Latin-only hyphenation callback ((w) => [w]), so
  // splitForCjkWrap MUST be registered after it or Chinese paragraphs become one
  // unbreakable word and run straight off the page. Both are global, idempotent
  // registrations resolved at render time.
  registerFonts(fontPath);
  Font.registerHyphenationCallback(splitForCjkWrap);

  return renderToBuffer(React.createElement(SuitabilityReportPdf, { data }));
}
