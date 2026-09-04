// P5 客户个人资料 — the client's own particulars.
//
// This page is the one place in the report that prints who the client IS rather
// than what their money is doing, so every field has to come from the record.
// A placeholder here is not a cosmetic problem: a report addressed to the wrong
// person is not a draft, it is a different document.
//
// Ages are derived here rather than read from the baseline because the partner
// has no baseline of their own, and a report that ages the two people by
// different rules is worse than one that ages neither.

import type { CfpReportClient, CfpReportData } from "../types";
import { maritalLabel, employmentLabel } from "../labels/enums";

export interface ProfileRow {
  label: string;
  value: string;
}

export interface FamilyMember {
  role: string;
  detail: string;
}

export interface ProfileView {
  rows: ProfileRow[];
  family: FamilyMember[];
  /** false when there is no client record at all — the page shows its empty state */
  hasData: boolean;
}

const DASH = "—";

export function ageFromDob(dob: string | null | undefined, now = new Date()): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}

function birthLine(c: CfpReportClient | undefined, now: Date): string {
  const age = ageFromDob(c?.date_of_birth, now);
  if (!c?.date_of_birth) return DASH;
  const year = new Date(c.date_of_birth).getFullYear();
  if (!Number.isFinite(year)) return DASH;
  // Year plus age, never the full birth date: the report is handed over,
  // emailed and printed, and a date of birth on it is an identity document
  // field that the page has no use for.
  return age != null ? `${year}（${age} 岁）` : String(year);
}

export function selectProfile(data: CfpReportData, now = new Date()): ProfileView {
  const c = data.client;
  const p = data.partner;
  const hasData = !!(data.clientName || c?.date_of_birth || c?.occupation);

  const dependants = c?.number_of_dependants;
  const rows: ProfileRow[] = [
    { label: "姓名", value: data.clientName || DASH },
    { label: "出生年份", value: birthLine(c, now) },
    { label: "婚姻状况", value: maritalLabel(c?.marital_status) },
    {
      label: "受扶养人数",
      value: dependants == null ? DASH : dependants === 0 ? "无" : `${dependants} 名`,
    },
    { label: "职业", value: c?.occupation || DASH },
    { label: "雇佣状态", value: employmentLabel(c?.employment_status) },
    {
      label: "预设退休年龄",
      value: c?.retirement_age != null ? `${c.retirement_age} 岁` : DASH,
    },
  ];

  if (data.partnerName || p) {
    // Joint plan: the spouse is a subject of this report, not a detail of the
    // client's, so they get their own rows rather than a footnote.
    rows.push({ label: "配偶姓名", value: data.partnerName || DASH });
    rows.push({ label: "配偶出生年份", value: birthLine(p, now) });
    if (p?.occupation) rows.push({ label: "配偶职业", value: p.occupation });
  }

  const family: FamilyMember[] = [];
  if (hasData) {
    const age = ageFromDob(c?.date_of_birth, now);
    family.push({
      role: "本人",
      detail: [age != null ? `${age} 岁` : null, c?.occupation || null]
        .filter(Boolean).join(" · ") || DASH,
    });
  }
  if (data.partnerName || p) {
    const pAge = ageFromDob(p?.date_of_birth, now);
    family.push({
      role: "配偶",
      detail: [pAge != null ? `${pAge} 岁` : null, p?.occupation || null]
        .filter(Boolean).join(" · ") || DASH,
    });
  }
  // Dependants are a count in the record, not people with names and ages. The
  // card says what is known and stops there — the alternative was inventing
  // children, which is exactly what this page used to do.
  if (dependants != null && dependants > 0) {
    family.push({ role: "受扶养人", detail: `${dependants} 名` });
  }

  return { rows, family, hasData };
}
