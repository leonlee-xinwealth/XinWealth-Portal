// types/prs.ts
// PRS 开户申请的表单数据结构。form_data jsonb 的 TypeScript 形状。
// 字段命名与 clients 表重合的部分见 components/advisor/prs/prsSync.ts。

export interface PrsNominee {
  name: string;
  nric: string;
  mobile: string;
  email: string;
  percentage: string; // '50' 表示 50%
}

export interface CrsTaxResidence {
  country: string;
  tin: string;
  noTinReason: '' | 'A' | 'B' | 'C';
  reasonBExplanation: string;
}

export interface FundAllocation {
  fund: string;    // 基金名（如 'Principal RetireEasy 2050'）
  percent: string; // '100'
}

export interface PrsFormData {
  // ── 申请人类型（acc-opening 页1 顶部）
  applicant_type: '' | 'new' | 'existing';
  existing_ppa_account_no: string;
  applicant_category: '' | 'personal' | 'employee';
  employer_prs_contract_no: string; // Employee 时的 PRS Plus Partner Programme Contract No.
  staff_no: string;
  employment_date: string;          // YYYY-MM-DD

  // ── 个人资料
  salutation: string;               // Mr / Mrs / Ms / 其他
  full_name: string;
  nric: string;                     // 990101-14-1234（含或不含连字符均可，引擎会清洗）
  other_id_type: '' | 'old_ic' | 'police_id' | 'army_id' | 'passport';
  other_id_no: string;
  passport_country: string;
  passport_expiry: string;          // YYYY-MM-DD
  date_of_birth: string;            // YYYY-MM-DD
  gender: '' | 'male' | 'female';
  race: '' | 'bumiputera' | 'chinese' | 'indian' | 'others';
  race_other: string;
  nationality: string;              // 'Malaysian' 或其他
  marital_status: '' | 'single' | 'married' | 'widowed' | 'divorced';
  mothers_maiden_name: string;

  // ── 职业与收入（acc-opening 页1 勾选区）
  occupation_category: '' | 'executive' | 'management' | 'professional' | 'self_employed'
    | 'clerical' | 'skilled_worker' | 'government' | 'housewife' | 'retiree'
    | 'unemployed' | 'student' | 'others';
  occupation_other: string;
  nature_of_occupation: '' | 'agriculture_forestry' | 'construction' | 'education_health'
    | 'electricity_gas_water' | 'finance_insurance_property' | 'manufacturing'
    | 'mining_quarrying' | 'trading_restaurant_hotel' | 'transport_storage_communication' | 'others';
  nature_other: string;
  employer_name: string;
  monthly_income_bracket: '' | 'up_to_1500' | '1501_3000' | '3001_5000' | '5001_8000'
    | '8001_15000' | '15001_20000' | '20001_50000' | '50001_100000' | '100001_200000' | 'above_200000';

  // ── 联系与地址
  phone_mobile: string;
  phone_house: string;
  phone_office: string;
  email: string;
  corr_address: string;
  corr_postcode: string;
  corr_city: string;
  corr_state: string;
  corr_country: string;
  perm_same_as_corr: boolean;
  perm_address: string;
  perm_postcode: string;
  perm_city: string;
  perm_state: string;
  perm_country: string;

  // ── 资金来源与目的（acc-opening 页2）
  source_of_funds: '' | 'employment' | 'investment' | 'retirement' | 'sales_of_assets'
    | 'inheritance' | 'savings' | 'business' | 'others';
  source_of_funds_other: string;
  purpose: '' | 'investment' | 'retirement' | 'protection' | 'others';
  purpose_other: string;
  pep_status: '' | 'yes' | 'no';

  // ── 供款（acc-opening §2 / top-up 共用）
  contribution_amount: string;      // RM
  cheque_no: string;
  rsp_enabled: boolean;             // Regular Savings Plan
  rsp_bank: string;
  rsp_bank_account_no: string;
  rsp_amount: string;
  rsp_deduction_day: string;        // DD
  epf_redirection_percent: '' | '1' | '2' | '3' | '4' | '5' | '6' | '7';
  salary_deduction_rm: string;
  salary_deduction_percent: string;

