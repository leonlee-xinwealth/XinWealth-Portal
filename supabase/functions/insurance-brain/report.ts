// CFP report generation. Provider-abstracted: phase 1 uses Gemini free tier;
// swap the implementation behind generateReport to move to Claude later.
// The LLM narrates deterministic CNA numbers — it must never compute them.

import type { CnaResult } from "./cna.ts";
import type { CfpFinancials } from "./mapping.ts";
import { annualPremiumTotal } from "./mapping.ts";

// flash-lite has separate (and roomier) free-tier quota than flash — the
// funnel engine's extraction step already relies on it staying available.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface ReportSections {
  gaps: Array<{ category: string; level: string; note: string }>;
  recommendations: string[];
  overall_comment: string;
}

/** Placeholder draft used when the LLM is unavailable — keeps the lead alive. */
export function placeholderReport(): ReportSections {
  return {
    gaps: [],
    recommendations: ["此报告需人工解读：AI 报告生成暂时不可用，请顾问手动补充。"],
    overall_comment: "需人工解读",
  };
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    gaps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: {
            type: "STRING",
            enum: ["人寿保障", "重疾保障", "医疗保障", "意外保障", "残疾收入保障", "储蓄与退休"],
          },
          level: { type: "STRING", enum: ["充足", "尚可", "不足", "缺失", "未知"] },
          note: { type: "STRING" },
        },
        required: ["category", "level", "note"],
      },
    },
    recommendations: { type: "ARRAY", items: { type: "STRING" } },
    overall_comment: { type: "STRING" },
  },
  required: ["gaps", "recommendations", "overall_comment"],
};

function buildPrompt(cna: CnaResult, financials: CfpFinancials): string {
  const age = financials.client.date_of_birth
    ? Math.floor(
      (Date.now() - new Date(financials.client.date_of_birth).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    )
    : null;
  const premiumTotal = annualPremiumTotal(financials.policies);
  // Only non-identifying fields reach the LLM: no name/NRIC/email/phone/DOB,
  // and liabilities.name (free-text, advisor-entered — may contain a real
  // person's name, e.g. "Ahmad's car loan") is dropped, keeping only type
  // and amount.
  const clientContext = {
    age,
    occupation: financials.client.occupation,
    dependents: financials.client.number_of_dependants,
    retirement_age: financials.client.retirement_age,
    annual_premium_total: premiumTotal,
    policies: financials.policies.map((p) => ({
      policy_type: p.policy_type,
      sum_assured: p.sum_assured,
      premium: p.premium,
      premium_frequency: p.premium_frequency,
    })),
    liabilities: financials.liabilities.map((l) => ({
      liability_type: l.liability_type,
      outstanding_balance: l.outstanding_balance,
    })),
  };
  return [
    "你是马来西亚持牌理财顾问的分析助手。这是一次 comprehensive financial planning 的保险深度分析，",
    "客户已提供完整财务资料。基于以下客户概况与已算好的资本需求分析（CNA）结果，输出评估部分（中文）。",
    "",
    "【铁律】CNA JSON 里的所有金额是确定性代码算出的最终数字，你不得自行计算、修改或推算任何金额；",
    "引用金额时必须逐字使用 CNA 数字（可加千分位格式）。",
    "",
    "要求：",
    "1) 六大类保障（人寿/重疾/医疗/意外/残疾收入/储蓄退休）逐类评估，结合客户年龄、受抚养人与收入；",
    "   人寿与重疾必须引用 CNA 的 need/covered/gap 数字；资料不足的类别 level 填「未知」；每条 note 不超过 100 字；",
    "2) 3-5 条具体建议：加保方向与额度直接引用 CNA gap 数字；说明建议保费预算占年收入比例",
    "   （客户当前年保费总额已在 annual_premium_total，年收入在 CNA inputs.annual_income，只描述比例概念，不自行算新数字）；",
    "   包含一条身故情景现金流说明（现有保障+流动资产 vs 需求，用 CNA 数字）；",
    "   禁止推荐任何具体保险产品或公司；",
    "3) overall_comment 用 2-3 句总结整体保障健康度与最优先行动。",
    "4) 语气专业、客观、易懂；这是给顾问审核的草稿，顾问会再修改。",
    "",
    "客户概况 JSON：",
    JSON.stringify(clientContext),
    "",
    "CNA JSON（唯一数字来源）：",
    JSON.stringify(cna),
  ].join("\n");
}

async function callGemini(
  prompt: string,
  apiKey: string,
): Promise<ReportSections> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(
      `Gemini empty response, finishReason=${j.candidates?.[0]?.finishReason ?? "n/a"}`,
    );
  }
  return JSON.parse(text) as ReportSections;
}

/** Generate the CFP report draft; retries twice, throws on final failure. */
export async function generateReport(
  cna: CnaResult,
  financials: CfpFinancials,
  apiKey: string,
): Promise<ReportSections> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  const prompt = buildPrompt(cna, financials);
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callGemini(prompt, apiKey);
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}
