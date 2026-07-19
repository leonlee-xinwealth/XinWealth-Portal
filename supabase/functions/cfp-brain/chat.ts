// Advisor ↔ agent chat + instruction-driven draft revision.
// 脱敏 discipline (three lines of defence):
//   1. deterministic det/baseline context is PII-free by construction;
//   2. section narrative enters via each module's chatContext/clientViewInput
//      whitelist — never raw content (policy numbers, providers stay out);
//   3. advisor free text is regex-redacted server-side (NRIC, long account
//      numbers) and the prompt forbids repeating personal identifiers.
// IRON RULE unchanged: chat explains and suggests; it never computes or
// changes a number. Revision regenerates ONLY narrative fields — deterministic
// figures are re-stamped from the existing content by the module's assemble.

import { callGeminiJson } from "../_shared/llm/gemini.ts";
import { SECTION_LABELS } from "./modules/registry.ts";
import type { FinancialBaseline, SectionType } from "./types.ts";

/** Malaysian NRIC (with or without dashes) and 8+ digit account-like runs. */
export function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{6}-\d{2}-\d{4}\b/g, "[REDACTED]")
    .replace(/\b\d{12}\b/g, "[REDACTED]")
    .replace(/\b\d{8,}\b/g, "[REDACTED]");
}

export interface ChatTurn {
  role: "advisor" | "agent";
  message: string;
}

const CHAT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { reply: { type: "STRING" } },
  required: ["reply"],
};

/** Baseline summary safe for chat context — aggregates only. */
export function baselineChatSummary(b: FinancialBaseline) {
  return {
    annual_income: b.annual_income,
    annual_expenses: b.annual_expenses,
    annual_surplus: b.annual_surplus,
    emergency_fund_actual: b.emergency_fund_actual,
    emergency_fund_need_high: b.emergency_fund_need_high,
    liquid_assets_after_emergency: b.liquid_assets_after_emergency,
    net_worth: b.net_worth,
    total_liabilities: b.total_liabilities,
    age: b.age,
    retirement_age: b.retirement_age,
    dependents: b.dependents,
    assumptions: b.assumptions,
    goal_education_need: b.goal_education_need ?? null,
  };
}

export function buildChatPrompt(
  sectionType: SectionType,
  personaAgent: string,
  det: unknown,
  baseline: FinancialBaseline,
  narrativeContext: unknown,
  history: ChatTurn[],
  advisorMessage: string,
): string {
  const label = SECTION_LABELS[sectionType];
  return [
    `You are "${personaAgent}", the paraplanner agent responsible for the`,
    `"${label.en}" (${label.zh}) section of a client's financial plan, chatting`,
    "with the licensed advisor who supervises you. Answer their questions about",
    "your analysis — why figures are what they are, what an assumption means,",
    "what would change if inputs changed — and take their viewpoints seriously.",
    "",
    "IRON RULE: every figure in the context below was computed by deterministic",
    "code. You must NOT compute, modify, or invent any amount. Quote figures",
    "verbatim. If asked to change numbers, explain that numbers move only when",
    "the client data or assumptions change, and which input drives them. If the",
    "advisor wants the narrative rewritten, tell them to use the revise action.",
    "",
    "PRIVACY: never state, guess or ask for any personal identifier (names,",
    "NRIC, policy numbers, account numbers, contact details). Refer to the",
    'client only as "the client".',
    "",
    "Reply in the language the advisor used (Chinese or English), concise and",
    "concrete — 1-3 short paragraphs, citing the relevant figures verbatim.",
    "Write natural prose — NEVER echo a JSON field name or code identifier from",
    "the context (e.g. over_budget, asset_transfers_monthly); use plain words.",
    "",
    "Deterministic analysis (sole source of numbers):",
    JSON.stringify(det),
    "",
    "Shared financial baseline summary:",
    JSON.stringify(baselineChatSummary(baseline)),
    "",
    "Current section narrative (advisor-editable draft):",
    JSON.stringify(narrativeContext ?? {}),
    "",
    "Conversation so far:",
    JSON.stringify(history),
    "",
    "Advisor's message:",
    advisorMessage,
  ].join("\n");
}

export async function generateChatReply(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const res = await callGeminiJson<{ reply: string }>(
    prompt,
    CHAT_RESPONSE_SCHEMA,
    apiKey,
    { temperature: 0.4 },
  );
  return res.reply;
}

/** Wrap a module's generate prompt with the advisor's revision instruction and
 * the current draft so the LLM regenerates the narrative honouring both. */
export function buildRevisePrompt(
  basePrompt: string,
  currentNarrative: unknown,
  instruction: string,
): string {
  return [
    basePrompt,
    "",
    "REVISION MODE: the advisor reviewed the current draft below and gave an",
    "instruction. Regenerate the FULL narrative JSON following the original",
    "tasks AND the advisor's instruction. Keep everything that the instruction",
    "does not touch as close to the current draft as possible. The IRON RULE",
    "still applies — quote deterministic figures verbatim, never invent any.",
    "",
    "Current draft narrative:",
    JSON.stringify(currentNarrative),
    "",
    "Advisor's instruction:",
    instruction,
  ].join("\n");
}
