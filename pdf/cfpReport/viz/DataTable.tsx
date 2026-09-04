// The report's table grammar, lifted from the Canva template the user chose
// (docs/design-refs/canva-extract.md p06/p07) and recoloured to brand navy/gold.
//
// Five pages share it: 现金流明细, 资产明细, 负债明细, and the two tax pages. The
// layering is what makes a dense financial table readable at a glance:
//
//   headline  gold band, navy text        — the one number the page is about
//   group     navy band, white text       — 资产 / 负债 / 收入 / 支出
//   row       plain, zebra-striped        — line items
//   subtotal  light grey, bold            — 小计
//   total     charcoal band, white bold   — 合计
//
// Negatives print in parentheses, the accounting convention, never with a
// minus sign that can be mistaken for a hyphen at small sizes.

import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { T, TYPE, SPACE, LEADING, STATUS } from "../theme";
import { FONT, WEIGHT } from "../fonts";

export type RowKind = "row" | "subtotal" | "total" | "group";

export interface TableRow {
  kind: RowKind;
  label: string;
  /** right-hand figure, already formatted */
  value?: string;
  /** optional middle column, e.g. owner on a joint plan or a share % */
  meta?: string;
  /** nests the label one step, for detail under a group */
  indent?: boolean;
  /** flags the row — used for 高息负债 */
  flag?: "bad" | "warn";
}

export interface DataTableProps {
  /** gold band above the table */
  headline?: { label: string; value: string };
  rows: TableRow[];
  /** column header labels; omit for a table that needs none */
  columns?: { label: string; meta?: string; value: string };
  /** italic note printed under the table */
  note?: string;
  /** width of the middle column when `meta` is used */
  metaWidth?: number;
  valueWidth?: number;
}

export function DataTable({
  headline, rows, columns, note, metaWidth = 76, valueWidth = 92,
}: DataTableProps) {
  // Zebra striping counts only plain rows; banding the subtotals too would
  // make the stripe read as meaning instead of rhythm.
  let plainIndex = -1;

  return (
    <View>
      {headline && (
        <View style={{ backgroundColor: T.gold, paddingVertical: 11, paddingHorizontal: SPACE.lg, flexDirection: "row" }}>
          <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.h2, color: T.blue, lineHeight: LEADING.tight }}>
            {headline.label}
          </Text>
          <Text style={{ fontFamily: FONT.serif, fontWeight: WEIGHT.bold, fontSize: TYPE.h2, color: T.blue, lineHeight: LEADING.tight }}>
            {headline.value}
          </Text>
        </View>
      )}

      {columns && (
        <View style={{ flexDirection: "row", backgroundColor: T.blue, paddingVertical: 10, paddingHorizontal: SPACE.lg, marginTop: headline ? 2 : 0 }}>
          <Text style={{ flex: 1, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
            {columns.label}
          </Text>
          {columns.meta != null && (
            <Text style={{ width: metaWidth, fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
              {columns.meta}
            </Text>
          )}
          <Text style={{ width: valueWidth, textAlign: "right", fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.white }}>
            {columns.value}
          </Text>
        </View>
      )}

      {rows.map((r, i) => {
        if (r.kind === "row") plainIndex++;
        const style = bandFor(r.kind, plainIndex);
        return (
          <View
            key={i}
            style={{
              flexDirection: "row", alignItems: "center",
              // Row height is the single biggest lever on how much of the
              // page a table occupies; the reference template runs roughly
              // double what a web table would.
              paddingVertical: r.kind === "row" ? 8 : 9,
              paddingHorizontal: SPACE.lg,
              backgroundColor: style.bg,
              marginTop: r.kind === "group" ? 2 : 0,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingLeft: r.indent ? SPACE.lg : 0 }}>
              {r.flag && (
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: STATUS[r.flag].fill, marginRight: 5 }} />
              )}
              <Text
                style={{
                  fontFamily: style.bold ? FONT.sans : FONT.body,
                  fontWeight: style.bold ? WEIGHT.bold : undefined,
                  fontSize: TYPE.body, color: style.fg, lineHeight: LEADING.tight,
                }}
              >
                {r.label}
              </Text>
            </View>

            {r.meta != null && (
              <Text style={{ width: metaWidth, fontFamily: FONT.sans, fontSize: TYPE.caption, color: style.fg, lineHeight: LEADING.tight }}>
                {r.meta}
              </Text>
            )}

            <Text
              style={{
                width: valueWidth, textAlign: "right",
                fontFamily: FONT.serif, fontWeight: style.bold ? WEIGHT.bold : WEIGHT.medium,
                fontSize: TYPE.body, color: style.fg, lineHeight: LEADING.tight,
              }}
            >
              {r.value ?? ""}
            </Text>
          </View>
        );
      })}

      {note && (
        <>
          <Text style={{ fontFamily: FONT.sans, fontWeight: WEIGHT.bold, fontSize: TYPE.caption, color: T.blue, marginTop: SPACE.md }}>
            说明
          </Text>
          <Text style={{ fontFamily: FONT.body, fontSize: TYPE.caption, color: T.muted, marginTop: 2, lineHeight: LEADING.body }}>
            {note}
          </Text>
        </>
      )}
    </View>
  );
}

function bandFor(kind: RowKind, plainIndex: number): { bg: string; fg: string; bold: boolean } {
  switch (kind) {
    case "group":
      return { bg: T.bandGroup, fg: T.white, bold: true };
    case "subtotal":
      return { bg: T.bandSubtotal, fg: T.blue, bold: true };
    case "total":
      return { bg: T.bandTotal, fg: T.white, bold: true };
    default:
      return { bg: plainIndex % 2 === 0 ? T.white : "#FAF8F3", fg: T.text, bold: false };
  }
}

/**
 * Abbreviated money for tight spots (a donut hole, an axis label), using the
 * SAME negative convention as `money`. Mixing "(RM 128,490)" in a table with
 * "RM -128.5k" in the chart beside it reads as two different documents.
 */
export function compactMoneyAccounting(n: number | null | undefined, currency = "RM"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const body = abs >= 1_000_000
    ? `${trimTrailingZero(abs / 1_000_000)}M`
    : abs >= 1_000
      ? `${trimTrailingZero(abs / 1_000)}k`
      : String(Math.round(abs));
  return n < 0 ? `(${currency} ${body})` : `${currency} ${body}`;
}

function trimTrailingZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/** Accounting-style money: negatives in parentheses, never a bare minus. */
export function money(n: number | null | undefined, currency = "RM"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n)).toLocaleString("en-US");
  return n < 0 ? `(${currency} ${abs})` : `${currency} ${abs}`;
}
