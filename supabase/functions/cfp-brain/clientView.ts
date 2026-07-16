// Generic layman "simplify pass" for any CFP section except insurance (which
// keeps its richer legacy ClientView shape that the PDF exporter consumes).
// Mirrors the insurance clientView discipline: PII-free input, structured
// output, target language, and the IRON RULE — numbers are quoted verbatim,
// never computed.

import { callGeminiJson } from "../_shared/llm/gemini.ts";

export interface GenericClientView {
  version: 1;
  language: "en" | "zh";
  intro: string;
  findings_plain: Array<{ title: string; plain: string }>;
  recommendations_plain: Array<{ title: string; plain: string }>;
  glossary: Array<{ term: string; plain: string }>;
  disclaimer: string;
}

type Prose = Omit<GenericClientView, "version" | "language">;

const GENERIC_CLIENT_VIEW_SCHEMA = {
  type: "OBJECT",
  properties: {
    intro: { type: "STRING" },
    findings_plain: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, plain: { type: "STRING" } },
        required: ["title", "plain"],
      },
    },
    recommendations_plain: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, plain: { type: "STRING" } },
        required: ["title", "plain"],
      },
    },
    glossary: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { term: { type: "STRING" }, plain: { type: "STRING" } },
        required: ["term", "plain"],
      },
    },
    disclaimer: { type: "STRING" },
  },
  required: [
    "intro",
    "findings_plain",
    "recommendations_plain",
    "glossary",
    "disclaimer",
  ],
};

export function buildGenericClientViewPrompt(
  sectionLabel: { en: string; zh: string },
  payload: unknown,
  language: "en" | "zh",
): string {
  const languageInstruction = language === "zh"
    ? [
      "OUTPUT LANGUAGE: Simplified Chinese (简体中文). EVERY string in your JSON",
      "output MUST be written in Simplified Chinese for an ordinary Malaysian-",
      "Chinese layperson with no finance knowledge. Warm, clear, everyday words.",
      "Amounts stay as-is (e.g. RM500,000).",
    ]
    : [
      "OUTPUT LANGUAGE: plain English. EVERY string MUST be simple, warm English",
      "for an ordinary layperson. Short sentences, everyday words, no jargon",
      "except where the glossary defines it.",
    ];
  return [
    "You are helping a licensed Malaysian financial advisor turn a technical",
    `"${sectionLabel.en}" (${sectionLabel.zh}) analysis into a friendly,`,
    "easy-to-read summary FOR THE CLIENT themselves — an ordinary member of the",
    'public. Refer to the reader warmly as "you"/"your" (在中文里用「您」).',
    "Never invent or use any name.",
    "",
    "IRON RULE: Every monetary amount below is final, computed by deterministic",
    "code. Quote amounts verbatim (thousand separators allowed). NEVER compute,",
    "modify, infer, or invent any amount. If a figure is not in the input,",
    "describe it in words instead.",
    "",
    "PRIVACY: The input is already free of personal details. Do NOT add any",
    "names, companies, product names, policy numbers, dates or contact details.",
    "",
    ...languageInstruction,
    "",
    "Produce this JSON:",
    "1) intro — ONE short, warm paragraph introducing what this section covers",
    "   and why it matters for the reader's life. No numbers required.",
    "2) findings_plain — 2 to 5 items {title, plain}: the key things we found,",
    "   each rewritten so the reader can FEEL what it means for their family and",
    "   everyday life. Quote figures verbatim where the input cites them.",
    "3) recommendations_plain — one item per input recommendation, SAME ORDER,",
    "   {title, plain}: what to do next, encouraging and non-pushy. Never name",
    "   any specific product, plan or company.",
    "4) glossary — 3 to 6 jargon terms that actually appear in this section,",
    "   each {term, plain} in one friendly sentence.",
    "5) disclaimer — 1-2 plain sentences: this is a general review based on the",
    "   information provided, not personalised investment advice; figures are",
    "   estimates.",
    "",
    "Section analysis JSON (sole source of facts and numbers):",
    JSON.stringify(payload),
  ].join("\n");
}

export async function generateGenericClientView(
  sectionLabel: { en: string; zh: string },
  payload: unknown,
  language: "en" | "zh",
  apiKey: string,
): Promise<GenericClientView> {
  const prose = await callGeminiJson<Prose>(
    buildGenericClientViewPrompt(sectionLabel, payload, language),
    GENERIC_CLIENT_VIEW_SCHEMA,
    apiKey,
  );
  return { version: 1, language, ...prose };
}
