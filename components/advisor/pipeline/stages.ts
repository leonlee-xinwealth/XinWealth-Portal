export const STAGES = [
  { key: 'new_lead',      en: 'New Lead',          zh: '新线索',     color: 'slate',   bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200'  },
  { key: 'contacted',     en: 'Contacted',         zh: '已联系',     color: 'blue',    bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200'   },
  { key: 'interested',    en: 'Interested',        zh: '有意向',     color: 'amber',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200'  },
  { key: 'proposal_sent', en: 'Proposal Sent',     zh: '已发建议书', color: 'purple',  bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-200' },
  { key: 'closed_won',    en: 'Closed Won',        zh: '已成交',     color: 'emerald', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200'},
  { key: 'closed_lost',   en: 'Closed Lost',       zh: '已流失',     color: 'rose',    bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200'   },
] as const;

export type StageKey = typeof STAGES[number]['key'];

export const LEAD_SOURCES = [
  { key: 'referral',         en: 'Client Referral',     zh: '客户转介' },
  { key: 'partner_referral', en: 'Partner Referral',    zh: '伙伴转介' },
  { key: 'facebook',         en: 'Facebook',            zh: 'Facebook' },
  { key: 'instagram',        en: 'Instagram',           zh: 'Instagram'},
  { key: 'xiaohongshu',      en: 'Xiaohongshu',         zh: '小红书'   },
  { key: 'linkedin',         en: 'LinkedIn',            zh: 'LinkedIn' },
  { key: 'bni',              en: 'BNI',                 zh: 'BNI'      },
  { key: 'event',            en: 'Event / Seminar',     zh: '活动/讲座'},
  { key: 'walk_in',          en: 'Walk-in',             zh: '上门'     },
  { key: 'cp',               en: 'CP',                  zh: 'CP'       },
  { key: 'friends',          en: 'Friends',             zh: '朋友'     },
  { key: 'other',            en: 'Other',               zh: '其他'     },
] as const;

export type LeadSourceKey = typeof LEAD_SOURCES[number]['key'];

export const LOST_REASONS = [
  { key: 'price',        en: 'Price',                zh: '价格问题'   },
  { key: 'no_need',      en: 'No Need',              zh: '没有需求'   },
  { key: 'competitor',   en: 'Lost to Competitor',   zh: '转去竞争对手'},
  { key: 'lost_contact', en: 'Lost Contact',         zh: '失联'       },
  { key: 'timing',       en: 'Wrong Timing',         zh: '时机不对'   },
  { key: 'other',        en: 'Other',                zh: '其他'       },
] as const;

export type LostReasonKey = typeof LOST_REASONS[number]['key'];

export function getStage(key: string) {
  return STAGES.find(s => s.key === key) ?? STAGES[0];
}

export function getLeadSource(key: string | null) {
  return LEAD_SOURCES.find(s => s.key === key) ?? null;
}

export function getLostReason(key: string | null) {
  return LOST_REASONS.find(r => r.key === key) ?? null;
}