  // ── 供款方向（acc-opening §3）
  contribution_direction: '' | 'do_it_for_me' | 'do_it_myself';
  difm_scheme: '' | 'prs_plus' | 'islamic_prs_plus';
  dim_allocations: FundAllocation[];

  // ── 账户号码
  ppa_account_no: string;           // 同步 clients.ppa_account_number
  prs_plus_account_no: string;
  epf_account_number: string;

  // ── Top Up 表专用
  topup_type: '' | 'topup' | 'change_direction';

  // ── 银行（个人账户）
  bank_name: string;
  bank_account_number: string;

  // ── 税务 / CRS（acc-opening 页7 自我声明）
  tax_residency: '' | 'resident' | 'non_resident';
  tin_number: string;
  place_of_birth: string;
  country_of_birth: string;
  crs_tax_residences: CrsTaxResidence[];   // 固定 3 行（可留空）

  // ── 受益人提名（ppa-nomination）
  religion_islam: '' | 'muslim' | 'non_muslim';
  nominees: PrsNominee[];                  // 固定 6 行（可留空）

  // ── ISA 适当性评估（isa-individual，客户作答部分）
  isa_mode: '' | 'new' | 'review';
  isa_education: '' | 'degree_above' | 'diploma' | 'stpm' | 'spm_below';
  isa_disposable_income: '' | 'below_5000' | '5001_8000' | '8001_15000' | 'above_15001';
  isa_commitment: '' | 'below_2000' | '2001_5000' | '5001_10000' | 'above_10001';
  isa_invest_pct: '' | 'below_10' | '11_20' | '21_30' | '31_40' | '41_50' | 'above_50';
  isa_expectation: '' | 'capital_growth' | 'regular_income' | 'capital_protection';
  isa_purpose: '' | 'asset_accumulation' | 'children_education' | 'retirement' | 'regular_income' | 'others';
  isa_purpose_other: string;
  isa_reasons: ('meet_objective' | 'risk_return' | 'strategy')[];
  isa_exp_unit_trust: string;   // 年数（字符串数字）
  isa_exp_bond: string;
  isa_exp_equities: string;
  isa_exp_derivatives: string;
  isa_exp_prs: string;
  isa_exp_others: string;
  // Part 3 风险评分题，值即分值
  isa_q1_age: '' | '1' | '3' | '5';
  isa_q2_experience: '' | '1' | '3' | '5';
  isa_q3_understanding: '' | '1' | '3' | '5';
  isa_q4_objective: '' | '1' | '3' | '5';
  isa_q5_duration: '' | '1' | '3' | '5';
  isa_q6_risk: '' | '1' | '3' | '5';
  // Part 5 弱势客户属性（多选；'none' 表示以上皆否）
  isa_vulnerable: ('elderly' | 'low_education' | 'no_experience' | 'limited_means' | 'breadwinner_loss' | 'impairment' | 'none')[];
  // Part 6 确认（5 题 YES/NO，按序）
  isa_acks: ('' | 'yes' | 'no')[];

  // ── 顾问专区（仅顾问端可见；token API 不下发、客户提交不可写）
  consultant_name: string;
  consultant_code: string;
  consultant_nric: string;
  consultant_phone: string;
  branch_name_code: string;
  distributor_code: string;
  channel: '' | 'prs_consultant' | 'corporate_prs_distributor' | 'institutional_prs_adviser';
  class_for_application: string;
  utc_recommended_category: '' | 'conservative' | 'moderate' | 'aggressive';
  utc_basis: ('risk_profile' | 'objectives_horizon' | 'complements_portfolio' | 'others')[];
  utc_basis_other: string;
  utc_funds: string[];          // 固定 5 行
  sign_date: string;            // YYYY-MM-DD，呈交日期，填到各表 Date 栏
}

/** 顾问专区字段（客户端不渲染、token API 剥除） */
export const ADVISOR_ONLY_KEYS: (keyof PrsFormData)[] = [
  'consultant_name', 'consultant_code', 'consultant_nric', 'consultant_phone',
  'branch_name_code', 'distributor_code', 'channel', 'class_for_application',
  'utc_recommended_category', 'utc_basis', 'utc_basis_other', 'utc_funds', 'sign_date',
];

