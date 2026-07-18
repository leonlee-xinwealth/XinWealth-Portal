// Browser entry point for the unified client CFP report PDF. Renders the
// react-pdf document to a blob and triggers a download via the shared
// helper. Import this LAZILY (dynamic import) from the UI so react-pdf +
// the CJK font stay out of the main bundle until an advisor actually
// exports — mirrors pdf/insuranceReport/exportInsurancePdf.tsx.
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { downloadBytes } from "../generatePrsPack";
import CfpReportPdf from "./CfpReportPdf";
import type { CfpReportData } from "./types";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

export async function exportCfpReport(data: CfpReportData): Promise<void> {
  const blob = await pdf(<CfpReportPdf data={data} />).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = sanitize(`Financial-Report-${data.clientName || "Client"}-${data.period}`);
  downloadBytes(bytes, `${name}.pdf`);
}
