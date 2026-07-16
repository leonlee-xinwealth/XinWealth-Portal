// Deterministic Capital Need Analysis. All monetary math lives here — the LLM
// only narrates these numbers and must never compute or alter them.

export const CNA_DEFAULTS = {
  income_replacement_years: 10,
  education_per_child: 80000,
  education_inflation: 0.04,
  education_years: 10,
  ci_income_multiple: 3,
  rounding: 1000,
} as const;

export interface CnaInput {
  annual_income: number;
  /** true when income was estimated from a form band midpoint */
  income_estimated?: boolean;
  /** null = unknown (prospect mode), treated as 0 with an assumption note */
  liabilities_total: number | null;
  liquid_assets: number | null;
  life_cover: number;
  ci_cover: number;
  has_medical: boolean;
  dependents: number;
  /** real education-goal future cost (from client_goals via the CFP baseline);
   * replaces the per-child constant estimate when present */
  education_need_override?: number;
}

export interface CnaGap {
  key: "life" | "ci" | "medical";
  label: string;
  need?: number;
  covered?: number;
  gap?: number;
  flag_only?: boolean;
  has_cover?: boolean;
}

export interface CnaResult {
  assumptions: string[];
  inputs: CnaInput;
  needs: {
    income_replacement: number;
    liabilities: number;
    education: number;
    total_life: number;
    ci: number;
  };
  resources: {
    life_cover: number;
    ci_cover: number;
    liquid_assets: number;
  };
  gaps: CnaGap[];
  /** true when income is unknown/zero — numbers are not meaningful */
  insufficient: boolean;
}

const round = (n: number) =>
  Math.round(n / CNA_DEFAULTS.rounding) * CNA_DEFAULTS.rounding;

/** Midpoint (monthly RM) of the funnel form's income band; 0 if unrecognized. */
export function incomeBandMidpoint(band: string): number {
  const map: Record<string, number> = {
    "RM3,000 以下": 2000,
    "RM3,000-5,000": 4000,
    "RM5,000-8,000": 6500,
    "RM8,000-12,000": 10000,
    "RM12,000 以上": 15000,
  };
  return map[(band ?? "").trim()] ?? 0;
}

export function computeCna(input: CnaInput): CnaResult {
  const d = CNA_DEFAULTS;
  const useEducationOverride = input.education_need_override != null;
  const assumptions: string[] = [
    `收入替代年数按 ${d.income_replacement_years} 年计算`,
    useEducationOverride
      ? "教育金需求取自客户的真实教育目标（目标规划模块推算的未来成本）"
      : `教育金按每名受抚养人 RM${d.education_per_child.toLocaleString()}、` +
        `每年 ${d.education_inflation * 100}% 通胀、${d.education_years} 年期估算`,
    `重疾保障需求按年收入 ${d.ci_income_multiple} 倍估算`,
    `所有金额取整到最近 RM${d.rounding.toLocaleString()}`,
  ];

  if (input.income_estimated) {
    assumptions.push("年收入按表单收入区间中值估算，实际数字可能有出入");
  }
  if (input.liabilities_total === null) {
    assumptions.push("未提供负债资料，暂按 RM0 计算，实际缺口可能更大");
  }
  if (input.liquid_assets === null) {
    assumptions.push("未提供流动资产资料，暂按 RM0 计算");
  }

  const liabilities = input.liabilities_total ?? 0;
  const liquidAssets = input.liquid_assets ?? 0;

  const incomeReplacement = input.annual_income * d.income_replacement_years;
  const education = useEducationOverride
    ? input.education_need_override!
    : input.dependents * d.education_per_child *
      Math.pow(1 + d.education_inflation, d.education_years);
  const totalLifeNeed = incomeReplacement + liabilities + education;
  const ciNeed = input.annual_income * d.ci_income_multiple;

  const lifeCovered = input.life_cover + liquidAssets;
  const lifeGap = Math.max(0, totalLifeNeed - lifeCovered);
  const ciGap = Math.max(0, ciNeed - input.ci_cover);

  return {
    assumptions,
    inputs: input,
    needs: {
      income_replacement: round(incomeReplacement),
      liabilities: round(liabilities),
      education: round(education),
      total_life: round(totalLifeNeed),
      ci: round(ciNeed),
    },
    resources: {
      life_cover: round(input.life_cover),
      ci_cover: round(input.ci_cover),
      liquid_assets: round(liquidAssets),
    },
    gaps: [
      {
        key: "life",
        label: "人寿保障",
        need: round(totalLifeNeed),
        covered: round(lifeCovered),
        gap: round(lifeGap),
      },
      {
        key: "ci",
        label: "重疾保障",
        need: round(ciNeed),
        covered: round(input.ci_cover),
        gap: round(ciGap),
      },
      {
        key: "medical",
        label: "医疗保障",
        flag_only: true,
        has_cover: input.has_medical,
      },
    ],
    insufficient: input.annual_income <= 0,
  };
}