export const initialPrsFormData: PrsFormData = {
  applicant_type: '', existing_ppa_account_no: '', applicant_category: '',
  employer_prs_contract_no: '', staff_no: '', employment_date: '',
  salutation: '', full_name: '', nric: '', other_id_type: '', other_id_no: '',
  passport_country: '', passport_expiry: '', date_of_birth: '', gender: '',
  race: '', race_other: '', nationality: 'Malaysian', marital_status: '', mothers_maiden_name: '',
  occupation_category: '', occupation_other: '', nature_of_occupation: '', nature_other: '',
  employer_name: '', monthly_income_bracket: '',
  phone_mobile: '', phone_house: '', phone_office: '', email: '',
  corr_address: '', corr_postcode: '', corr_city: '', corr_state: '', corr_country: 'Malaysia',
  perm_same_as_corr: true,
  perm_address: '', perm_postcode: '', perm_city: '', perm_state: '', perm_country: '',
  source_of_funds: '', source_of_funds_other: '', purpose: '', purpose_other: '', pep_status: '',
  contribution_amount: '', cheque_no: '',
  rsp_enabled: false, rsp_bank: '', rsp_bank_account_no: '', rsp_amount: '', rsp_deduction_day: '',
  epf_redirection_percent: '', salary_deduction_rm: '', salary_deduction_percent: '',
  contribution_direction: '', difm_scheme: '',
  dim_allocations: [],
  ppa_account_no: '', prs_plus_account_no: '', epf_account_number: '',
  topup_type: '', bank_name: '', bank_account_number: '',
  tax_residency: '', tin_number: '', place_of_birth: '', country_of_birth: '',
  crs_tax_residences: [
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
    { country: '', tin: '', noTinReason: '', reasonBExplanation: '' },
  ],
  religion_islam: '',
  nominees: Array.from({ length: 6 }, () => ({ name: '', nric: '', mobile: '', email: '', percentage: '' })),
  isa_mode: '', isa_education: '', isa_disposable_income: '', isa_commitment: '', isa_invest_pct: '',
  isa_expectation: '', isa_purpose: '', isa_purpose_other: '', isa_reasons: [],
  isa_exp_unit_trust: '', isa_exp_bond: '', isa_exp_equities: '', isa_exp_derivatives: '',
  isa_exp_prs: '', isa_exp_others: '',
  isa_q1_age: '', isa_q2_experience: '', isa_q3_understanding: '',
  isa_q4_objective: '', isa_q5_duration: '', isa_q6_risk: '',
  isa_vulnerable: [], isa_acks: ['', '', '', '', ''],
  consultant_name: '', consultant_code: '', consultant_nric: '', consultant_phone: '',
  branch_name_code: '', distributor_code: '', channel: '', class_for_application: '',
  utc_recommended_category: '', utc_basis: [], utc_basis_other: '',
  utc_funds: ['', '', '', '', ''],
  sign_date: '',
};

/** ISA Part 3 总分（任一题未答返回 null） */
export function isaTotalScore(d: PrsFormData): number | null {
  const answers = [d.isa_q1_age, d.isa_q2_experience, d.isa_q3_understanding,
    d.isa_q4_objective, d.isa_q5_duration, d.isa_q6_risk];
  if (answers.some(a => a === '')) return null;
  return answers.reduce((sum, a) => sum + parseInt(a, 10), 0);
}

/** 表格规则：6-13 conservative / 14-22 moderate / 23-30 aggressive */
export function riskProfileFromScore(score: number): 'conservative' | 'moderate' | 'aggressive' {
  if (score <= 13) return 'conservative';
  if (score <= 22) return 'moderate';
  return 'aggressive';
}

export interface PrsApplication {
  id: string;
  client_id: string | null;
  advisor_id: string;
  status: 'draft' | 'awaiting_client' | 'submitted' | 'completed' | 'cancelled';
  token: string | null;
  token_expires_at: string | null;
  form_data: PrsFormData;
  submitted_at: string | null;
  pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  client_full_name?: string; // join 字段
}
