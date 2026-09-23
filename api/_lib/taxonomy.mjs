// GENERATED FILE — do not edit.
// Source: supabase/functions/_shared/taxonomy/** (entry: index.ts)
// Rebuild: node scripts/build-taxonomy.mjs
// Committed so the plain-JS Vercel functions share the chart of accounts.

// supabase/functions/_shared/taxonomy/cashflow.ts
var CASHFLOW_GROUPS = [
  { id: "I1", direction: "inflow", label_zh: "\u4E3B\u52A8\u6536\u5165", label_en: "Active income" },
  { id: "I2", direction: "inflow", label_zh: "\u88AB\u52A8\u6536\u5165", label_en: "Passive income" },
  { id: "I3", direction: "inflow", label_zh: "\u5176\u4ED6\u6536\u5165", label_en: "Other income" },
  { id: "I4", direction: "inflow", label_zh: "\u975E\u6536\u5165\u6D41\u5165", label_en: "Non-income inflows" },
  { id: "O1", direction: "outflow", label_zh: "\u50A8\u84C4\u4E0E\u6295\u8D44", label_en: "Saving & investing" },
  { id: "O2", direction: "outflow", label_zh: "\u503A\u52A1\u507F\u8FD8", label_en: "Debt service" },
  { id: "O3", direction: "outflow", label_zh: "\u4FDD\u969C", label_en: "Protection" },
  { id: "O4", direction: "outflow", label_zh: "\u4F4F\u623F", label_en: "Housing" },
  { id: "O5", direction: "outflow", label_zh: "\u4EA4\u901A", label_en: "Transport" },
  { id: "O6", direction: "outflow", label_zh: "\u65E5\u5E38\u751F\u6D3B", label_en: "Daily living" },
  { id: "O7", direction: "outflow", label_zh: "\u5BB6\u5EAD\u4E0E\u6559\u80B2", label_en: "Family & education" },
  { id: "O8", direction: "outflow", label_zh: "\u751F\u6D3B\u65B9\u5F0F", label_en: "Lifestyle" },
  { id: "O9", direction: "outflow", label_zh: "\u7A0E\u52A1\xB7\u5B97\u6559\xB7\u4EBA\u60C5", label_en: "Tax, religious & social" },
  { id: "O10", direction: "outflow", label_zh: "\u5176\u4ED6", label_en: "Other" }
];
var GROUP_DEFAULTS = {
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
  O10: { wealth_effect: "expense", recurrence: "recurring", fixed_variable: "variable", need_want: null, link_to: "none", auto_generated: false }
};
var ROWS = [
  // I1 主动收入
  ["salary_basic", "\u57FA\u672C\u85AA\u6C34", "Basic salary (gross)", "I1"],
  ["fixed_allowance", "\u56FA\u5B9A\u6D25\u8D34", "Fixed allowance", "I1"],
  ["overtime", "\u52A0\u73ED\u8D39", "Overtime pay", "I1"],
  ["bonus", "\u82B1\u7EA2/\u5956\u91D1", "Bonus", "I1", { recurrence: "irregular" }],
  ["commission", "\u4F63\u91D1/\u4ECB\u7ECD\u8D39", "Commission / referral fee", "I1"],
  ["director_fee", "\u8463\u4E8B\u8D39/\u987E\u95EE\u8D39/\u4E13\u4E1A\u8D39", "Director / advisory / professional fee", "I1"],
  ["business_income", "\u751F\u610F/\u81EA\u96C7\u51C0\u6536\u5165", "Business / self-employed net income", "I1"],
  ["side_income", "\u526F\u4E1A/\u517C\u804C", "Side income", "I1"],
  ["employer_epf", "\u96C7\u4E3B\u516C\u79EF\u91D1\u4F9B\u6B3E", "Employer EPF contribution", "I1", { link_to: "asset", auto_generated: true }],
  ["active_income_other", "\u5176\u4ED6\u4E3B\u52A8\u6536\u5165", "Other active income", "I1"],
  // I2 被动收入
  ["rental_income", "\u79DF\u91D1\u6536\u5165", "Rental income", "I2", { link_to: "asset" }],
  ["dividend_company", "\u81EA\u5BB6\u516C\u53F8\u80A1\u606F", "Dividend from own company", "I2", { link_to: "asset" }],
  ["dividend_investment", "\u6295\u8D44\u80A1\u606F/\u57FA\u91D1\u6D3E\u606F", "Investment dividend / distribution", "I2", { link_to: "asset" }],
  ["interest_income", "\u5229\u606F\u6536\u5165", "Interest income", "I2", { link_to: "asset" }],
  ["royalty", "\u7248\u7A0E/\u6388\u6743\u8D39", "Royalty / licensing", "I2"],
  ["pension_annuity", "\u9000\u4F11\u91D1/\u5E74\u91D1", "Pension / annuity", "I2"],
  ["policy_cash_payout", "\u4FDD\u5355\u751F\u5B58\u91D1/\u73B0\u91D1\u7EA2\u5229", "Policy cash payout / survival benefit", "I2", { link_to: "policy" }],
  ["passive_income_other", "\u5176\u4ED6\u88AB\u52A8\u6536\u5165", "Other passive income", "I2"],
  // I3 其他收入 (non-recurring: kept out of recurring-income ratios)
  ["government_aid", "\u653F\u5E9C\u63F4\u52A9", "Government aid (STR etc.)", "I3"],
  ["family_support_in", "\u5BB6\u4EBA\u7ED9\u7684\u751F\u6D3B\u8D39", "Family support received", "I3", { recurrence: "recurring" }],
  ["gift_inheritance", "\u8D60\u4E0E/\u9057\u4EA7", "Gift / inheritance", "I3"],
  ["insurance_claim", "\u4FDD\u9669\u7406\u8D54", "Insurance claim payout", "I3", { link_to: "policy" }],
  ["policy_surrender_maturity", "\u4FDD\u5355\u9000\u4FDD/\u6EE1\u671F\u6240\u5F97", "Policy surrender / maturity proceeds", "I3", { link_to: "policy" }],
  ["tax_refund", "\u9000\u7A0E", "Tax refund", "I3"],
  ["other_income", "\u5176\u4ED6\u6536\u5165", "Other income", "I3"],
  // I4 非收入流入
  ["asset_sale", "\u51FA\u552E\u8D44\u4EA7\u6240\u5F97", "Asset sale proceeds", "I4", { link_to: "asset" }],
  ["savings_withdrawal", "\u4ECE\u50A8\u84C4/\u5B9A\u5B58/\u6295\u8D44\u63D0\u53D6", "Withdrawal from savings / FD / investments", "I4", { link_to: "asset" }],
  ["epf_withdrawal", "\u516C\u79EF\u91D1\u63D0\u53D6", "EPF withdrawal", "I4", { link_to: "asset" }],
  ["loan_drawdown", "\u8D37\u6B3E\u62E8\u6B3E", "Loan drawdown", "I4", { link_to: "liability" }],
  ["borrowing_family", "\u5411\u4EB2\u53CB\u501F\u94B1", "Borrowing from family / friends", "I4", { link_to: "liability" }],
  // O1 储蓄与投资
  ["to_savings", "\u8F6C\u5165\u50A8\u84C4/\u7D27\u6025\u57FA\u91D1", "Transfer to savings / emergency fund", "O1"],
  ["fd_placement", "\u5B58\u5B9A\u671F", "Fixed deposit placement", "O1"],
  ["unit_trust_contribution", "\u5355\u4F4D\u4FE1\u6258\u4F9B\u6B3E", "Unit trust contribution", "O1"],
  ["stock_etf_purchase", "\u80A1\u7968/ETF \u4E70\u5165", "Stock / ETF purchase", "O1", { fixed_variable: "variable" }],
  ["asnb_contribution", "ASB/ASNB \u5B58\u5165", "ASB / ASNB contribution", "O1"],
  ["tabung_haji", "\u671D\u5723\u57FA\u91D1\u5B58\u5165", "Tabung Haji deposit", "O1"],
  ["gold_purchase", "\u9EC4\u91D1/\u8D35\u91D1\u5C5E", "Gold / precious metals", "O1", { fixed_variable: "variable" }],
  ["crypto_purchase", "\u52A0\u5BC6\u8D27\u5E01", "Crypto purchase", "O1", { fixed_variable: "variable" }],
  ["prs_contribution", "PRS \u4F9B\u6B3E", "PRS contribution", "O1"],
  ["epf_voluntary", "EPF \u81EA\u613F\u4F9B\u6B3E", "EPF voluntary contribution (i-Saraan)", "O1"],
  ["epf_employee", "\u96C7\u5458 EPF \u4F9B\u6B3E", "Employee EPF contribution", "O1", { auto_generated: true }],
  ["sspn", "SSPN \u6559\u80B2\u50A8\u84C4", "SSPN education savings", "O1"],
  ["business_capital", "\u6CE8\u8D44\u751F\u610F", "Business capital injection", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["lend_out", "\u501F\u94B1\u7ED9\u522B\u4EBA", "Lending to others", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["asset_purchase", "\u8D2D\u7F6E\u8D44\u4EA7\u9996\u4ED8/\u5168\u6B3E", "Asset purchase / down payment", "O1", { recurrence: "one_off", fixed_variable: "variable" }],
  ["investment_other", "\u5176\u4ED6\u50A8\u84C4\u6295\u8D44", "Other saving & investing", "O1"],
  // O2 债务偿还
  ["mortgage_installment", "\u623F\u8D37\u6708\u4F9B", "Mortgage installment", "O2"],
  ["car_installment", "\u8F66\u8D37\u6708\u4F9B", "Car loan (hire purchase) installment", "O2"],
  ["personal_loan_installment", "\u4E2A\u4EBA\u8D37\u6B3E\u6708\u4F9B", "Personal loan installment", "O2"],
  ["study_loan_installment", "\u6559\u80B2\u8D37\u6B3E\u6708\u4F9B", "Study loan (PTPTN) installment", "O2"],
  ["renovation_loan_installment", "\u88C5\u4FEE\u8D37\u6B3E\u6708\u4F9B", "Renovation loan installment", "O2"],
  ["asb_financing_installment", "ASB \u8D37\u6B3E\u6708\u4F9B", "ASB financing installment", "O2"],
  ["business_loan_installment", "\u751F\u610F\u8D37\u6B3E\u6708\u4F9B", "Business loan installment", "O2"],
  ["bnpl_payment", "\u5148\u4E70\u540E\u4ED8\u8FD8\u6B3E", "BNPL payment", "O2"],
  ["family_loan_repayment", "\u8FD8\u4EB2\u53CB\u501F\u6B3E", "Family / friend loan repayment", "O2"],
  ["debt_other", "\u5176\u4ED6\u8FD8\u6B3E", "Other debt repayment", "O2", { auto_generated: false }],
  ["credit_card_payment", "\u4FE1\u7528\u5361\u8FD8\u6B3E", "Credit card payment", "O2", { wealth_effect: "transfer", fixed_variable: "variable", auto_generated: false }],
  ["finance_charges", "\u5229\u606F/\u903E\u671F\u8D39/\u94F6\u884C\u624B\u7EED\u8D39", "Finance charges", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  ["share_margin_interest", "\u80A1\u7968\u878D\u8D44\u5229\u606F", "Share margin interest", "O2", { wealth_effect: "expense", fixed_variable: "variable", auto_generated: false }],
  // O3 保障 (all premiums are spending — D3)
  ["life_takaful", "\u4EBA\u5BFF/\u5BB6\u5EAD\u4FDD\u969C", "Life / family takaful", "O3"],
  ["medical_card", "\u533B\u836F\u5361", "Medical card", "O3"],
  ["critical_illness", "\u5371\u75BE", "Critical illness", "O3"],
  ["personal_accident", "\u4E2A\u4EBA\u610F\u5916", "Personal accident", "O3"],
  ["savings_plan_premium", "\u50A8\u84C4\u578B/\u6295\u8D44\u578B\u4FDD\u5355\u4FDD\u8D39", "Savings / investment-linked plan premium", "O3"],
  ["protection_other", "\u5176\u4ED6\u4FDD\u8D39", "Other premiums", "O3", { auto_generated: false }],
  // O4 住房
  ["rent", "\u623F\u79DF", "Rent", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["maintenance_fee", "\u7BA1\u7406\u8D39+\u507F\u503A\u57FA\u91D1", "Maintenance fee & sinking fund", "O4", { fixed_variable: "fixed", need_want: "need", link_to: "asset" }],
  ["quit_rent_assessment", "\u5730\u7A0E/\u95E8\u724C\u7A0E", "Quit rent & assessment tax", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["home_insurance", "\u623F\u5C4B\u706B\u9669", "Houseowner / fire insurance", "O4", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["utilities", "\u6C34\u7535/\u6392\u6C61/\u71C3\u6C14", "Utilities", "O4", { fixed_variable: "variable", need_want: "need" }],
  ["telco", "\u7535\u8BDD/\u7F51\u7EDC/\u7535\u89C6/\u4E32\u6D41", "Phone, internet, TV & streaming", "O4", { fixed_variable: "fixed", need_want: "need" }],
  ["home_repair", "\u623F\u5C4B\u7EF4\u4FEE\u4FDD\u517B", "Home repair & upkeep", "O4", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["household_help", "\u5973\u4F63\u85AA\u6C34/\u51C6\u8BC1", "Domestic helper salary & levy", "O4", { fixed_variable: "fixed", need_want: "want" }],
  ["housing_other", "\u5176\u4ED6\u4F4F\u623F\u5F00\u9500", "Other housing", "O4", { fixed_variable: "variable", need_want: "need" }],
  // O5 交通
  ["fuel", "\u6CB9\u8D39", "Fuel", "O5", { fixed_variable: "variable", need_want: "need", link_to: "asset" }],
  ["toll_parking", "\u8FC7\u8DEF\u8D39/\u505C\u8F66", "Tolls & parking", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["public_transport_ehailing", "\u516C\u5171\u4EA4\u901A/Grab", "Public transport & e-hailing", "O5", { fixed_variable: "variable", need_want: "need" }],
  ["road_tax", "\u8DEF\u7A0E", "Road tax", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["motor_insurance", "\u6C7D\u8F66\u4FDD\u9669", "Motor insurance", "O5", { fixed_variable: "fixed", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["car_service_repair", "\u4FDD\u517B\u7EF4\u4FEE", "Car servicing & repair", "O5", { fixed_variable: "variable", need_want: "need", recurrence: "irregular", link_to: "asset" }],
  ["transport_other", "\u5176\u4ED6\u4EA4\u901A", "Other transport", "O5", { fixed_variable: "variable", need_want: "need" }],
  // O6 日常生活
  ["groceries", "\u6742\u8D27/\u83DC\u5E02", "Groceries", "O6", { need_want: "need" }],
  ["dining_out", "\u5916\u98DF/\u5916\u5356", "Dining out & delivery", "O6", { need_want: "want" }],
  ["personal_care", "\u4E2A\u4EBA\u62A4\u7406/\u7406\u53D1/\u7F8E\u5BB9", "Personal care", "O6", { need_want: "need" }],
  ["clothing", "\u670D\u88C5", "Clothing", "O6", { need_want: "want" }],
  ["health_medical", "\u770B\u75C5/\u836F\u7269/\u7259\u79D1/\u773C\u79D1", "Medical, dental & optical (out of pocket)", "O6", { need_want: "need" }],
  ["fitness", "\u5065\u8EAB/\u8FD0\u52A8", "Fitness & sports", "O6", { need_want: "want" }],
  ["living_other", "\u5176\u4ED6\u65E5\u5E38", "Other daily living", "O6", { need_want: "need" }],
  // O7 家庭与教育
  ["childcare", "\u6258\u513F/\u4FDD\u59C6", "Childcare", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["school_fees", "\u5B66\u8D39", "School fees", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["tuition_enrichment", "\u8865\u4E60/\u624D\u827A\u73ED", "Tuition & enrichment", "O7", { fixed_variable: "fixed", need_want: "want" }],
  ["child_expenses", "\u5B69\u5B50\u65E5\u5E38\u5F00\u9500", "Children's daily expenses", "O7", { fixed_variable: "variable", need_want: "need" }],
  ["parents_allowance", "\u7236\u6BCD\u751F\u6D3B\u8D39", "Allowance to parents", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["other_dependants", "\u5176\u4ED6\u53D7\u517B\u4EBA", "Other dependants", "O7", { fixed_variable: "fixed", need_want: "need" }],
  ["self_education", "\u81EA\u6211\u8FDB\u4FEE", "Self-education", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["pet_care", "\u5BA0\u7269", "Pet care", "O7", { fixed_variable: "variable", need_want: "want" }],
  ["family_other", "\u5176\u4ED6\u5BB6\u5EAD\u5F00\u9500", "Other family", "O7", { fixed_variable: "variable", need_want: "need" }],
  // O8 生活方式
  ["entertainment", "\u5A31\u4E50", "Entertainment", "O8"],
  ["travel", "\u65C5\u6E38", "Travel", "O8", { recurrence: "irregular" }],
  ["hobbies", "\u5174\u8DA3\u7231\u597D", "Hobbies", "O8"],
  ["subscriptions", "\u8BA2\u9605\u670D\u52A1", "Subscriptions", "O8", { fixed_variable: "fixed" }],
  ["shopping_gadgets", "\u8D2D\u7269/\u7535\u5B50\u4EA7\u54C1", "Shopping & gadgets", "O8"],
  ["lifestyle_other", "\u5176\u4ED6\u751F\u6D3B\u65B9\u5F0F", "Other lifestyle", "O8"],
  // O9 税务·宗教·人情
  ["income_tax", "\u6240\u5F97\u7A0E", "Income tax (PCB / CP500)", "O9", { fixed_variable: "fixed" }],
  ["socso_eis", "SOCSO/EIS", "SOCSO / EIS", "O9", { fixed_variable: "fixed", auto_generated: true }],
  ["zakat_tithe", "\u5929\u8BFE/\u4EC0\u4E00\u5949\u732E", "Zakat / tithe", "O9", { fixed_variable: "fixed" }],
  ["donations", "\u6350\u6B3E/\u6148\u5584", "Donations & charity", "O9", { fixed_variable: "variable" }],
  ["festive_angpao", "\u8282\u5E86\u7EA2\u5305", "Festive ang pao / duit raya", "O9", { fixed_variable: "variable", recurrence: "irregular" }],
  ["gifts_social", "\u793C\u7269/\u7EA2\u767D\u5305", "Gifts & social obligations", "O9", { fixed_variable: "variable" }],
  ["obligation_other", "\u5176\u4ED6\u4E49\u52A1", "Other obligations", "O9", { fixed_variable: "variable" }],
  // O10 其他
  ["professional_fees", "\u4E13\u4E1A\u670D\u52A1\u8D39", "Professional fees", "O10"],
  ["other_expense", "\u5176\u4ED6\u652F\u51FA", "Other expense", "O10"]
];
var GROUP_BY_ID = Object.fromEntries(
  CASHFLOW_GROUPS.map((g) => [g.id, g])
);
function build([code, label_zh, label_en, group, overrides = {}]) {
  const g = GROUP_BY_ID[group];
  const t = { ...GROUP_DEFAULTS[group], ...overrides };
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
    auto_generated: t.auto_generated
  };
}
var CASHFLOW_CATEGORIES = ROWS.map(build);
var CATEGORY_BY_CODE = Object.fromEntries(
  CASHFLOW_CATEGORIES.map((c) => [c.code, c])
);
var LEGACY_CATEGORY_MAP = {
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
  miscellaneous: "other_expense"
};
function resolveCategory(code) {
  if (!code)
    return null;
  return CATEGORY_BY_CODE[code] ?? CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[code] ?? ""] ?? null;
}
function wealthEffectOf(code, direction) {
  return resolveCategory(code)?.wealth_effect ?? (direction === "inflow" ? "income" : "expense");
}
function categoryLabel(code, lang) {
  const c = resolveCategory(code);
  if (!c)
    return code ?? "";
  return lang === "zh" ? c.label_zh : c.label_en;
}
function groupOf(code) {
  const c = resolveCategory(code);
  return c ? GROUP_BY_ID[c.group] : null;
}
function categoriesOf(group) {
  return CASHFLOW_CATEGORIES.filter((c) => c.group === group);
}
var TRANSFER_CATEGORY_CODES = [
  ...CASHFLOW_CATEGORIES.filter((c) => c.wealth_effect === "transfer").map((c) => c.code),
  ...Object.keys(LEGACY_CATEGORY_MAP).filter(
    (k) => CATEGORY_BY_CODE[LEGACY_CATEGORY_MAP[k]].wealth_effect === "transfer"
  )
].sort();

// supabase/functions/_shared/taxonomy/balance.ts
var ASSET_CLASSES = [
  { id: "A", label_zh: "\u6D41\u52A8\u8D44\u4EA7", label_en: "Liquid assets" },
  { id: "B", label_zh: "\u9000\u4F11\u4E13\u6237", label_en: "Retirement accounts" },
  { id: "C", label_zh: "\u6295\u8D44\u8D44\u4EA7", label_en: "Investment assets" },
  { id: "D", label_zh: "\u81EA\u7528\u8D44\u4EA7", label_en: "Personal-use assets" }
];
var ASSET_ROWS = [
  // A 流动资产
  ["savings", "\u50A8\u84C4/\u5F80\u6765\u6237\u53E3", "Savings / current account", "A", null, "liquid", false, null],
  ["fixed_deposit", "\u5B9A\u671F\u5B58\u6B3E", "Fixed deposit", "A", null, "liquid", false, null],
  ["money_market", "\u8D27\u5E01\u5E02\u573A\u57FA\u91D1", "Money market fund", "A", null, "liquid", false, null],
  ["cash_on_hand", "\u73B0\u91D1", "Cash on hand", "A", null, "liquid", false, null],
  ["ewallet", "\u7535\u5B50\u94B1\u5305", "E-wallet", "A", null, "liquid", false, null],
  ["foreign_currency", "\u5916\u5E01\u5B58\u6B3E", "Foreign currency deposit", "A", null, "liquid", false, null],
  // B 退休专户
  ["epf_account_1", "\u516C\u79EF\u91D1 \u9000\u4F11\u6237\u53E3", "EPF Akaun Persaraan", "B", null, "illiquid", true, null],
  ["epf_account_2", "\u516C\u79EF\u91D1 \u798F\u5229\u6237\u53E3", "EPF Akaun Sejahtera", "B", null, "illiquid", true, null],
  ["epf_account_3", "\u516C\u79EF\u91D1 \u7075\u6D3B\u6237\u53E3", "EPF Akaun Fleksibel", "B", null, "illiquid", true, null],
  ["prs", "\u79C1\u4EBA\u9000\u4F11\u8BA1\u5212 PRS", "Private Retirement Scheme", "B", null, "illiquid", true, null],
  // C 投资资产
  ["stock", "\u80A1\u7968", "Stocks", "C", "investment", "semi", true, "equity"],
  ["etf", "ETF", "ETF", "C", "investment", "semi", true, "equity"],
  ["unit_trust", "\u5355\u4F4D\u4FE1\u6258", "Unit trust", "C", "investment", "semi", true, "equity"],
  ["reit", "\u623F\u5730\u4EA7\u6295\u8D44\u4FE1\u6258", "REIT", "C", "income_producing", "semi", true, "equity"],
  ["bond", "\u503A\u5238/\u4F0A\u65AF\u5170\u503A\u5238", "Bond / sukuk", "C", "investment", "illiquid", true, "bond"],
  ["asnb", "ASB/ASNB", "ASNB (ASB / ASM)", "C", "investment", "semi", true, "bond"],
  ["tabung_haji", "\u671D\u5723\u57FA\u91D1", "Tabung Haji", "C", "investment", "illiquid", true, "bond"],
  ["gold", "\u9EC4\u91D1/\u8D35\u91D1\u5C5E", "Gold / precious metals", "C", "investment", "illiquid", true, "alternatives"],
  ["crypto", "\u52A0\u5BC6\u8D27\u5E01", "Crypto", "C", "investment", "illiquid", true, "alternatives"],
  ["forex", "\u5916\u6C47", "Forex", "C", "investment", "illiquid", true, "alternatives"],
  ["investment_property", "\u6295\u8D44\u623F\u4EA7", "Investment property", "C", "income_producing", "illiquid", false, null],
  ["land", "\u571F\u5730", "Land", "C", "investment", "illiquid", false, null],
  ["business", "\u4F01\u4E1A\u80A1\u6743", "Business equity", "C", "investment", "illiquid", false, "alternatives"],
  ["receivable", "\u501F\u51FA\u7684\u94B1", "Loan receivable", "C", "investment", "illiquid", false, null],
  ["sspn", "SSPN \u6559\u80B2\u50A8\u84C4", "SSPN", "C", "investment", "illiquid", false, null],
  ["other", "\u5176\u4ED6\u6295\u8D44\u8D44\u4EA7", "Other investment asset", "C", "investment", "illiquid", false, null],
  // D 自用资产
  ["own_residence", "\u81EA\u4F4F\u623F", "Own residence", "D", "personal_use", "illiquid", false, null],
  ["vehicle", "\u8F66", "Vehicle", "D", "personal_use", "illiquid", false, null],
  ["jewelry", "\u73E0\u5B9D", "Jewelry", "D", "personal_use", "illiquid", false, null],
  ["collectibles", "\u6536\u85CF\u54C1", "Collectibles", "D", "personal_use", "illiquid", false, null],
  ["personal_asset_other", "\u5176\u4ED6\u81EA\u7528\u8D44\u4EA7", "Other personal-use asset", "D", "personal_use", "illiquid", false, null],
  ["property", "\u623F\u4EA7\uFF08\u5F85\u786E\u8BA4\u7528\u9014\uFF09", "Property (purpose unconfirmed)", "D", "personal_use", "illiquid", false, null, false]
];
var ASSET_TYPES = ASSET_ROWS.map(
  ([code, label_zh, label_en, cls, purpose, liquidity, retirement, allocation, offered = true]) => ({
    code,
    label_zh,
    label_en,
    class: cls,
    default_purpose: purpose,
    liquidity,
    retirement_capital: retirement,
    allocation,
    offered
  })
);
var ASSET_BY_CODE = Object.fromEntries(
  ASSET_TYPES.map((a) => [a.code, a])
);
var EPF_ASSET_TYPES = ["epf_account_1", "epf_account_2", "epf_account_3"];
var LIQUID_ASSET_TYPES = ASSET_TYPES.filter((a) => a.class === "A").map((a) => a.code);
function assetTypeMeta(code) {
  return code ? ASSET_BY_CODE[code] ?? null : null;
}
function assetClassOf(code) {
  return assetTypeMeta(code)?.class ?? "D";
}
function isLiquid(code) {
  return assetClassOf(code) === "A";
}
function liquidityLevel(code) {
  const l = assetTypeMeta(code)?.liquidity ?? "illiquid";
  return l === "liquid" ? "high" : l === "semi" ? "medium" : "low";
}
function isRetirementCapital(code) {
  return assetTypeMeta(code)?.retirement_capital ?? false;
}
function allocationBucketOf(code) {
  return assetTypeMeta(code)?.allocation ?? null;
}
function assetTypeLabel(code, lang) {
  const a = assetTypeMeta(code);
  if (!a)
    return code ?? "";
  return lang === "zh" ? a.label_zh : a.label_en;
}
var LIABILITY_ROWS = [
  ["credit_card", "\u4FE1\u7528\u5361\u6B20\u6B3E", "Credit card balance", "short", true, false, "credit_card_payment"],
  ["bnpl", "\u5148\u4E70\u540E\u4ED8", "Buy now, pay later", "short", true, false, "bnpl_payment"],
  ["overdraft", "\u900F\u652F", "Overdraft", "short", true, false, "finance_charges"],
  ["tax_payable", "\u5E94\u7F34\u7A0E\u6B3E", "Tax payable", "short", false, false, "income_tax"],
  ["family_loan", "\u4EB2\u53CB\u501F\u6B3E", "Loan from family / friends", "short", false, false, "family_loan_repayment"],
  ["mortgage", "\u623F\u5C4B\u8D37\u6B3E", "Mortgage", "long", false, true, "mortgage_installment"],
  ["car_loan", "\u6C7D\u8F66\u8D37\u6B3E", "Car loan (hire purchase)", "long", false, true, "car_installment"],
  ["personal_loan", "\u4E2A\u4EBA\u8D37\u6B3E", "Personal loan", "long", true, false, "personal_loan_installment"],
  ["study_loan", "\u6559\u80B2\u8D37\u6B3E", "Study loan (PTPTN)", "long", false, false, "study_loan_installment"],
  ["renovation_loan", "\u88C5\u4FEE\u8D37\u6B3E", "Renovation loan", "long", false, false, "renovation_loan_installment"],
  ["asb_financing", "ASB \u8D37\u6B3E", "ASB financing", "long", false, true, "asb_financing_installment"],
  ["share_margin", "\u80A1\u7968\u878D\u8D44", "Share margin financing", "long", false, true, "share_margin_interest"],
  ["policy_loan", "\u4FDD\u5355\u8D37\u6B3E", "Policy loan", "long", false, true, null],
  ["business_loan", "\u5546\u4E1A\u8D37\u6B3E", "Business loan", "long", false, false, "business_loan_installment"],
  ["other", "\u5176\u4ED6\u8D1F\u503A", "Other liability", "long", false, false, "debt_other"]
];
var LIABILITY_TYPES = LIABILITY_ROWS.map(
  ([code, label_zh, label_en, term, high_interest, secured, installment_category]) => ({
    code,
    label_zh,
    label_en,
    term,
    high_interest,
    secured,
    installment_category
  })
);
var LIABILITY_BY_CODE = Object.fromEntries(
  LIABILITY_TYPES.map((l) => [l.code, l])
);
function liabilityTypeMeta(code) {
  return code ? LIABILITY_BY_CODE[code] ?? null : null;
}
function liabilityTypeLabel(code, lang) {
  const l = liabilityTypeMeta(code);
  if (!l)
    return code ?? "";
  return lang === "zh" ? l.label_zh : l.label_en;
}

// supabase/functions/_shared/taxonomy/legacy.ts
var OUTFLOW_NOTE_RULES = [
  { to: "self_education", pattern: /^school fees$/i, from: ["personal"] },
  { to: "motor_insurance", pattern: /car insurance|motor insurance/i },
  { to: "road_tax", pattern: /road tax/i },
  { to: "car_installment", pattern: /car loan|hire purchase|车贷/i },
  { to: "bnpl_payment", pattern: /pay ?later|bnpl|atome/i },
  { to: "subscriptions", pattern: /subscription|icloud|youtube|netflix|spotify|software|订阅/i },
  { to: "telco", pattern: /tel\/|mobile|internet|phone|\bdata\b|astro|unifi|wifi|电话|网络/i },
  { to: "utilities", pattern: /utilit|electric|water|\btnb\b|sewer|水电/i },
  { to: "groceries", pattern: /grocer|marketing|supermarket|买菜|杂货/i },
  { to: "home_repair", pattern: /home maintenance|repair|renovat|维修/i },
  { to: "household_help", pattern: /maid|helper|女佣/i },
  { to: "toll_parking", pattern: /parking|toll|停车/i },
  { to: "fuel", pattern: /petrol|fuel|diesel|汽油/i },
  { to: "public_transport_ehailing", pattern: /\bbus\b|mrt|lrt|taxi|car share|grab|e-hailing|train/i },
  { to: "car_service_repair", pattern: /servic|workshop|tyre|tire/i },
  { to: "health_medical", pattern: /medic|clinic|hospital|doctor|dental|optical|supplement|pharma|医/i },
  { to: "childcare", pattern: /child ?care|nursery|babysit|托儿/i },
  { to: "school_fees", pattern: /school|kindergar|tadika|university|college|学费/i },
  { to: "tuition_enrichment", pattern: /upgrading class|tuition|enrichment|补习/i },
  { to: "parents_allowance", pattern: /parent|mother|father|\bmum\b|\bdad\b|senior living|父母/i },
  { to: "other_dependants", pattern: /dependant/i },
  { to: "pet_care", pattern: /\bpets?\b|宠物/i },
  { to: "fitness", pattern: /gym|fitness|sport|健身/i },
  { to: "dining_out", pattern: /dining|restaurant|food delivery|foodpanda|外食/i },
  { to: "entertainment", pattern: /entertain|movie|cinema|karaoke|娱乐/i },
  { to: "personal_care", pattern: /personal care|clothing|salon|haircut|cosmetic|beauty/i },
  { to: "travel", pattern: /vacation|travel|holiday|trip|旅游/i },
  { to: "zakat_tithe", pattern: /zakat|tithe|天课/i },
  { to: "donations", pattern: /donation|charity|gift|捐/i },
  { to: "income_tax", pattern: /income tax|\bpcb\b|cp500|所得税/i },
  { to: "child_expenses", pattern: /child|\bkid|孩子|子女/i, weak: true },
  { to: "debt_other", pattern: /loan|repayment|installment|还款|贷款/i, weak: true },
  { to: "protection_other", pattern: /insurance|takaful|premium|保险|保费/i, weak: true },
  { to: "investment_other", pattern: /invest|unit trust|fixed deposit|\basb\b|\bprs\b|储蓄|投资/i, weak: true }
];
var KYC_YEARLY_NOTES = /* @__PURE__ */ new Set(["Vacation/ Travel", "Income Tax Expense"]);
var LEVELUP_INFLOW_LABELS = {
  "salary": "salary_basic",
  "bonus / one-off incentives": "bonus",
  "director fee": "director_fee",
  "commission / referral fee": "commission",
  "dividend from own company": "dividend_company",
  "investment dividends / interest": "dividend_investment",
  "rental income": "rental_income",
  "other": "other_income",
  "income": "other_income"
};
var LEVELUP_OUTFLOW_LABELS = {
  "household": "household",
  "transportation": "transportation",
  "dependants": "dependants",
  "personal": "personal",
  "miscellaneous": "miscellaneous",
  "other expenses": "other_expense",
  "expense": "other_expense"
};
var norm = (s) => s.trim().toLowerCase();
var isCatchAll = (code) => code.endsWith("_other") || code === "other_expense" || code === "other_income";
function withReason(c, reason) {
  return {
    ...c,
    needs_review: true,
    review_reason: c.review_reason ? `${c.review_reason}\uFF1B${reason}` : reason
  };
}
function classifyInflow(row) {
  const raw = row.category ?? "";
  const known = CATEGORY_BY_CODE[raw] ? raw : LEGACY_CATEGORY_MAP[raw] ?? LEVELUP_INFLOW_LABELS[norm(raw)] ?? null;
  let c = {
    code: known ?? "other_income",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null
  };
  if (!known)
    c = withReason(c, "\u65E0\u6CD5\u8BC6\u522B\u7684\u6536\u5165\u5206\u7C7B");
  if (c.code === "bonus" && row.is_recurring === false) {
    c = withReason(
      { ...c, frequency: "annual", is_recurring: true },
      "\u82B1\u7EA2\u5DF2\u6539\u4E3A\u6309\u5E74\u8BA1\u7B97\uFF0C\u8BF7\u786E\u8BA4\u91D1\u989D\u662F\u5168\u5E74\u603B\u989D"
    );
  }
  if (c.code === "other_income" && row.source_note) {
    c = withReason(c, "\u8BF7\u786E\u8BA4\u8FD9\u7B14\u6D41\u5165\u662F\u6536\u5165\uFF0C\u8FD8\u662F\u8D44\u4EA7\u53D8\u73B0\u6216\u501F\u6B3E\uFF08\u4E0D\u7B97\u6536\u5165\uFF09");
  }
  return c;
}
function classifyOutflow(row) {
  const raw = row.category ?? "";
  const legacy = LEVELUP_OUTFLOW_LABELS[norm(raw)] ?? raw;
  const current = CATEGORY_BY_CODE[legacy] ? legacy : null;
  const fallback = LEGACY_CATEGORY_MAP[legacy] ?? current;
  const note = (row.source_note ?? "").trim();
  if (current && !isCatchAll(current)) {
    return { code: current, frequency: null, is_recurring: null, needs_review: false, review_reason: null };
  }
  const isGroupLine = /^all\s*-/i.test(note);
  const matched = isGroupLine ? [] : OUTFLOW_NOTE_RULES.filter(
    (r) => (!r.from || r.from.includes(legacy)) && r.pattern.test(note)
  );
  const scoped = matched.find((r) => r.from);
  const hits = scoped ? [scoped] : matched;
  const strong = hits.filter((r) => !r.weak);
  const pick = strong[0] ?? hits[0] ?? null;
  let c = {
    code: pick?.to ?? fallback ?? "other_expense",
    frequency: null,
    is_recurring: null,
    needs_review: false,
    review_reason: null
  };
  if (new Set(strong.map((r) => r.to)).size > 1) {
    c = withReason(c, "\u4E00\u884C\u5305\u542B\u591A\u4E2A\u9879\u76EE\uFF0C\u8BF7\u62C6\u5206\u540E\u5206\u522B\u5F52\u7C7B");
  }
  if (!pick && !fallback)
    c = withReason(c, "\u65E0\u6CD5\u8BC6\u522B\u7684\u652F\u51FA\u5206\u7C7B");
  if (!pick && fallback && note && !isGroupLine) {
    c = withReason(c, "\u5907\u6CE8\u672A\u80FD\u81EA\u52A8\u5F52\u7C7B\uFF0C\u8BF7\u9009\u62E9\u5177\u4F53\u5206\u7C7B");
  }
  if (KYC_YEARLY_NOTES.has(note) && (row.frequency ?? "monthly") === "monthly") {
    c = withReason({ ...c, frequency: "annual" }, "KYC \u4E2D\u8BE5\u9879\u6309\u5E74\u586B\u5199\uFF0C\u5DF2\u6539\u4E3A\u6309\u5E74");
  }
  const cat = CATEGORY_BY_CODE[c.code];
  if (cat?.group === "O2" && cat.wealth_effect === "split") {
    c = withReason(c, "\u8FD8\u6B3E\u884C\uFF1A\u7B2C\u4E8C\u9636\u6BB5\u4F1A\u7531\u8D1F\u503A\u81EA\u52A8\u751F\u6210\u6708\u4F9B\uFF0C\u5C4A\u65F6\u53BB\u91CD");
  }
  if (cat?.group === "O3") {
    c = withReason(c, "\u4FDD\u8D39\u884C\uFF1A\u7B2C\u4E8C\u9636\u6BB5\u4F1A\u7531\u4FDD\u5355\u81EA\u52A8\u751F\u6210\uFF0C\u5C4A\u65F6\u53BB\u91CD");
  }
  return c;
}
function classifyCashflowRow(row) {
  return row.direction === "inflow" ? classifyInflow(row) : classifyOutflow(row);
}
var ASSET_NAME_RULES = [
  { to: "own_residence", pattern: /own ?stay|own house|自住|residence|my home/i, from: ["property"] },
  { to: "investment_property", pattern: /invest|for rent|rental|出租|投资/i, from: ["property"] },
  { to: "gold", pattern: /gold|emas|黄金|\bmiga\b/i, from: ["other"] },
  { to: "jewelry", pattern: /jewel|珠宝/i, from: ["other"] },
  { to: "asnb", pattern: /\basb\b|\basm\b|asnb|amanah saham/i, from: ["other"] },
  { to: "tabung_haji", pattern: /tabung haji/i, from: ["other"] },
  { to: "crypto", pattern: /crypto|bitcoin|\bbtc\b|\beth\b|加密/i, from: ["other"] },
  { to: "forex", pattern: /forex|\bfx\b|外汇/i, from: ["other"] },
  { to: "collectibles", pattern: /watch|\bart\b|collect|收藏/i, from: ["other"] }
];
function classifyAsset(a) {
  if (a.asset_type !== "property" && a.asset_type !== "other") {
    return { asset_type: a.asset_type, needs_review: false, review_reason: null };
  }
  const name = a.name ?? "";
  const hits = ASSET_NAME_RULES.filter((r) => r.from.includes(a.asset_type) && r.pattern.test(name));
  if (a.asset_type === "property") {
    if (hits.length === 1)
      return { asset_type: hits[0].to, needs_review: false, review_reason: null };
    return {
      asset_type: "own_residence",
      needs_review: true,
      review_reason: "\u8BF7\u786E\u8BA4\u8FD9\u9879\u623F\u4EA7\u662F\u81EA\u4F4F\u8FD8\u662F\u6295\u8D44"
    };
  }
  if (hits.length === 0) {
    return { asset_type: "other", needs_review: true, review_reason: "\u8BF7\u9009\u62E9\u5177\u4F53\u7684\u8D44\u4EA7\u7C7B\u578B" };
  }
  const distinct = new Set(hits.map((h) => h.to));
  return distinct.size > 1 ? { asset_type: hits[0].to, needs_review: true, review_reason: "\u540D\u79F0\u5305\u542B\u591A\u79CD\u8D44\u4EA7\uFF0C\u8BF7\u62C6\u5206\u6216\u786E\u8BA4\u7C7B\u578B" } : { asset_type: hits[0].to, needs_review: false, review_reason: null };
}
var LEVELUP_ASSET_LABELS = {
  "cash/savings": "savings",
  "fixed deposit": "fixed_deposit",
  "epf": "epf_account_1",
  "properties": "property",
  "vehicles": "vehicle",
  "other assets": "other",
  "etf": "etf",
  "stocks": "stock",
  "unit trusts": "unit_trust",
  "bonds": "bond",
  "forex": "forex",
  "gold/precious metals": "gold",
  "crypto": "crypto",
  "other investments": "other"
};
function levelUpAsset(label, description) {
  const mapped = LEVELUP_ASSET_LABELS[norm(label ?? "")] ?? "other";
  const c = classifyAsset({ asset_type: mapped, name: description ?? label ?? "" });
  return assetTypeMeta(c.asset_type) ? c : { asset_type: "other", needs_review: true, review_reason: "\u8BF7\u9009\u62E9\u5177\u4F53\u7684\u8D44\u4EA7\u7C7B\u578B" };
}
var LEVELUP_LIABILITY_LABELS = {
  "mortgage / property loan": "mortgage",
  "vehicle loan": "car_loan",
  "study loan": "study_loan",
  "personal loan": "personal_loan",
  "renovation loan": "renovation_loan",
  "other loans": "other"
};
function levelUpLiabilityType(label) {
  return LEVELUP_LIABILITY_LABELS[norm(label ?? "")] ?? "other";
}

// supabase/functions/_shared/finance/loans.ts
var LOAN_DEFAULTS = {
  mortgage: { rate_pct: 4.2, months: 300, rate_type: "reducing" },
  car_loan: { rate_pct: 3, months: 60, rate_type: "flat" },
  personal_loan: { rate_pct: 8, months: 60, rate_type: "reducing" },
  study_loan: { rate_pct: 1, months: 120, rate_type: "reducing" },
  renovation_loan: { rate_pct: 7, months: 60, rate_type: "reducing" },
  business_loan: { rate_pct: 7, months: 60, rate_type: "reducing" },
  asb_financing: { rate_pct: 4.5, months: 120, rate_type: "reducing" },
  family_loan: { rate_pct: 0, months: 36, rate_type: "reducing" },
  bnpl: { rate_pct: 0, months: 6, rate_type: "reducing" },
  tax_payable: { rate_pct: 0, months: 12, rate_type: "reducing" },
  other: { rate_pct: 6, months: 60, rate_type: "reducing" },
  credit_card: { rate_pct: 18, months: null, rate_type: "revolving" },
  overdraft: { rate_pct: 8, months: null, rate_type: "interest_only" },
  share_margin: { rate_pct: 6, months: null, rate_type: "interest_only" },
  policy_loan: null
};
var WARN_PAYMENT_BELOW_INTEREST = "\u6708\u4F9B\u4E0D\u8DB3\u4EE5\u652F\u4ED8\u5F53\u671F\u5229\u606F\uFF0C\u4F59\u989D\u6216\u5229\u7387\u53EF\u80FD\u6709\u8BEF";
var WARN_PAYMENT_TERM_SHORTFALL = "\u6708\u4F9B \xD7 \u5269\u4F59\u671F\u6570\u5C0F\u4E8E\u4F59\u989D\uFF0C\u6570\u636E\u53EF\u80FD\u6709\u8BEF";
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function monthsUntilEndDate(endDate, today) {
  if (!endDate)
    return null;
  const end = new Date(endDate);
  if (isNaN(end.getTime()))
    return null;
  const months = (end.getUTCFullYear() - today.getUTCFullYear()) * 12 + (end.getUTCMonth() - today.getUTCMonth()) - (end.getUTCDate() < today.getUTCDate() ? 1 : 0);
  return months > 0 ? months : null;
}
function reducingPayment(balance, rMonthly, months) {
  const n = Math.max(months, 1);
  if (rMonthly <= 0)
    return balance / n;
  return balance * rMonthly / (1 - Math.pow(1 + rMonthly, -n));
}
function monthsFromRatePayment(balance, rMonthly, payment) {
  if (rMonthly <= 0)
    return payment > 0 ? balance / payment : null;
  if (payment <= balance * rMonthly)
    return null;
  return -Math.log(1 - balance * rMonthly / payment) / Math.log(1 + rMonthly);
}
function solveRatePct(balance, payment, months) {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const implied = reducingPayment(balance, mid / 1200, months);
    if (implied > payment)
      hi = mid;
    else
      lo = mid;
  }
  return Math.round((lo + hi) / 2 * 1e4) / 1e4;
}
function estimateLoan(input, today = /* @__PURE__ */ new Date()) {
  const balanceNum = Number(input.outstanding_balance);
  const B = Number.isFinite(balanceNum) ? balanceNum : 0;
  const rawDefaults = Object.prototype.hasOwnProperty.call(LOAN_DEFAULTS, input.liability_type) ? LOAN_DEFAULTS[input.liability_type] : LOAN_DEFAULTS.other;
  const rateType = input.rate_type ?? rawDefaults?.rate_type ?? "reducing";
  const zero = () => ({
    monthly_payment: 0,
    annual_rate_pct: 0,
    remaining_months: 0,
    rate_type: rateType,
    interest_monthly: 0,
    principal_monthly: 0,
    estimated: [],
    warnings: []
  });
  if (B <= 0 || rawDefaults === null)
    return zero();
  const hasRate = input.interest_rate != null;
  const hasPayment = input.monthly_payment != null;
  const hasMonths = input.remaining_months != null;
  const warnings = [];
  const resolveDefaultMonths = () => {
    const fromEnd = monthsUntilEndDate(input.end_date, today);
    return fromEnd != null ? fromEnd : rawDefaults.months;
  };
  let months;
  let ratePct;
  let payment;
  let interestMonthly;
  let principalMonthly;
  if (rateType === "reducing") {
    if (hasMonths) {
      months = input.remaining_months;
    } else if (hasRate && hasPayment) {
      months = null;
    } else {
      months = resolveDefaultMonths();
    }
    ratePct = hasRate ? input.interest_rate : hasPayment && months != null ? solveRatePct(B, input.monthly_payment, months) : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    if (months == null && hasRate && hasPayment) {
      const derived = monthsFromRatePayment(B, rMonthly, input.monthly_payment);
      months = derived != null ? Math.max(1, Math.round(derived)) : null;
    }
    payment = hasPayment ? input.monthly_payment : reducingPayment(B, rMonthly, months ?? rawDefaults.months ?? 1);
    interestMonthly = B * rMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);
    if (payment <= interestMonthly)
      warnings.push(WARN_PAYMENT_BELOW_INTEREST);
    if (months != null && payment * months < B * 0.98)
      warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else if (rateType === "flat") {
    months = hasMonths ? input.remaining_months : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    const base = input.original_principal ?? B;
    interestMonthly = base * rMonthly;
    const n = months ?? 1;
    payment = hasPayment ? input.monthly_payment : B / Math.max(n, 1) + interestMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);
    if (months != null && payment * months < B * 0.98)
      warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else if (rateType === "revolving") {
    months = hasMonths ? input.remaining_months : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    interestMonthly = B * rMonthly;
    const minPayment = Math.min(B, Math.max(B * 0.05, 50));
    payment = hasPayment ? input.monthly_payment : minPayment;
    principalMonthly = Math.max(0, payment - interestMonthly);
    if (months != null && payment * months < B * 0.98)
      warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  } else {
    months = hasMonths ? input.remaining_months : resolveDefaultMonths();
    ratePct = hasRate ? input.interest_rate : rawDefaults.rate_pct;
    const rMonthly = ratePct / 1200;
    interestMonthly = B * rMonthly;
    payment = hasPayment ? input.monthly_payment : interestMonthly;
    principalMonthly = Math.max(0, payment - interestMonthly);
    if (months != null && payment * months < B * 0.98)
      warnings.push(WARN_PAYMENT_TERM_SHORTFALL);
  }
  const estimated = [];
  if (!hasPayment)
    estimated.push("monthly_payment");
  if (!hasRate)
    estimated.push("interest_rate");
  if (!hasMonths && months != null)
    estimated.push("remaining_months");
  return {
    monthly_payment: round2(payment),
    annual_rate_pct: ratePct,
    remaining_months: months,
    rate_type: rateType,
    interest_monthly: round2(interestMonthly),
    principal_monthly: round2(principalMonthly),
    estimated,
    warnings
  };
}

// supabase/functions/_shared/cashflow/periods.ts
var ANNUAL_OCCURRENCES = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0
};
var TRANSFER_CATEGORIES_INLINE = [
  "asnb_contribution",
  "asset_purchase",
  "asset_sale",
  "borrowing_family",
  "business_capital",
  "credit_card_payment",
  "crypto_purchase",
  "epf_employee",
  "epf_voluntary",
  "epf_withdrawal",
  "fd_placement",
  "gold_purchase",
  "investment_contribution",
  "investment_other",
  "lend_out",
  "loan_drawdown",
  "prs_contribution",
  "savings_withdrawal",
  "sspn",
  "stock_etf_purchase",
  "tabung_haji",
  "to_savings",
  "unit_trust_contribution"
];
var TRANSFER_SET = new Set(TRANSFER_CATEGORIES_INLINE);
function isAssetTransfer(r) {
  return isTransferCode(r.category);
}
function isTransferCode(code) {
  return code != null && TRANSFER_SET.has(code);
}
function yearOf(periodMonth) {
  const y = Number(String(periodMonth ?? "").slice(0, 4));
  return Number.isInteger(y) && y > 1900 && y < 3e3 ? y : null;
}
function monthOf(periodMonth) {
  const m = Number(String(periodMonth ?? "").slice(5, 7));
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
}
function isMonthlyActual(r) {
  return (r.frequency ?? "monthly") === "monthly";
}
function amountOf(r) {
  const n = Number(r.amount);
  return Number.isFinite(n) ? n : 0;
}
function recordedYears(rows) {
  const years = /* @__PURE__ */ new Set();
  for (const r of rows ?? []) {
    const y = yearOf(r.period_month);
    if (y != null)
      years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}
function normalise(basis, fallbackYear) {
  if (!basis)
    return { year: fallbackYear, from_month: 1, to_month: 12 };
  const from = Math.min(12, Math.max(1, Math.round(basis.from_month)));
  const to = Math.min(12, Math.max(1, Math.round(basis.to_month)));
  return {
    year: basis.year,
    from_month: Math.min(from, to),
    to_month: Math.max(from, to)
  };
}
function annualizeCashflow(rows, basis) {
  const b = normalise(basis, (/* @__PURE__ */ new Date()).getFullYear());
  const basisMonths = b.to_month - b.from_month + 1;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let annualItemsIncome = 0;
  let annualItemsExpenses = 0;
  const withData = /* @__PURE__ */ new Set();
  for (const r of rows ?? []) {
    if (isAssetTransfer(r))
      continue;
    if (yearOf(r.period_month) !== b.year)
      continue;
    const amount = amountOf(r);
    const inflow = r.direction === "inflow";
    if (isMonthlyActual(r)) {
      const m = monthOf(r.period_month);
      if (m == null || m < b.from_month || m > b.to_month)
        continue;
      withData.add(m);
      if (inflow)
        monthlyIncome += amount;
      else
        monthlyExpenses += amount;
    } else {
      const occurrences = ANNUAL_OCCURRENCES[r.frequency] ?? 12;
      const annual = amount * occurrences;
      if (inflow)
        annualItemsIncome += annual;
      else
        annualItemsExpenses += annual;
    }
  }
  const divisor = withData.size || 1;
  const avgIncome = monthlyIncome / divisor;
  const avgExpenses = monthlyExpenses / divisor;
  const annualIncome = avgIncome * 12 + annualItemsIncome;
  const annualExpenses = avgExpenses * 12 + annualItemsExpenses;
  return {
    annual_income: annualIncome,
    annual_expenses: annualExpenses,
    monthly_income: annualIncome / 12,
    monthly_expenses: annualExpenses / 12,
    basis_months: basisMonths,
    months_with_data: [...withData].sort((a, b2) => a - b2),
    annual_items_income: annualItemsIncome,
    annual_items_expenses: annualItemsExpenses
  };
}

// supabase/functions/_shared/cashflow/items.ts
function monthStart(d) {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})/.exec(d);
    if (m)
      return `${m[1]}-${m[2]}-01`;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) {
      throw new Error(`monthStart: unusable date "${d}"`);
    }
    return monthStart(parsed);
  }
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${mo}-01`;
}
function monthIndex(month) {
  const y = Number(month.slice(0, 4));
  const mo = Number(month.slice(5, 7));
  return y * 12 + (mo - 1);
}
function monthFromIndex(idx) {
  const y = Math.floor(idx / 12);
  const mo = idx - y * 12 + 1;
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}
function monthBefore(month) {
  return monthFromIndex(monthIndex(month) - 1);
}
function round22(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function isActiveAt(item, asOf) {
  const asOfMonth = monthStart(asOf);
  if (item.effective_from > asOfMonth)
    return false;
  if (item.effective_to != null && item.effective_to < asOfMonth)
    return false;
  return true;
}
function activeItems(items, asOf) {
  return (items ?? []).filter((it) => isActiveAt(it, asOf));
}
function itemMonthlyAmount(item) {
  const occurrences = ANNUAL_OCCURRENCES[item.frequency] ?? 12;
  const amount = Number(item.amount);
  const n = Number.isFinite(amount) ? amount : 0;
  return n * occurrences / 12;
}
function annualizeItems(items, asOf) {
  const asOfMonth = monthStart(asOf);
  const active = activeItems(items ?? [], asOfMonth);
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let annualItemsIncome = 0;
  let annualItemsExpenses = 0;
  for (const item of active) {
    if (item.frequency === "one_off")
      continue;
    if (isTransferCode(item.category))
      continue;
    const inflow = item.direction === "inflow";
    const monthlyAmount = itemMonthlyAmount(item);
    if ((item.frequency ?? "monthly") === "monthly") {
      if (inflow)
        monthlyIncome += monthlyAmount;
      else
        monthlyExpenses += monthlyAmount;
    } else {
      const annual = monthlyAmount * 12;
      if (inflow)
        annualItemsIncome += annual;
      else
        annualItemsExpenses += annual;
    }
  }
  const annualIncome = monthlyIncome * 12 + annualItemsIncome;
  const annualExpenses = monthlyExpenses * 12 + annualItemsExpenses;
  const asOfIdx = monthIndex(asOfMonth);
  const lowIdx = asOfIdx - 11;
  const highIdx = asOfIdx + 12;
  const one_off_items = (items ?? []).filter((it) => {
    if (it.frequency !== "one_off")
      return false;
    const idx = monthIndex(monthStart(it.effective_from));
    return idx >= lowIdx && idx <= highIdx;
  });
  return {
    annual_income: annualIncome,
    annual_expenses: annualExpenses,
    monthly_income: annualIncome / 12,
    monthly_expenses: annualExpenses / 12,
    basis_months: 12,
    months_with_data: [],
    annual_items_income: annualItemsIncome,
    annual_items_expenses: annualItemsExpenses,
    one_off_items
  };
}
function annualizeItemsByCategory(items, asOf, opts = {}) {
  const asOfMonth = monthStart(asOf);
  const active = activeItems(items ?? [], asOfMonth);
  const acc = /* @__PURE__ */ new Map();
  for (const item of active) {
    if (item.frequency === "one_off")
      continue;
    if (!opts.includeTransfers && isTransferCode(item.category))
      continue;
    const key = item.category;
    const a = acc.get(key) ?? { mi: 0, me: 0, ai: 0, ae: 0 };
    const inflow = item.direction === "inflow";
    const monthlyAmount = itemMonthlyAmount(item);
    if ((item.frequency ?? "monthly") === "monthly") {
      if (inflow)
        a.mi += monthlyAmount;
      else
        a.me += monthlyAmount;
    } else {
      const annual = monthlyAmount * 12;
      if (inflow)
        a.ai += annual;
      else
        a.ae += annual;
    }
    acc.set(key, a);
  }
  return [...acc.entries()].map(([category, a]) => {
    const annual_income = a.mi * 12 + a.ai;
    const annual_expenses = a.me * 12 + a.ae;
    return {
      category,
      annual_income,
      annual_expenses,
      monthly_income: annual_income / 12,
      monthly_expenses: annual_expenses / 12
    };
  });
}
function reviseItem(item, changes, fromMonth) {
  const fm = monthStart(fromMonth);
  if (item.frequency === "one_off") {
    const update = { ...changes };
    if (update.effective_from != null) {
      const ef = monthStart(update.effective_from);
      update.effective_from = ef;
      update.effective_to = ef;
    }
    return { mode: "correct", update };
  }
  if (fm <= item.effective_from) {
    return { mode: "correct", update: { ...changes } };
  }
  const { id: _oldId, ...rest } = item;
  const insert = {
    ...rest,
    ...changes,
    effective_from: fm,
    effective_to: item.effective_to ?? null,
    previous_id: item.id
  };
  return {
    mode: "version",
    close: { id: item.id, effective_to: monthBefore(fm) },
    insert
  };
}
function endItem(item, lastMonth) {
  const lm = monthStart(lastMonth);
  const effective_to = lm < item.effective_from ? item.effective_from : lm;
  return { id: item.id, effective_to };
}
function normaliseNote(note) {
  return (note ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
function itemsFromMonthRows(rows, basis) {
  const allRows = rows ?? [];
  const year = recordedYears(allRows)[0];
  if (year == null)
    return [];
  const eligible = allRows.filter((r) => yearOf(r.period_month) === year).slice().sort((x, y) => x.period_month !== y.period_month ? x.period_month < y.period_month ? -1 : 1 : x.id < y.id ? -1 : x.id > y.id ? 1 : 0);
  const groups = /* @__PURE__ */ new Map();
  for (const r of eligible) {
    const freq = r.frequency ?? "monthly";
    const note = normaliseNote(r.source_note);
    const linkedAsset = r.linked_asset_id ?? null;
    const linkedLiability = r.linked_liability_id ?? null;
    const month = monthStart(r.period_month);
    const key = JSON.stringify([r.direction, r.category, freq, note, linkedAsset, linkedLiability]);
    let g = groups.get(key);
    if (!g) {
      g = {
        client_id: r.client_id ?? null,
        direction: r.direction,
        category: r.category,
        frequency: freq,
        note,
        linked_asset_id: linkedAsset,
        linked_liability_id: linkedLiability,
        allIds: [],
        earliestMonth: month,
        latestMonth: month,
        latestMonthAmount: 0,
        latestMonthIds: [],
        latestNote: null,
        needsReview: false,
        reviewReason: null
      };
      groups.set(key, g);
    }
    g.allIds.push(r.id);
    if (month < g.earliestMonth)
      g.earliestMonth = month;
    const amount = Number(r.amount);
    const amt = Number.isFinite(amount) ? amount : 0;
    if (month > g.latestMonth) {
      g.latestMonth = month;
      g.latestMonthAmount = amt;
      g.latestMonthIds = [r.id];
      g.latestNote = r.source_note ?? null;
    } else {
      g.latestMonthAmount += amt;
      g.latestMonthIds.push(r.id);
      g.latestNote = r.source_note ?? g.latestNote;
    }
    if (r.needs_review)
      g.needsReview = true;
    if (!g.reviewReason && r.review_reason)
      g.reviewReason = r.review_reason;
  }
  const items = [];
  for (const g of groups.values()) {
    const isOneOff = g.frequency === "one_off";
    const amount = round22(g.latestMonthAmount);
    const effective_from = g.earliestMonth;
    const effective_to = isOneOff ? effective_from : null;
    items.push({
      client_id: g.client_id ?? void 0,
      direction: g.direction,
      category: g.category,
      name: g.latestNote ?? void 0,
      amount,
      frequency: g.frequency,
      effective_from,
      effective_to,
      linked_asset_id: g.linked_asset_id ?? void 0,
      linked_liability_id: g.linked_liability_id ?? void 0,
      source: "migrated",
      needs_review: g.needsReview,
      review_reason: g.reviewReason ?? void 0,
      source_ids: g.allIds.slice().sort(),
      amount_ids: g.latestMonthIds.slice().sort(),
      divisor: 1
    });
  }
  return items.sort((a, b2) => {
    if (a.direction !== b2.direction)
      return a.direction < b2.direction ? -1 : 1;
    if (a.category !== b2.category)
      return a.category < b2.category ? -1 : 1;
    const an = normaliseNote(a.name);
    const bn = normaliseNote(b2.name);
    if (an !== bn)
      return an < bn ? -1 : 1;
    if (a.frequency !== b2.frequency)
      return a.frequency < b2.frequency ? -1 : 1;
    return 0;
  });
}

// supabase/functions/_shared/finance/statutory.ts
var EPF_EMPLOYEE_RATE = 0.11;
var EPF_EMPLOYEE_RATE_SENIOR = 0;
var EPF_EMPLOYER_RATE_LOW = 0.13;
var EPF_EMPLOYER_RATE_HIGH = 0.12;
var EPF_EMPLOYER_RATE_SENIOR = 0.04;
var EPF_EMPLOYER_WAGE_THRESHOLD = 5e3;
var SOCSO_EMPLOYEE_RATE = 5e-3;
var EIS_EMPLOYEE_RATE = 2e-3;
var SOCSO_EIS_WAGE_CEILING = 6e3;
var STATUTORY_SENIOR_AGE = 60;
var STATUTORY_NOTE = "\u6309\u6CD5\u5B9A\u6BD4\u4F8B\u4F30\u7B97";
var EPF_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "bonus"];
var REGULAR_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission"];
var SOCSO_EIS_WAGE_CATEGORIES = ["salary_basic", "fixed_allowance", "commission", "overtime"];
function round23(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function roundUpToRinggit(n) {
  return Math.ceil(n - 1e-9);
}
function ageAt(dob, asOf) {
  if (!dob)
    return null;
  const d = new Date(dob);
  if (isNaN(d.getTime()))
    return null;
  let age = asOf.getUTCFullYear() - d.getUTCFullYear();
  const beforeBirthdayThisYear = asOf.getUTCMonth() < d.getUTCMonth() || asOf.getUTCMonth() === d.getUTCMonth() && asOf.getUTCDate() < d.getUTCDate();
  if (beforeBirthdayThisYear)
    age -= 1;
  return age;
}
function sumWage(items, asOf, categories) {
  let total = 0;
  for (const item of activeItems(items ?? [], asOf)) {
    if (item.direction !== "inflow")
      continue;
    if (!categories.includes(item.category))
      continue;
    total += itemMonthlyAmount(item);
  }
  return total;
}
function deriveStatutoryItems(items, client, asOf = /* @__PURE__ */ new Date()) {
  const nothing = {
    items: [],
    employee_epf_monthly: 0,
    employer_epf_monthly: 0,
    socso_eis_monthly: 0,
    epf_wage_monthly: 0,
    notes: []
  };
  if (client?.has_epf !== true)
    return nothing;
  const epfWage = sumWage(items, asOf, EPF_WAGE_CATEGORIES);
  if (epfWage <= 0)
    return nothing;
  const regularWage = sumWage(items, asOf, REGULAR_WAGE_CATEGORIES);
  const socsoEisWage = Math.min(sumWage(items, asOf, SOCSO_EIS_WAGE_CATEGORIES), SOCSO_EIS_WAGE_CEILING);
  const age = ageAt(client.date_of_birth, asOf);
  const isSenior = age != null && age >= STATUTORY_SENIOR_AGE;
  const employeeRate = isSenior ? EPF_EMPLOYEE_RATE_SENIOR : EPF_EMPLOYEE_RATE;
  const employerRate = isSenior ? EPF_EMPLOYER_RATE_SENIOR : regularWage <= EPF_EMPLOYER_WAGE_THRESHOLD ? EPF_EMPLOYER_RATE_LOW : EPF_EMPLOYER_RATE_HIGH;
  const employeeEpf = roundUpToRinggit(epfWage * employeeRate);
  const employerEpf = roundUpToRinggit(epfWage * employerRate);
  const socsoRate = isSenior ? 0 : SOCSO_EMPLOYEE_RATE;
  const eisRate = isSenior ? 0 : EIS_EMPLOYEE_RATE;
  const socsoEis = round23(socsoEisWage * (socsoRate + eisRate));
  const resultItems = [];
  if (employeeEpf > 0) {
    resultItems.push({
      key: "statutory:epf_employee",
      source_type: "statutory",
      source_id: null,
      source_name: "EPF\uFF08\u96C7\u5458\uFF09",
      category: "epf_employee",
      direction: "outflow",
      monthly_amount: employeeEpf,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: ["statutory_rate"],
      warnings: [STATUTORY_NOTE]
    });
  }
  if (socsoEis > 0) {
    resultItems.push({
      key: "statutory:socso_eis",
      source_type: "statutory",
      source_id: null,
      source_name: "SOCSO/EIS",
      category: "socso_eis",
      direction: "outflow",
      monthly_amount: socsoEis,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: ["statutory_rate"],
      warnings: [STATUTORY_NOTE]
    });
  }
  return {
    items: resultItems,
    employee_epf_monthly: employeeEpf,
    employer_epf_monthly: employerEpf,
    socso_eis_monthly: socsoEis,
    epf_wage_monthly: round23(epfWage),
    notes: resultItems.length > 0 ? [STATUTORY_NOTE] : []
  };
}

// supabase/functions/_shared/finance/derived.ts
function round24(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
var PREMIUM_OCCURRENCES = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single_premium: 0
};
function premiumCategoryOf(policy_type) {
  switch (policy_type) {
    case "life":
      return "life_takaful";
    case "investment_linked":
      return "savings_plan_premium";
    case "medical":
      return "medical_card";
    case "critical_illness":
      return "critical_illness";
    case "accident":
      return "personal_accident";
    case "property":
      return "home_insurance";
    default:
      return "protection_other";
  }
}
function isExpired(endDate, today) {
  if (!endDate)
    return false;
  const end = new Date(endDate);
  if (isNaN(end.getTime()))
    return false;
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return end.getTime() < cutoff.getTime();
}
function deriveLoanItems(liabilities, today = /* @__PURE__ */ new Date()) {
  const items = [];
  for (const l of liabilities ?? []) {
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null)
      continue;
    const est = estimateLoan(l, today);
    const isCreditCard = l.liability_type === "credit_card";
    const category = isCreditCard ? "finance_charges" : meta.installment_category;
    const interestOnlyAmount = isCreditCard || est.rate_type === "interest_only";
    const amount = interestOnlyAmount ? est.interest_monthly : est.monthly_payment;
    items.push({
      key: `liability:${l.id ?? l.name ?? l.liability_type}`,
      source_type: "liability",
      source_id: l.id ?? null,
      source_name: l.name ?? meta.label_zh,
      category,
      direction: "outflow",
      monthly_amount: round24(amount),
      interest_monthly: est.interest_monthly,
      principal_monthly: est.principal_monthly,
      estimated: est.estimated,
      warnings: est.warnings
    });
  }
  return items;
}
function derivePremiumItems(policies, today = /* @__PURE__ */ new Date()) {
  const items = [];
  for (const p of policies ?? []) {
    if (isExpired(p.end_date, today))
      continue;
    const occurrences = PREMIUM_OCCURRENCES[p.premium_frequency ?? "annual"] ?? 12;
    const monthly = round24((p.premium ?? 0) * occurrences / 12);
    if (monthly === 0)
      continue;
    items.push({
      key: `policy:${p.id ?? p.plan_name ?? p.policy_type}`,
      source_type: "policy",
      source_id: p.id ?? null,
      source_name: p.plan_name ?? p.provider ?? p.policy_type,
      category: premiumCategoryOf(p.policy_type),
      direction: "outflow",
      monthly_amount: monthly,
      interest_monthly: 0,
      principal_monthly: 0,
      estimated: [],
      warnings: []
    });
  }
  return items;
}
function isSuperseded(row, liabilities, policies) {
  const code = row.category;
  if (!code)
    return false;
  const cat = CATEGORY_BY_CODE[code];
  if (!cat)
    return false;
  if (cat.group === "O2" && cat.wealth_effect === "split") {
    const liabilityCategories = new Set(
      (liabilities ?? []).map((l) => liabilityTypeMeta(l.liability_type)?.installment_category).filter((c) => c != null)
    );
    if (liabilityCategories.has(code))
      return true;
    if (code === "debt_other" && liabilityCategories.size > 0)
      return true;
    return false;
  }
  if (cat.group === "O3") {
    const policyCategories = new Set((policies ?? []).map((p) => premiumCategoryOf(p.policy_type)));
    if (policyCategories.has(code))
      return true;
    if (code === "protection_other" && (policies?.length ?? 0) > 0)
      return true;
    return false;
  }
  return false;
}
function planCashflow(input) {
  return input.items && input.items.length > 0 ? planCashflowFromItems(input) : planCashflowFromActuals(input);
}
function planCashflowFromActuals(input) {
  const { rows, liabilities, policies, basis } = input;
  const today = input.today ?? /* @__PURE__ */ new Date();
  const superseded = [];
  const keptRows = [];
  for (const r of rows ?? []) {
    if (isSuperseded(r, liabilities, policies))
      superseded.push(r);
    else
      keptRows.push(r);
  }
  const baseTotals = annualizeCashflow(keptRows, basis);
  const loanItems = deriveLoanItems(liabilities, today);
  const premiumItems = derivePremiumItems(policies, today);
  const derived = [...loanItems, ...premiumItems];
  let derivedMonthlyExpense = 0;
  for (const item of derived) {
    if (isTransferCode(item.category))
      continue;
    derivedMonthlyExpense += item.monthly_amount;
  }
  const monthly_expenses = round24(baseTotals.monthly_expenses + derivedMonthlyExpense);
  const annual_expenses = round24(baseTotals.annual_expenses + derivedMonthlyExpense * 12);
  const totals = {
    ...baseTotals,
    monthly_expenses,
    annual_expenses
  };
  let monthly_debt_service = 0;
  let monthly_principal = 0;
  let monthly_interest = 0;
  for (const l of liabilities ?? []) {
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null)
      continue;
    const est = estimateLoan(l, today);
    monthly_debt_service += est.monthly_payment;
    monthly_principal += est.principal_monthly;
    monthly_interest += est.interest_monthly;
  }
  let monthly_premiums = 0;
  for (const item of premiumItems)
    monthly_premiums += item.monthly_amount;
  return {
    totals,
    derived,
    superseded,
    monthly_debt_service: round24(monthly_debt_service),
    monthly_principal: round24(monthly_principal),
    monthly_interest: round24(monthly_interest),
    monthly_premiums: round24(monthly_premiums),
    source: "actuals",
    monthly_employee_epf: 0,
    monthly_employer_epf: 0,
    monthly_socso_eis: 0,
    one_off_items: []
  };
}
function deriveStatutoryForHousehold(items, clientInfo, clients, today) {
  if (!clients)
    return deriveStatutoryItems(items, clientInfo ?? {}, today);
  const byClient = /* @__PURE__ */ new Map();
  for (const it of items ?? []) {
    const cid = it.client_id ?? "";
    const group = byClient.get(cid);
    if (group)
      group.push(it);
    else
      byClient.set(cid, [it]);
  }
  let employee_epf_monthly = 0;
  let employer_epf_monthly = 0;
  let socso_eis_monthly = 0;
  let epf_wage_monthly = 0;
  const items_out = [];
  const notes = /* @__PURE__ */ new Set();
  for (const [cid, groupItems] of byClient) {
    const result = deriveStatutoryItems(groupItems, clients[cid] ?? {}, today);
    employee_epf_monthly += result.employee_epf_monthly;
    employer_epf_monthly += result.employer_epf_monthly;
    socso_eis_monthly += result.socso_eis_monthly;
    epf_wage_monthly += result.epf_wage_monthly;
    for (const it of result.items) {
      items_out.push({ ...it, key: cid ? `${it.key}:${cid}` : it.key });
    }
    for (const n of result.notes)
      notes.add(n);
  }
  return {
    items: items_out,
    employee_epf_monthly: round24(employee_epf_monthly),
    employer_epf_monthly: round24(employer_epf_monthly),
    socso_eis_monthly: round24(socso_eis_monthly),
    epf_wage_monthly: round24(epf_wage_monthly),
    notes: [...notes]
  };
}
function planCashflowFromItems(input) {
  const { liabilities, policies, client, clients } = input;
  const items = input.items ?? [];
  const today = input.today ?? /* @__PURE__ */ new Date();
  const active = activeItems(items, today);
  const superseded = [];
  const kept = [];
  for (const it of active) {
    if (isSuperseded(it, liabilities, policies))
      superseded.push(it);
    else
      kept.push(it);
  }
  const itemTotals = annualizeItems(kept, today);
  const nonSupersededAll = items.filter((it) => !isSuperseded(it, liabilities, policies));
  const one_off_items = annualizeItems(nonSupersededAll, today).one_off_items;
  const loanItems = deriveLoanItems(liabilities, today);
  const premiumItems = derivePremiumItems(policies, today);
  const statutory = deriveStatutoryForHousehold(items, client, clients, today);
  const derived = [...loanItems, ...premiumItems, ...statutory.items];
  let derivedMonthlyExpense = 0;
  for (const item of derived) {
    if (isTransferCode(item.category))
      continue;
    derivedMonthlyExpense += item.monthly_amount;
  }
  const monthly_expenses = round24(itemTotals.monthly_expenses + derivedMonthlyExpense);
  const annual_expenses = round24(itemTotals.annual_expenses + derivedMonthlyExpense * 12);
  const { one_off_items: _itemTotalsOneOff, ...itemTotalsRest } = itemTotals;
  const totals = {
    ...itemTotalsRest,
    monthly_expenses,
    annual_expenses
  };
  let monthly_debt_service = 0;
  let monthly_principal = 0;
  let monthly_interest = 0;
  for (const l of liabilities ?? []) {
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null)
      continue;
    const est = estimateLoan(l, today);
    monthly_debt_service += est.monthly_payment;
    monthly_principal += est.principal_monthly;
    monthly_interest += est.interest_monthly;
  }
  let monthly_premiums = 0;
  for (const item of premiumItems)
    monthly_premiums += item.monthly_amount;
  return {
    totals,
    derived,
    superseded,
    monthly_debt_service: round24(monthly_debt_service),
    monthly_principal: round24(monthly_principal),
    monthly_interest: round24(monthly_interest),
    monthly_premiums: round24(monthly_premiums),
    source: "items",
    monthly_employee_epf: statutory.employee_epf_monthly,
    monthly_employer_epf: statutory.employer_epf_monthly,
    monthly_socso_eis: statutory.socso_eis_monthly,
    one_off_items
  };
}

// supabase/functions/_shared/taxonomy/index.ts
function isTransferCategory(code, direction = "outflow") {
  return wealthEffectOf(code, direction) === "transfer";
}
export {
  ASSET_CLASSES,
  ASSET_TYPES,
  CASHFLOW_CATEGORIES,
  CASHFLOW_GROUPS,
  CATEGORY_BY_CODE,
  EIS_EMPLOYEE_RATE,
  EPF_ASSET_TYPES,
  EPF_EMPLOYEE_RATE,
  EPF_EMPLOYEE_RATE_SENIOR,
  EPF_EMPLOYER_RATE_HIGH,
  EPF_EMPLOYER_RATE_LOW,
  EPF_EMPLOYER_RATE_SENIOR,
  EPF_EMPLOYER_WAGE_THRESHOLD,
  LEGACY_CATEGORY_MAP,
  LIABILITY_TYPES,
  LIQUID_ASSET_TYPES,
  LOAN_DEFAULTS,
  SOCSO_EIS_WAGE_CEILING,
  SOCSO_EMPLOYEE_RATE,
  STATUTORY_NOTE,
  STATUTORY_SENIOR_AGE,
  TRANSFER_CATEGORY_CODES,
  activeItems,
  allocationBucketOf,
  annualizeItems,
  annualizeItemsByCategory,
  assetClassOf,
  assetTypeLabel,
  assetTypeMeta,
  categoriesOf,
  categoryLabel,
  classifyAsset,
  classifyCashflowRow,
  deriveLoanItems,
  derivePremiumItems,
  deriveStatutoryItems,
  endItem,
  estimateLoan,
  groupOf,
  isActiveAt,
  isLiquid,
  isRetirementCapital,
  isSuperseded,
  isTransferCategory,
  itemMonthlyAmount,
  itemsFromMonthRows,
  levelUpAsset,
  levelUpLiabilityType,
  liabilityTypeLabel,
  liabilityTypeMeta,
  liquidityLevel,
  monthStart,
  planCashflow,
  premiumCategoryOf,
  resolveCategory,
  reviseItem,
  wealthEffectOf
};
