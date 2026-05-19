// 每个 checklist item 的结构
export interface ChecklistItemTemplate {
  key: string;
  en: string;
  zh: string;
  triggersWon?: boolean;   // 勾选此项时若 client 是 prospect → 触发 pipeline_stage = closed_won
}

// 每种 case type 的 checklist 模板
export const CASE_TEMPLATES: Record<string, ChecklistItemTemplate[]> = {
  car_insurance: [
    { key: 'ask_client_renew',  en: 'Ask client if renewing',      zh: '询问客户是否续保' },
    { key: 'collect_voc',       en: 'Collect policy / VOC',        zh: '收集旧保单 / VOC' },
    { key: 'confirm_needs',     en: 'Confirm coverage needs',      zh: '确认保障需求' },
    { key: 'get_quotes',        en: 'Get 3 quotes',                zh: '获取 3 家报价' },
    { key: 'client_choice',     en: 'Client selects quote',        zh: '客户选择报价' },
    { key: 'received_payment',  en: 'Payment received',            zh: '收到付款凭证', triggersWon: true },
    { key: 'send_to_admin',     en: 'Submit to admin',             zh: '发给 admin' },
  ],
};

// Case type 的显示名称（供 UI 显示用）
export const CASE_TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  car_insurance: { en: 'Car Insurance', zh: '车险' },
};

export function getCaseTemplate(caseType: string): ChecklistItemTemplate[] {
  return CASE_TEMPLATES[caseType] ?? [];
}

export function getCaseTypeLabel(caseType: string, language: string): string {
  const label = CASE_TYPE_LABELS[caseType];
  if (!label) return caseType;
  return language === 'zh' ? label.zh : label.en;
}
