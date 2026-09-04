// Renders the 29-page template against a REAL client record.
//
// The synthetic fixture cannot catch a page that ignores `data` and prints its
// design-time content: the fixture's numbers look plausible either way. Only a
// real record makes the difference visible. This run is what surfaced a
// fabricated client name, a fabricated family and eight pages of invented
// figures that had survived the template wiring.
//
//   npx tsx pdf/cfpReport/_realrender.tsx <payload.json> <out.pdf>
//
// Scratch tool, deliberately untracked — the shipping harness is showcase.tsx.

import path from "path";
import fs from "fs";
import React from "react";
import { renderToFile } from "@react-pdf/renderer";
import { registerCfpFonts } from "./fonts";
import { CfpReportPdf } from "./CfpReportPdf";
import type { CfpReportData } from "./types";

registerCfpFonts(path.resolve("public/fonts"));

function localPng(rel: string) {
  const abs = path.resolve(rel);
  return fs.existsSync(abs) ? { data: fs.readFileSync(abs), format: "png" as const } : undefined;
}

const [, , payloadPath, outPath] = process.argv;
const data: CfpReportData = {
  ...JSON.parse(fs.readFileSync(payloadPath, "utf8")),
  brand: {
    logo: localPng("public/brand/xinwealth-logo.png"),
    logoReversed: localPng("public/brand/xinwealth-logo-reversed.png"),
  },
};

renderToFile(<CfpReportPdf data={data} />, outPath ?? "real.pdf").then(() =>
  console.log("wrote", outPath)
);
