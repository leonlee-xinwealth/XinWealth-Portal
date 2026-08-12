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
// IMPORT ORDER MATTERS (same trap as pdf/cfpReport/renderSmoke.tsx): the PDF
// component calls registerFonts() at module scope, which defaults to the BROWSER
// asset URL "/fonts/NotoSansSC-Regular.ttf". fontkit resolves that against the
// filesystem root and fails with ENOENT (D:\fonts\... on Windows, /fonts/... on
// Linux). registerFonts() guards itself with a `registered` flag, so calling it
// FIRST with an absolute path makes the component's own call a no-op. Hence the
// dynamic import below — a static one would run the component's registration
// before ours.
import path from "node:path";
import fs from "node:fs";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { registerFonts } from "../insuranceReport/fonts";
import type { SuitabilityReportData } from "./model";

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

  // Must precede the component import — see the note above.
  registerFonts(fontPath);
  const { default: SuitabilityReportPdf } = await import("./SuitabilityReportPdf");

  return renderToBuffer(React.createElement(SuitabilityReportPdf, { data }));
}
