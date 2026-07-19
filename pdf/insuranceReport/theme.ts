// Shared design tokens for the client PDF — XinWealth navy/gold brand plus a
// reserved semantic status palette (good / warn / bad / none). Status colours
// are used ONLY for state and always ship with an icon + text label, never
// colour alone (dataviz + impeccable rule). Track colours are a lighter step of
// the same ramp so state reads across the whole meter.

export const C = {
  blue: "#0A2540",
  blueLight: "#173A5E",
  blueDeep: "#061626",
  gold: "#C8A97E",
  goldLight: "#E6D3B3",
  goldDark: "#A68255",
  bg: "#F4F7F9",
  bgAlt: "#FAFBFC",
  text: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  line: "#E2E8F0",
  white: "#FFFFFF",
} as const;

export interface StatusToken {
  fill: string; // the mark
  track: string; // lighter step of the same ramp
  fg: string; // text/ink for the status word
  softBg: string; // callout background
}

export const STATUS: Record<"good" | "warn" | "bad" | "none", StatusToken> = {
  good: { fill: "#059669", track: "#D1FAE5", fg: "#047857", softBg: "#ECFDF5" },
  warn: { fill: "#D97706", track: "#FDE8C8", fg: "#B45309", softBg: "#FFFBEB" },
  bad: { fill: "#DC2626", track: "#FBD5D5", fg: "#B91C1C", softBg: "#FEF2F2" },
  none: { fill: "#94A3B8", track: "#EEF2F6", fg: "#64748B", softBg: "#F8FAFC" },
};

export type Band = keyof typeof STATUS;

export const bandForPct = (pct: number): Band =>
  pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad";

export const bandForLevel = (level: string): Band => {
  switch (level) {
    case "adequate": return "good";
    case "fair": return "warn";
    case "insufficient":
    case "none": return "bad";
    default: return "none";
  }
};
