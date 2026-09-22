// The client-facing CFP report: 29 fixed pages, in registry order.
//
// This file deliberately holds no layout. Page ORDER comes from registry.ts,
// page NUMBERS come from each page's position in that same list, and the pages
// themselves live in pages/. Keeping all three tied to one source is what stops
// the failure this replaced: the previous version listed pages by hand in JSX
// while every page stamped its footer from the registry, so 14 sheets printed a
// number that did not match where they physically sat and the table of contents
// pointed at the wrong sheets.
//
// Fonts are NOT registered here — the caller does it, because the browser and
// Node resolve font paths differently (see exportCfpReport.tsx and showcase.tsx).

import React from "react";
import { Document } from "@react-pdf/renderer";
import { PAGES } from "./pages";
import type { CfpReportData } from "./types";

export function CfpReportPdf({ data }: { data: CfpReportData }) {
  return (
    <Document
      title={`${data.clientName} — ${data.period}`}
      author="XinWealth Advisory"
      subject="Comprehensive Financial Plan"
    >
      {PAGES.map(({ id, Component, pageNumber }) => (
        <Component key={id} data={data} pageNumber={pageNumber} />
      ))}
    </Document>
  );
}

export default CfpReportPdf;
