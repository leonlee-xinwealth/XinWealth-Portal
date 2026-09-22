// 现金流会计科目表 — spec 2026-09-22 §3.0–3.2
// (docs/superpowers/specs/2026-09-22-cfp-financial-data-framework-design.md)
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE MUST HAVE NO IMPORTS — the same contract as ../cashflow/periods.ts.
// It is loaded by Deno edge functions, the Vite browser bundle, tsx scripts,
// and (through the committed api/_lib/taxonomy.mjs bundle) Vercel functions.
// ─────────────────────────────────────────────────────────────────────────────
//
// Every category carries a WEALTH EFFECT — what the money does to net worth:
//   income    net worth up          salary, rent, dividends
//   expense   net worth down        food, utilities, interest, premiums
//   transfer  net worth unchanged   savings → FD / fund / gold, selling shares,
//                                   EPF withdrawal, loan drawdown, card repayment
//   split     loan installment      principal is a transfer, interest an expense.
//                                   Until the P2 estimator splits it, the whole
//                                   installment still counts as spending.
//
// `link_to` names the object a row SHOULD be linked to (asset / liability /
// policy) so an asset's own cash flow can be summed. It does NOT decide whether
// a row is a transfer — the category does. Rental income linked to its condo is
// still income.

export type CashflowDirection = "inflow" | "outflow";
export type WealthEffect = "income" | "expense" | "transfer" | "split";
export type Recurrence = "recurring" | "irregular" | "one_off";
export type FixedVariable = "fixed" | "variable";
export type NeedWant = "need" | "want";
export type LinkTo = "asset" | "liability" | "policy" | "none";
export type CashflowGroupId =
  | "I1" | "I2" | "I3" | "I4"
  | "O1" | "O2" | "O3" | "O4" | "O5" | "O6" | "O7" | "O8" | "O9" | "O10";

export interface CashflowGroup {
  id: CashflowGroupId;
  direction: CashflowDirection;
  label_zh: string;
  label_en: string;
}

export interface CashflowCategory {
  code: string;
  label_zh: string;
  label_en: string;
  direction: CashflowDirection;
  group: CashflowGroupId;
  wealth_effect: WealthEffect;
  recurrence: Recurrence;
  /** outflows only */
  fixed_variable: FixedVariable | null;
  /** living costs (O4–O8) only */
  need_want: NeedWant | null;
  link_to: LinkTo;
  /** produced from a liability / policy / salary (P2); never keyed by hand then */
  auto_generated: boolean;
}

export const CASHFLOW_GROUPS: readonly CashflowGroup[] = [
  { id: "I1", direction: "inflow", label_zh: "主动收入", label_en: "Active income" },
  { id: "I2", direction: "inflow", label_zh: "被动收入", label_en: "Passive income" },
  { id: "I3", direction: "inflow", label_zh: "其他收入", label_en: "Other income" },
  { id: "I4", direction: "inflow", label_zh: "非收入流入", label_en: "Non-income inflows" },
  { id: "O1", direction: "outflow", label_zh: "储蓄与投资", label_en: "Saving & investing" },
  { id: "O2", direction: "outflow", label_zh: "债务偿还", label_en: "Debt service" },
  { id: "O3", direction: "outflow", label_zh: "保障", label_en: "Protection" },
  { id: "O4", direction: "outflow", label_zh: "住房", label_en: "Housing" },
  { id: "O5", direction: "outflow", label_zh: "交通", label_en: "Transport" },
  { id: "O6", direction: "outflow", label_zh: "日常生活", label_en: "Daily living" },
  { id: "O7", direction: "outflow", label_zh: "家庭与教育", label_en: "Family & education" },
  { id: "O8", direction: "outflow", label_zh: "生活方式", label_en: "Lifestyle" },
  { id: "O9", direction: "outflow", label_zh: "税务·宗教·人情", label_en: "Tax, religious & social" },
  { id: "O10", direction: "outflow", label_zh: "其他", label_en: "Other" },
];

