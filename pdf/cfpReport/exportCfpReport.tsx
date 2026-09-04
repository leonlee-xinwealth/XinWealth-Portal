// Browser entry point for the unified client CFP report PDF. Renders the
// react-pdf document to a blob and triggers a download via the shared
// helper. Import this LAZILY (dynamic import) from the UI so react-pdf +
// the CJK font stay out of the main bundle until an advisor actually
// exports — mirrors pdf/insuranceReport/exportInsurancePdf.tsx.
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { downloadBytes } from "../generatePrsPack";
import CfpReportPdf from "./CfpReportPdf";
import { registerCfpFonts } from "./fonts";
import type { CfpReportData } from "./types";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Brand artwork, as URLs the browser can fetch. Node renders pass buffers
 * instead — see showcase.tsx. Served from /public, so these paths are stable.
 */
const BROWSER_BRAND = {
  logo: "/brand/xinwealth-logo.png",
  logoReversed: "/brand/xinwealth-logo-reversed.png",
};

export async function exportCfpReport(data: CfpReportData): Promise<void> {
  // The document assumes the CFP font stack is registered; nothing else in the
  // browser does it, and an unregistered family silently falls back to Helvetica
  // — which has no CJK glyphs at all.
  registerCfpFonts();

  const withBrand: CfpReportData = { ...data, brand: data.brand ?? BROWSER_BRAND };
  const blob = await pdf(<CfpReportPdf data={withBrand} />).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = sanitize(`Financial-Report-${data.clientName || "Client"}-${data.period}`);
  downloadBytes(bytes, `${name}.pdf`);
}
