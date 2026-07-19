// Browser entry point for the client PDF. Builds the model, renders the react-pdf
// document to a blob, and triggers a download via the shared helper. Import this
// LAZILY (dynamic import) from the UI so react-pdf + the CJK font stay out of the
// main bundle until an advisor actually exports.
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { downloadBytes } from "../generatePrsPack";
import InsuranceReportPdf from "./InsuranceReportPdf";
import { buildReportModel } from "./buildReportModel";
import type { InsuranceSectionContent, ReportMeta } from "./types";

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

export async function exportInsurancePdf(
  content: InsuranceSectionContent,
  meta: ReportMeta,
): Promise<void> {
  const model = buildReportModel(content, meta);
  const blob = await pdf(<InsuranceReportPdf model={model} />).toBlob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = sanitize(`Insurance-Planning-${meta.clientName || "Client"}-${meta.period}`);
  downloadBytes(bytes, `${name}.pdf`);
}
