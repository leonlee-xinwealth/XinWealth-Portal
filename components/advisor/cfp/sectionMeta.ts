// Static metadata for the 8 CFP report sections — the UI-side mirror of
// supabase/functions/cfp-brain/modules/registry.ts. Adding a section = one
// entry here + a renderer in renderers/.

export const CFP_SECTION_ORDER = [
  'cashflow_planning',
  'goals_planning',
  'insurance_planning',
  'investment_planning',
  'retirement_planning',
  'tax_planning',
  'legacy_planning',
  'financial_health',
] as const;

export type CfpSectionType = (typeof CFP_SECTION_ORDER)[number];

export interface SectionMeta {
  emoji: string;
  en: string;
  zh: string;
  agent: string;
  /** persona display name */
  personaZh: string;
  /** has a dedicated client PDF exporter */
  hasPdf?: boolean;
}

export const SECTION_META: Record<CfpSectionType, SectionMeta> = {
  cashflow_planning: {
    emoji: '💧', en: 'Cashflow & Budget', zh: '现金流规划与财务预算',
    agent: 'little_accountant', personaZh: '小会计',
  },
  goals_planning: {
    emoji: '🎯', en: 'Goal-Based Planning', zh: '特定目标规划',
    agent: 'goal_planner', personaZh: '目标规划师',
  },
  insurance_planning: {
    emoji: '🛡️', en: 'Insurance Planning', zh: '保险规划',
    agent: 'insurance_brain', personaZh: '保险佬', hasPdf: true,
  },
  investment_planning: {
    emoji: '📈', en: 'Investment & Allocation', zh: '投资规划与资产配置',
    agent: 'investment_master', personaZh: '投资大师',
  },
  retirement_planning: {
    emoji: '🌅', en: 'Retirement Planning', zh: '退休规划',
    agent: 'investment_master', personaZh: '投资大师',
  },
  tax_planning: {
    emoji: '🧾', en: 'Tax Planning', zh: '税务筹划',
    agent: 'tax_expert', personaZh: '税务专家',
  },
  legacy_planning: {
    emoji: '🏛️', en: 'Legacy & Estate', zh: '财富传承与遗产规划',
    agent: 'asset_expert', personaZh: '资产达人',
  },
  financial_health: {
    emoji: '❤️‍🩹', en: 'Overall Financial Health', zh: '整体财务健康',
    agent: 'chief_planner', personaZh: '首席规划师',
  },
};