type Traits = Pick<
  CashflowCategory,
  "wealth_effect" | "recurrence" | "fixed_variable" | "need_want" | "link_to" | "auto_generated"
>;

const GROUP_DEFAULTS: Record<CashflowGroupId, Traits> = {
  I1: { wealth_effect: "income", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I2: { wealth_effect: "income", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I3: { wealth_effect: "income", recurrence: "one_off", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  I4: { wealth_effect: "transfer", recurrence: "one_off", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O1: { wealth_effect: "transfer", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "asset", auto_generated: false },
  O2: { wealth_effect: "split", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "liability", auto_generated: true },
  O3: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "fixed", need_want: null, link_to: "policy", auto_generated: true },
  O4: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O5: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O6: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: null, link_to: "none", auto_generated: false },
  O7: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O8: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: "want", link_to: "none", auto_generated: false },
  O9: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: null, need_want: null, link_to: "none", auto_generated: false },
  O10: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: null, link_to: "none", auto_generated: false },
};

type Row = [code: string, label_zh: string, label_en: string, group: CashflowGroupId, overrides?: Partial<Traits>];

const ROWS: readonly Row[] = [
  // I1 主动收入
  ["salary_basic", "基本薪水", "Basic salary (gross)", "I1"],
  ["fixed_allowance", "固定津贴", "Fixed allowance", "I1"],
  ["overtime", "加班费", "Overtime pay", "I1"],
  ["bonus", "花红/奖金", "Bonus", "I1", { recurrence: "irregular" }],
  ["commission", "佣金/介绍费", "Commission / referral fee", "I1"],
  ["director_fee", "董事费/顾问费/专业费", "Director / advisory / professional fee", "I1"],
  ["business_income", "生意/自雇净收入", "Business / self-employed net income", "I1"],
  ["side_income", "副业/兼职", "Side income", "I1"],
  ["employer_epf", "雇主公积金供款", "Employer EPF contribution", "I1", { link_to: "asset", auto_generated: true }],
  ["active_income_other", "其他主动收入", "Other active income", "I1"],
  // I2 被动收入
  ["rental_income", "租金收入", "Rental income", "I2", { link_to: "asset" }],
  ["dividend_company", "自家公司股息", "Dividend from own company", "I2", { link_to: "asset" }],
  ["dividend_investment", "投资股息/基金派息", "Investment dividend / distribution", "I2", { link_to: "asset" }],
  ["interest_income", "利息收入", "Interest income", "I2", { link_to: "asset" }],
  ["royalty", "版税/授权费", "Royalty / licensing", "I2"],
  ["pension_annuity", "退休金/年金", "Pension / annuity", "I2"],
  ["policy_cash_payout", "保单生存金/现金红利", "Policy cash payout / survival benefit", "I2", { link_to: "policy" }],
  ["passive_income_other", "其他被动收入", "Other passive income", "I2"],
  // I3 其他收入 (non-recurring: kept out of recurring-income ratios)
  ["government_aid", "政府援助", "Government aid (STR etc.)", "I3"],
  ["family_support_in", "家人给的生活费", "Family support received", "I3", { recurrence: "recurring" }],
  ["gift_inheritance", "赠与/遗产", "Gift / inheritance", "I3"],
  ["insurance_claim", "保险理赔", "Insurance claim payout", "I3", { link_to: "policy" }],
  ["policy_surrender_maturity", "保单退保/满期所得", "Policy surrender / maturity proceeds", "I3", { link_to: "policy" }],
  ["tax_refund", "退税", "Tax refund", "I3"],
  ["other_income", "其他收入", "Other income", "I3"],
  // I4 非收入流入
  ["asset_sale", "出售资产所得", "Asset sale proceeds", "I4", { link_to: "asset" }],
  ["savings_withdrawal", "从储蓄/定存/投资提取", "Withdrawal from savings / FD / investments", "I4", { link_to: "asset" }],
  ["epf_withdrawal", "公积金提取", "EPF withdrawal", "I4", { link_to: "asset" }],
  ["loan_drawdown", "贷款拨款", "Loan drawdown", "I4", { link_to: "liability" }],
  ["borrowing_family", "向亲友借钱", "Borrowing from family / friends", "I4", { link_to: "liability" }],
  // O1 储蓄与投资
  ["to_savings", "转入储蓄/紧急基金", "Transfer to savings / emergency fund", "O1"],
  ["fd_placement", "存定期", "Fixed deposit placement", "O1"],
  ["unit_trust_contribution", "单位信托供款", "Unit trust contribution", "O1"],
  ["stock_etf_purchase", "股票/ETF 买入", "Stock / ETF purchase", "O1", { fixed_variable: "variable" }],
  ["asnb_contribution", "ASB/ASNB 存入", "ASB / ASNB contribution", "O1"],
  ["tabung_haji", "朝圣基金存入", "Tabung Haji deposit", "O1"],
  ["gold_purchase", "黄金/贵金属", "Gold / precious metals", "O1", { fixed_variable: "variable" }],
  ["crypto_purchase", "加密货币", "Crypto purchase", "O1", { fixed_variable: "variable" }],
  ["prs_contribution", "PRS 供款", "PRS contribution", "O1"],
  ["epf_voluntary", "EPF 自愿供款", "EPF voluntary contribution (i-Saraan)", "O1"],
  ["epf_employee", "雇员 EPF 供款", "Employee EPF contribution", "O1", { auto_generated: true }],
  ["sspn", "SSPN 教育储蓄", "SSPN education savings", "O1"],
  ["business_capital", "注资生意", "Business capital injection", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["lend_out", "借钱给别人", "Lending to others", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["asset_purchase", "购置资产首付/全款", "Asset purchase / down payment", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["investment_other", "其他储蓄投资", "Other saving & investing", "O1"],
  // O2 债务偿还
  ["mortgage_installment", "房贷月供", "Mortgage installment", "O2"],
  ["car_installment", "车贷月供", "Car loan (hire purchase) installment", "O2"],
  ["personal_loan_installment", "个人贷款月供", "Personal loan installment", "O2"],
  ["study_loan_installment", "教育贷款月供", "Study loan (PTPTN) installment", "O2"],
  ["renovation_loan_installment", "装修贷款月供", "Renovation loan installment", "O2"],
  ["asb_financing_installment", "ASB 贷款月供", "ASB financing installment", "O2"],
  ["business_loan_installment", "生意贷款月供", "Business loan installment", "O2"],
  ["bnpl_payment", "先买后付还款", "BNPL payment", "O2"],
  ["family_loan_repayment", "还亲友借款", "Family / friend loan repayment", "O2"],
  ["debt_other", "其他还款", "Other debt repayment", "O2", { auto_generated: false }],
  ["credit_card_payment", "信用卡还款", "Credit card payment", "O2", { wealth_effect: "transfer", fixed_variable: "variable", auto_generated: false }],
  ["finance_charges", "利息/逾期费/银行手续费", "Finance charges", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  ["share_margin_interest", "股票融资利息", "Share margin interest", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  // O3 保障 (all premiums are spending — D3)
  ["life_takaful", "人寿/家庭保障", "Life / family takaful", "O3"],
  ["medical_card", "医药卡", "Medical card", "O3"],
  ["critical_illness", "危疾", "Critical illness", "O3"],
  ["personal_accident", "个人意外", "Personal accident", "O3"],
  ["savings_plan_premium", "储蓄型/投资型保单保费", "Savings / investment-linked plan premium", "O3"],
  ["protection_other", "其他保费", "Other premiums", "O3", { auto_generated: false }],
  // O4 住房
  ["rent", "房租", "Rent", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["maintenance_fee", "管理费+偿债基金", "Maintenance fee & sinking fund", "O4", { fixed_variable: "fixed", need_want: "need", link_to: "asset" }],
  ["quit_rent_assessment", "地税/门牌税", "Quit rent & assessment tax", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["home_insurance", "房屋火险", "Houseowner / fire insurance", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["utilities", "水电/排污/燃气", "Utilities", "O4", { fixed_variable: "variable", need_want: "need" }],
  ["telco", "电话/网络/电视/串流", "Phone, internet, TV & streaming", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["home_repair", "房屋维修保养", "Home repair & upkeep", "O4", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["household_help", "女佣薪水/准证", "Domestic helper salary & levy", "O4", { fixed_variable: "fixed", need_want: "want" }],
  ["housing_other", "其他住房开销", "Other housing", "O4", { fixed_variable: "variable", need_want: "need" }],
  // O5 交通
  ["fuel", "油费", "Fuel", "O5", { fixed_variable: "variable", need_want: "need", link_to: "asset" }],
  ["toll_parking", "过路费/停车", "Tolls & parking", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["public_transport_ehailing", "公共交通/Grab", "Public transport & e-hailing", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["road_tax", "路税", "Road tax", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["motor_insurance", "汽车保险", "Motor insurance", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["car_service_repair", "保养维修", "Car servicing & repair", "O5", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["transport_other", "其他交通", "Other transport", "O5", { fixed_variable: "variable", need_want: "need" }],
  // O6 日常生活
  ["groceries", "杂货/菜市", "Groceries", "O6", { need_want: "need" }],
  ["dining_out", "外食/外卖", "Dining out & delivery", "O6", { need_want: "want" }],
  ["personal_care", "个人护理/理发/美容", "Personal care", "O6", { need_want: "need" }],
  ["clothing", "服装", "Clothing", "O6", { need_want: "want" }],
  ["health_medical", "看病/药物/牙科/眼科", "Medical, dental & optical (out of pocket)", "O6", { need_want: "need" }],
  ["fitness", "健身/运动", "Fitness & sports", "O6", { need_want: "want" }],
  ["living_other", "其他日常", "Other daily living", "O6", { need_want: "need" }],
  // O7 家庭与教育
  ["childcare", "托儿/保姆", "Childcare", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["school_fees", "学费", "School fees", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["tuition_enrichment", "补习/才艺班", "Tuition & enrichment", "O7", { fixed_variable: "fixed", need_want: "want" }],
  ["child_expenses", "孩子日常开销", "Children's daily expenses", "O7", { fixed_variable: "variable", need_want: "need" }],
  ["parents_allowance", "父母生活费", "Allowance to parents", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["other_dependants", "其他受养人", "Other dependants", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["self_education", "自我进修", "Self-education", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["pet_care", "宠物", "Pet care", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["family_other", "其他家庭开销", "Other family", "O7", { fixed_variable: "variable", need_want: "need" }],
  // O8 生活方式
  ["entertainment", "娱乐", "Entertainment", "O8"],
  ["travel", "旅游", "Travel", "O8", { recurrence: "irregular" }],
  ["hobbies", "兴趣爱好", "Hobbies", "O8"],
  ["subscriptions", "订阅服务", "Subscriptions", "O8", { fixed_variable: "fixed" }],
  ["shopping_gadgets", "购物/电子产品", "Shopping & gadgets", "O8"],
  ["lifestyle_other", "其他生活方式", "Other lifestyle", "O8"],
  // O9 税务·宗教·人情
  ["income_tax", "所得税", "Income tax (PCB / CP500)", "O9", { fixed_variable: "fixed" }],
  ["socso_eis", "SOCSO/EIS", "SOCSO / EIS", "O9", { fixed_variable: "fixed", auto_generated: true }],
  ["zakat_tithe", "天课/什一奉献", "Zakat / tithe", "O9", { fixed_variable: "fixed" }],
  ["donations", "捐款/慈善", "Donations & charity", "O9", { fixed_variable: "variable" }],
  ["festive_angpao", "节庆红包", "Festive ang pao / duit raya", "O9", { fixed_variable: "variable", recurrence: "irregular" }],
  ["gifts_social", "礼物/红白包", "Gifts & social obligations", "O9", { fixed_variable: "variable" }],
  ["obligation_other", "其他义务", "Other obligations", "O9", { fixed_variable: "variable" }],
  // O10 其他
  ["professional_fees", "专业服务费", "Professional fees", "O10"],
  ["other_expense", "其他支出", "Other expense", "O10"],
];

const GROUP_BY_ID = Object.fromEntries(
  CASHFLOW_GROUPS.map((g) => [g.id, g]),
) as Record<CashflowGroupId, CashflowGroup>;

function build([code, label_zh, label_en, group, overrides = {}]: Row): CashflowCategory {
  const g = GROUP_BY_ID[group];
  const t: Traits = { ...GROUP_DEFAULTS[group], ...overrides };
  return {
    code,
    label_zh,
    label_en,
    direction: g.direction,
    group,
    wealth_effect: t.wealth_effect,
    recurrence: t.recurrence,
    fixed_variable: g.direction === "outflow" ? t.fixed_variable : null,
    need_want: /^O[4-8]$/.test(group) ? t.need_want : null,
    link_to: t.link_to,
    auto_generated: t.auto_generated,
  };
}

export const CASHFLOW_CATEGORIES: readonly CashflowCategory[] = ROWS.map(build);

export const CATEGORY_BY_CODE: Readonly<Record<string, CashflowCategory>> = Object.fromEntries(
  CASHFLOW_CATEGORIES.map((c) => [c.code, c]),
);

/**
 * Codes the live cashflow_categories table held before 2026-09-23 that are no
 * longer offered, and the category each is now read as. Codes that survived
 * unchanged (bonus, commission, director_fee, rental_income, other_income,
 * other_expense) are ordinary categories and need no entry here.
 */
export const LEGACY_CATEGORY_MAP: Readonly<Record<string, string>> = {
  salary: "salary_basic",
  dividend: "dividend_company",
  investment_return: "dividend_investment",
  household: "living_other",
  transportation: "transport_other",
  dependants: "family_other",
  personal: "lifestyle_other",
  insurance_premium: "protection_other",
  loan_repayment: "debt_other",
  investment_contribution: "investment_other",
  tax: "income_tax",
  property_expense: "housing_other",
  property_maintenance: "maintenance_fee",
  miscellaneous: "other_expense",
};

/** The category a stored code means today — current or legacy — or null. */
export function resolveCategory(code: string | null | undefined): CashflowCategory | null {
  if (!code) return null;
  return CATEGORY_BY_CODE[code] ?? CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[code] ?? ""] ?? null;
}

/** Unknown codes read as plain income / spending, the pre-taxonomy behaviour. */
export function wealthEffectOf(
  code: string | null | undefined,
  direction: CashflowDirection,
): WealthEffect {
  return resolveCategory(code)?.wealth_effect ?? (direction === "inflow" ? "income" : "expense");
}

/** Display label; an unknown code falls back to itself rather than a blank. */
export function categoryLabel(code: string | null | undefined, lang: "zh" | "en"): string {
  const c = resolveCategory(code);
  if (!c) return code ?? "";
  return lang === "zh" ? c.label_zh : c.label_en;
}

export function groupOf(code: string | null | undefined): CashflowGroup | null {
  const c = resolveCategory(code);
  return c ? GROUP_BY_ID[c.group] : null;
}

export function categoriesOf(group: CashflowGroupId): CashflowCategory[] {
  return CASHFLOW_CATEGORIES.filter((c) => c.group === group);
}

/**
 * Every stored code — current or legacy — whose money stays the client's own.
 * ../cashflow/periods.ts keeps an inline copy because it may not import; a test
 * there pins the two lists together.
 */
export const TRANSFER_CATEGORY_CODES: readonly string[] = [
  ...CASHFLOW_CATEGORIES.filter((c) => c.wealth_effect === "transfer").map((c) => c.code),
  ...Object.keys(LEGACY_CATEGORY_MAP).filter(
    (k) => CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[k]].wealth_effect === "transfer",
  ),
].sort();
