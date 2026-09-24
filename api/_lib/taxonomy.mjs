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
function monthlyBreakdown(rows, year) {
  const byMonth = /* @__PURE__ */ new Map();
  for (const r of rows ?? []) {
    if (yearOf(r.period_month) !== year)
      continue;
    const m = monthOf(r.period_month);
    if (m == null)
      continue;
    if (isAssetTransfer(r))
      continue;
    const slot = byMonth.get(m) ?? { month: m, income: 0, expenses: 0, entries: 0 };
    const amount = amountOf(r);
    if (r.direction === "inflow")
      slot.income += amount;
    else
      slot.expenses += amount;
    slot.entries += 1;
    byMonth.set(m, slot);
  }
  return [...byMonth.values()].sort((a, b) => a.month - b.month);
}
function defaultBasis(rows) {
  const year = recordedYears(rows)[0];
  if (year == null)
    return null;
  const months = monthlyBreakdown(rows, year).map((m) => m.month);
  if (months.length === 0)
    return null;
  return { year, from_month: months[0], to_month: months[months.length - 1] };
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
  if (item.frequency === "one_off" || fm <= item.effective_from) {
    const update = { ...changes };
    const resultingFrequency = changes.frequency ?? item.frequency;
    if (resultingFrequency === "one_off") {
      const resultingEffectiveFrom = update.effective_from != null ? monthStart(update.effective_from) : item.effective_from;
      update.effective_from = resultingEffectiveFrom;
      update.effective_to = resultingEffectiveFrom;
    } else if (item.frequency === "one_off") {
      update.effective_to = null;
    }
    return { mode: "correct", update };
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
function isPremiumActive(status) {
  return status == null || status === "in_force";
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
    if (!isPremiumActive(p.status))
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
    const activePolicies = (policies ?? []).filter((p) => isPremiumActive(p.status));
    const policyCategories = new Set(activePolicies.map((p) => premiumCategoryOf(p.policy_type)));
    if (policyCategories.has(code))
      return true;
    if (code === "protection_other" && activePolicies.length > 0)
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

// supabase/functions/_shared/finance/valuation.ts
var MS_PER_DAY = 24 * 60 * 60 * 1e3;
var MIN_SPAN_DAYS = 60;
var TARGET_SPAN_DAYS = 365;
var VEHICLE_DEFAULT_DEPRECIATION_PCT = -0.1;
var VEHICLE_ASSET_TYPE = "vehicle";
function round25(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round5(n) {
  return Math.round((n + Number.EPSILON) * 1e5) / 1e5;
}
function toUtcMs(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? "");
  if (!m) {
    const d = new Date(dateStr);
    return d.getTime();
  }
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function asOfMs(asOf) {
  if (typeof asOf === "string")
    return toUtcMs(asOf);
  return Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
}
function sortedDated(valuations) {
  return (valuations ?? []).filter((v) => !!v && !!v.valuation_date && Number.isFinite(v.value)).map((v) => ({ ...v, _ts: toUtcMs(v.valuation_date) })).sort((a, b) => a._ts - b._ts);
}
function valueChangeAnnual(valuations, asOf, opts) {
  const currentValue = Number(opts.currentValue) || 0;
  const none = () => {
    if (opts.assetType === VEHICLE_ASSET_TYPE) {
      return {
        annual_change: round25(VEHICLE_DEFAULT_DEPRECIATION_PCT * currentValue),
        source: "default_depreciation"
      };
    }
    return { annual_change: null, source: "none" };
  };
  const asOfTs = asOfMs(asOf);
  const list = sortedDated(valuations).filter((v) => v._ts <= asOfTs);
  if (list.length === 0)
    return none();
  const latest = list[list.length - 1];
  const earlierCandidates = list.filter((v) => v._ts < latest._ts);
  if (earlierCandidates.length === 0)
    return none();
  const targetTs = latest._ts - TARGET_SPAN_DAYS * MS_PER_DAY;
  let earlier = earlierCandidates[0];
  let bestDiff = Math.abs(earlier._ts - targetTs);
  for (const c of earlierCandidates.slice(1)) {
    const diff = Math.abs(c._ts - targetTs);
    if (diff < bestDiff || diff === bestDiff && c._ts > earlier._ts) {
      earlier = c;
      bestDiff = diff;
    }
  }
  const days = Math.round((latest._ts - earlier._ts) / MS_PER_DAY);
  if (days < MIN_SPAN_DAYS)
    return none();
  const contributions = list.filter((v) => v._ts > earlier._ts && v._ts <= latest._ts).reduce((s, v) => s + (Number(v.net_contribution) || 0), 0);
  const rawChange = latest.value - earlier.value - contributions;
  const annual_change = round25(rawChange * (TARGET_SPAN_DAYS / days));
  return {
    annual_change,
    source: "history",
    from_date: earlier.valuation_date,
    to_date: latest.valuation_date,
    days
  };
}
function twr(valuations) {
  const list = sortedDated(valuations);
  if (list.length < 2)
    return null;
  let chain = 1;
  let any = false;
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const cur = list[i];
    if (prev.value === 0)
      continue;
    const c = Number(cur.net_contribution) || 0;
    const r = (cur.value - c) / prev.value - 1;
    chain *= 1 + r;
    any = true;
  }
  if (!any)
    return null;
  const from = list[0].valuation_date;
  const to = list[list.length - 1].valuation_date;
  const totalDays = (list[list.length - 1]._ts - list[0]._ts) / MS_PER_DAY;
  const twrValue = chain - 1;
  const annualised = totalDays > 0 ? Math.pow(chain, TARGET_SPAN_DAYS / totalDays) - 1 : null;
  return {
    twr: round5(twrValue),
    annualised: annualised != null ? round5(annualised) : null,
    from,
    to
  };
}

// supabase/functions/_shared/finance/assetQuality.ts
var QUADRANTS = [
  { id: "productive", label_zh: "\u751F\u8D22\u8D44\u4EA7", label_en: "Productive" },
  { id: "yielding_depreciating", label_zh: "\u6536\u76CA\u4F46\u8D2C\u503C", label_en: "Yielding but depreciating" },
  { id: "appreciating_cash_consuming", label_zh: "\u589E\u503C\u4F46\u5403\u73B0\u91D1", label_en: "Appreciating but cash-consuming" },
  { id: "consuming", label_zh: "\u6D88\u8017\u578B\u8D44\u4EA7", label_en: "Consuming" }
];
var NOTE_MISSING_VALUATION_HISTORY = "\u7F3A\u5C11\u4F30\u503C\u5386\u53F2";
var NOTE_UNLINKED_PERSONAL_USE = "\u81EA\u7528\u8D44\u4EA7\u901A\u5E38\u6709\u6301\u6709\u6210\u672C\uFF08\u8D37\u6B3E\u3001\u4FDD\u9669\u3001\u4FDD\u517B\u3001\u7A0E\u8D39\uFF09\uFF0C\u8BF7\u5148\u5173\u8054\u76F8\u5173\u8D37\u6B3E\u6216\u6536\u652F";
var NOTE_UNLINKED_INVESTMENT = "\u672A\u5173\u8054\u4EFB\u4F55\u6536\u652F";
function round26(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round4(n) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}
function quadrantFor(netCashFlowMonthly, valueChangeEffective) {
  const cashOk = netCashFlowMonthly >= 0;
  const valueOk = valueChangeEffective >= 0;
  if (cashOk && valueOk)
    return "productive";
  if (cashOk && !valueOk)
    return "yielding_depreciating";
  if (!cashOk && valueOk)
    return "appreciating_cash_consuming";
  return "consuming";
}
function assessAsset(asset, ctx, asOf) {
  const asset_class = assetClassOf(asset.asset_type);
  const currentValue = Number(asset.current_value) || 0;
  const asOfDate = typeof asOf === "string" ? new Date(asOf) : asOf;
  const linkedItems = activeItems(ctx.items ?? [], asOf).filter(
    (it) => it.linked_asset_id != null && it.linked_asset_id === asset.id
  );
  let itemsMonthly = 0;
  const linked_items = linkedItems.map((it) => {
    const monthly = round26(itemMonthlyAmount(it));
    itemsMonthly += it.direction === "inflow" ? monthly : -monthly;
    return { id: it.id, category: it.category, direction: it.direction, monthly_amount: monthly };
  });
  const linkedLiabilities = (ctx.liabilities ?? []).filter(
    (l) => l.linked_asset_id != null && l.linked_asset_id === asset.id
  );
  let liabilitiesMonthly = 0;
  const linked_liabilities = linkedLiabilities.map((l) => {
    const est = estimateLoan(l, asOfDate);
    liabilitiesMonthly += est.monthly_payment;
    return { id: l.id ?? null, liability_type: l.liability_type, monthly_payment: est.monthly_payment };
  });
  const net_cash_flow_monthly = round26(itemsMonthly - liabilitiesMonthly);
  const ownValuations = (ctx.valuations ?? []).filter(
    (v) => v.asset_id == null || v.asset_id === asset.id
  );
  const vc = valueChangeAnnual(ownValuations, asOf, { assetType: asset.asset_type, currentValue });
  const notes = [];
  let effectiveValueChange;
  if (vc.annual_change == null) {
    effectiveValueChange = 0;
    if (vc.source === "none")
      notes.push(NOTE_MISSING_VALUATION_HISTORY);
  } else {
    effectiveValueChange = vc.annual_change;
  }
  const labeled = asset_class === "C" || asset_class === "D";
  const hasLinks = linked_items.length > 0 || linked_liabilities.length > 0;
  const unlinked = labeled && !hasLinks;
  let quadrant = labeled ? quadrantFor(net_cash_flow_monthly, effectiveValueChange) : null;
  if (unlinked) {
    if (asset_class === "D") {
      quadrant = null;
      notes.push(NOTE_UNLINKED_PERSONAL_USE);
    } else {
      notes.push(NOTE_UNLINKED_INVESTMENT);
    }
  }
  const total_return_annual = round26(net_cash_flow_monthly * 12 + effectiveValueChange);
  const return_pct = currentValue > 0 ? round4(total_return_annual / currentValue) : null;
  return {
    asset_id: asset.id,
    asset_class,
    quadrant,
    unlinked,
    net_cash_flow_monthly,
    linked_items,
    linked_liabilities,
    value_change_annual: vc.annual_change,
    value_change_source: vc.source,
    total_return_annual,
    return_pct,
    notes
  };
}
function assessAssets(assets, ctx, asOf) {
  const list = assets ?? [];
  const results = list.map((a) => assessAsset(a, ctx, asOf));
  const by_quadrant = {
    productive: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    yielding_depreciating: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    appreciating_cash_consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    consuming: { count: 0, value: 0, net_cash_flow_monthly: 0 },
    unlinked: { count: 0, value: 0 }
  };
  for (let i = 0; i < list.length; i++) {
    const r = results[i];
    if (r.unlinked && r.asset_class === "D") {
      by_quadrant.unlinked.count += 1;
      by_quadrant.unlinked.value = round26(by_quadrant.unlinked.value + (Number(list[i].current_value) || 0));
      continue;
    }
    if (r.quadrant == null)
      continue;
    const bucket = by_quadrant[r.quadrant];
    bucket.count += 1;
    bucket.value = round26(bucket.value + (Number(list[i].current_value) || 0));
    bucket.net_cash_flow_monthly = round26(bucket.net_cash_flow_monthly + r.net_cash_flow_monthly);
  }
  return { assets: results, by_quadrant };
}

// supabase/functions/_shared/finance/snapshot.ts
function round0(n) {
  return Math.round(n);
}
function round42(n) {
  return Number(n.toFixed(4));
}
function ownedValue(a) {
  const value = Number(a.current_value) || 0;
  const pct = a.ownership_pct == null ? 100 : Number(a.ownership_pct);
  const pctSafe = Number.isFinite(pct) ? pct : 100;
  return value * (pctSafe / 100);
}
function passiveIncomeMonthly(items, rows, basis, asOf) {
  if (items.length > 0) {
    let total = 0;
    for (const it of activeItems(items, asOf)) {
      if (it.direction !== "inflow")
        continue;
      if (groupOf(it.category)?.id !== "I2")
        continue;
      total += itemMonthlyAmount(it);
    }
    return total;
  }
  const passive = (rows ?? []).filter(
    (r) => r.direction === "inflow" && groupOf(r.category ?? null)?.id === "I2"
  );
  return annualizeCashflow(passive, basis).monthly_income;
}
function computeSnapshot(input) {
  const asOfDate = typeof input.asOf === "string" ? new Date(input.asOf) : input.asOf;
  const asOfStr = typeof input.asOf === "string" ? input.asOf.slice(0, 10) : asOfDate.toISOString().slice(0, 10);
  const assets = input.assets ?? [];
  const liabilities = input.liabilities ?? [];
  const policies = input.policies ?? [];
  const items = input.items ?? [];
  const rows = input.rows ?? [];
  let totalAssets = 0;
  let liquidTotal = 0;
  let investTotal = 0;
  let epfTotal = 0;
  for (const a of assets) {
    const v = ownedValue(a);
    totalAssets += v;
    if (isLiquid(a.asset_type))
      liquidTotal += v;
    if (assetClassOf(a.asset_type) === "C")
      investTotal += v;
    if (EPF_ASSET_TYPES.includes(a.asset_type))
      epfTotal += v;
  }
  const totalLiabilities = liabilities.reduce((s, l) => s + (Number(l.outstanding_balance) || 0), 0);
  const netWorth = totalAssets - totalLiabilities;
  const basis = items.length > 0 ? null : defaultBasis(rows);
  const plan = planCashflow({
    rows,
    liabilities,
    policies,
    basis,
    today: asOfDate,
    items,
    client: input.client
  });
  const monthlyIncome = plan.totals.monthly_income;
  const monthlyExpenses = plan.totals.monthly_expenses;
  const monthlySurplus = monthlyIncome - monthlyExpenses;
  const monthlyDebtService = plan.monthly_debt_service;
  let mortgageMonthly = 0;
  for (const l of liabilities) {
    if (l.liability_type !== "mortgage")
      continue;
    const meta = liabilityTypeMeta(l.liability_type);
    if (!meta || meta.installment_category == null)
      continue;
    mortgageMonthly += estimateLoan(l, asOfDate).monthly_payment;
  }
  const nonMortgageDebtService = monthlyDebtService - mortgageMonthly;
  let activeLifeSumAssured = 0;
  for (const p of policies) {
    const active = !p.end_date || p.end_date >= asOfStr;
    if (!active)
      continue;
    const kind = String(p.policy_type || "").toLowerCase();
    if (kind !== "life" && kind !== "investment_linked")
      continue;
    activeLifeSumAssured += Number(p.sum_assured) || 0;
  }
  const annualIncome = monthlyIncome * 12;
  const passiveMonthly = passiveIncomeMonthly(items, rows, basis, asOfDate);
  const emergencyFundMonths = monthlyExpenses > 0 ? round42(liquidTotal / monthlyExpenses) : null;
  const notes = [];
  if (monthlyIncome <= 0)
    notes.push("\u672A\u5F55\u5F97\u7ECF\u5E38\u6027\u6536\u5165\uFF0C\u6536\u5165\u76F8\u5173\u6BD4\u7387\u4E0D\u5177\u53C2\u8003\u610F\u4E49");
  if (netWorth <= 0)
    notes.push("\u51C0\u8D44\u4EA7\u4E3A\u96F6\u6216\u8D1F\u6570\uFF0C\u4EE5\u51C0\u8D44\u4EA7\u4E3A\u5206\u6BCD\u7684\u6BD4\u7387\u8BB0\u4E3A null");
  return {
    net_worth: round0(netWorth),
    total_assets: round0(totalAssets),
    total_liabilities: round0(totalLiabilities),
    basic_liquidity_ratio: emergencyFundMonths,
    liquid_asset_to_net_worth: netWorth > 0 ? round42(liquidTotal / netWorth) : null,
    solvency_ratio: totalAssets > 0 ? round42(netWorth / totalAssets) : null,
    debt_service_ratio: monthlyIncome > 0 ? round42(monthlyDebtService / monthlyIncome) : null,
    non_mortgage_dsr: monthlyIncome > 0 ? round42(nonMortgageDebtService / monthlyIncome) : null,
    savings_ratio: monthlyIncome > 0 ? round42(monthlySurplus / monthlyIncome) : null,
    life_insurance_coverage: annualIncome > 0 ? round42(activeLifeSumAssured / annualIncome) : null,
    invest_assets_to_net_worth: netWorth > 0 ? round42(investTotal / netWorth) : null,
    passive_income_coverage: monthlyExpenses > 0 ? round42(passiveMonthly / monthlyExpenses) : null,
    raw_metrics: {
      liquid_assets_total: round0(liquidTotal),
      invest_assets_total: round0(investTotal),
      epf_assets_total: round0(epfTotal),
      monthly_debt_service: round0(monthlyDebtService),
      monthly_mortgage_service: round0(mortgageMonthly),
      monthly_non_mortgage_service: round0(nonMortgageDebtService),
      monthly_employee_epf: round0(plan.monthly_employee_epf),
      monthly_socso_eis: round0(plan.monthly_socso_eis),
      active_life_sum_assured: round0(activeLifeSumAssured),
      passive_income_monthly: round0(passiveMonthly),
      annual_income: round0(annualIncome),
      plan_source: plan.source,
      cashflow_basis: basis,
      as_of: asOfStr,
      notes
    },
    emergency_fund_months: emergencyFundMonths,
    monthly_income: round0(monthlyIncome),
    monthly_expenses: round0(monthlyExpenses),
    monthly_surplus: round0(monthlySurplus),
    monthly_principal: round0(plan.monthly_principal),
    monthly_employer_epf: round0(plan.monthly_employer_epf)
  };
}

// supabase/functions/_shared/finance/reconcile.ts
function round27(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function toUtcMs2(d) {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m)
      return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(d).getTime();
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function valueAt(valuations, asOfMs2) {
  const usable = (valuations ?? []).filter((v) => v && v.valuation_date && Number.isFinite(v.value)).map((v) => ({ ...v, _ts: toUtcMs2(v.valuation_date) })).filter((v) => v._ts <= asOfMs2).sort((a, b) => a._ts - b._ts);
  if (usable.length === 0)
    return null;
  return usable[usable.length - 1].value;
}
function linkedContributionMonthly(items, assetId, asOf, isTransfer) {
  let total = 0;
  for (const it of activeItems(items, asOf)) {
    if (it.linked_asset_id !== assetId)
      continue;
    if (!isTransfer(it.category))
      continue;
    total += Math.abs(itemMonthlyAmount(it));
  }
  return total;
}
var TRANSFER_CATEGORIES = /* @__PURE__ */ new Set([
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
]);
var isTransferCategory = (code) => code != null && TRANSFER_CATEGORIES.has(code);
var NOTE_UNLINKED_TRANSFERS = "\u672A\u5173\u8054\u7684\u5B9A\u671F\u6295\u5165\u4F1A\u8BA9\u5BF9\u8D26\u5931\u771F";
function reconcile(input) {
  const { prev, curr, months, plan, assets, valuationsByAsset, items = [] } = input;
  const deltaNetWorth = round27(curr.net_worth - prev.net_worth);
  const savings = round27(months * plan.monthly_surplus);
  const principal = round27(months * plan.monthly_principal);
  const employerEpf = round27(months * plan.monthly_employer_epf);
  const employeeEpf = plan.monthly_employee_epf ?? 0;
  const prevMs = toUtcMs2(prev.asOf);
  const currMs = toUtcMs2(curr.asOf);
  const notes = [];
  const market_by_asset = [];
  const epfAssets = assets.filter((a) => EPF_ASSET_TYPES.includes(a.asset_type));
  const otherAssets = assets.filter(
    (a) => !isLiquid(a.asset_type) && !EPF_ASSET_TYPES.includes(a.asset_type)
  );
  if (epfAssets.length > 0) {
    let rawChange = 0;
    let anyHistory = false;
    for (const a of epfAssets) {
      const before = valueAt(valuationsByAsset[a.id], prevMs);
      const after = valueAt(valuationsByAsset[a.id], currMs);
      if (before != null && after != null) {
        rawChange += after - before;
        anyHistory = true;
      }
    }
    const contribution = round27(months * (employeeEpf + plan.monthly_employer_epf));
    if (!anyHistory) {
      notes.push(`EPF \u8D26\u6237\u7F3A\u5C11\u4F30\u503C\u8BB0\u5F55\uFF0C\u5E02\u573A\u53D8\u52A8\u8BB0\u4E3A 0\uFF08\u5408\u8BA1 ${epfAssets.length} \u4E2A\u8D26\u6237\uFF09`);
      market_by_asset.push({
        asset_id: "epf_combined",
        asset_type: "epf",
        value_change: 0,
        contribution_adjustment: contribution,
        market_change: round27(0 - contribution),
        source: "none",
        note: "\u7F3A\u5C11\u4F30\u503C\u8BB0\u5F55"
      });
    } else {
      const marketChange = round27(rawChange - contribution);
      market_by_asset.push({
        asset_id: "epf_combined",
        asset_type: "epf",
        value_change: round27(rawChange),
        contribution_adjustment: contribution,
        market_change: marketChange,
        source: "epf_combined"
      });
    }
  }
  for (const a of otherAssets) {
    const before = valueAt(valuationsByAsset[a.id], prevMs);
    const after = valueAt(valuationsByAsset[a.id], currMs);
    const contribution = round27(months * linkedContributionMonthly(items, a.id, curr.asOf, isTransferCategory));
    if (before == null || after == null) {
      notes.push(`\u8D44\u4EA7\u300C${a.id}\u300D\u7F3A\u5C11\u4F30\u503C\u8BB0\u5F55\uFF0C\u5E02\u573A\u53D8\u52A8\u8BB0\u4E3A 0`);
      market_by_asset.push({
        asset_id: a.id,
        asset_type: a.asset_type,
        value_change: 0,
        contribution_adjustment: contribution,
        market_change: round27(0 - contribution),
        source: "none",
        note: "\u7F3A\u5C11\u4F30\u503C\u8BB0\u5F55"
      });
      continue;
    }
    const valueChange = round27(after - before);
    market_by_asset.push({
      asset_id: a.id,
      asset_type: a.asset_type,
      value_change: valueChange,
      contribution_adjustment: contribution,
      market_change: round27(valueChange - contribution),
      source: "history"
    });
  }
  const hasUnlinkedTransfer = activeItems(items, curr.asOf).some(
    (it) => isTransferCategory(it.category) && it.linked_asset_id == null
  );
  if (hasUnlinkedTransfer)
    notes.push(NOTE_UNLINKED_TRANSFERS);
  const marketChangeTotal = round27(market_by_asset.reduce((s, m) => s + m.market_change, 0));
  const explainedTotal = round27(savings + principal + employerEpf + marketChangeTotal);
  const unexplainedGap = round27(deltaNetWorth - explainedTotal);
  return {
    delta_net_worth: deltaNetWorth,
    explained: {
      savings,
      principal,
      employer_epf: employerEpf,
      market_change: marketChangeTotal
    },
    market_by_asset,
    unexplained_gap: unexplainedGap,
    notes
  };
}

// supabase/functions/_shared/finance/alerts.ts
var MS_PER_DAY2 = 24 * 60 * 60 * 1e3;
var EMERGENCY_FUND_MONTHS_MIN = 3;
var UNEXPLAINED_GAP_FLOOR = 5e3;
var UNEXPLAINED_GAP_PCT_OF_NW = 0.05;
var DSR_RISE_THRESHOLD = 0.05;
var DSR_HIGH_THRESHOLD = 0.6;
var QUARTERLY_DUE_DAYS = 92;
var QUARTERLY_OVERDUE_DAYS = 120;
var ANNUAL_DUE_DAYS = 365;
var SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
function toUtcMs3(d) {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m)
      return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(d).getTime();
  }
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function daysBetween(from, to) {
  return Math.floor((toUtcMs3(to) - toUtcMs3(from)) / MS_PER_DAY2);
}
function sortedByDate(snapshots) {
  return [...snapshots].sort(
    (a, b) => a.snapshot_date < b.snapshot_date ? -1 : a.snapshot_date > b.snapshot_date ? 1 : 0
  );
}
function lastApproved(reviews, kind) {
  const approved = reviews.filter((r) => r.kind === kind && r.status === "approved");
  if (approved.length === 0)
    return null;
  return approved.reduce((latest, r) => r.period_end > latest.period_end ? r : latest);
}
function computeAlerts(input) {
  const { client_id, latestSnapshot, reviews, asOf } = input;
  const liabilities = input.liabilities ?? [];
  const alerts = [];
  const push = (code, severity, message_zh, message_en) => alerts.push({ code, severity, message_zh, message_en, client_id });
  const gap = latestSnapshot.unexplained_gap;
  const netWorth = latestSnapshot.net_worth ?? 0;
  if (gap != null) {
    const threshold = Math.max(UNEXPLAINED_GAP_FLOOR, UNEXPLAINED_GAP_PCT_OF_NW * Math.abs(netWorth));
    if (Math.abs(gap) > threshold) {
      push(
        "unexplained_gap",
        "medium",
        `\u51C0\u8D44\u4EA7\u6709 RM ${Math.abs(gap).toLocaleString("en-MY", { maximumFractionDigits: 0 })} \u672A\u80FD\u89E3\u91CA\uFF0C\u8BF7\u68C0\u67E5\u672C\u671F\u8D44\u4EA7/\u8D1F\u503A\u8BB0\u5F55`,
        `RM ${Math.abs(gap).toLocaleString("en-MY", { maximumFractionDigits: 0 })} of net worth change is unexplained \u2014 review this period's asset/liability entries`
      );
    }
  }
  const months = latestSnapshot.basic_liquidity_ratio;
  if (months != null && months < EMERGENCY_FUND_MONTHS_MIN) {
    push(
      "emergency_fund_low",
      "high",
      `\u7D27\u6025\u9884\u5907\u91D1\u4EC5 ${months.toFixed(1)} \u4E2A\u6708\uFF0C\u4F4E\u4E8E 3 \u4E2A\u6708\u7684\u6700\u4F4E\u6807\u51C6`,
      `Emergency fund covers only ${months.toFixed(1)} months, below the 3-month minimum`
    );
  }
  const history = sortedByDate(input.snapshots);
  const prevSnapshot = history.length > 0 ? history[history.length - 1] : null;
  const currDsr = latestSnapshot.debt_service_ratio;
  const prevDsr = prevSnapshot?.debt_service_ratio;
  if (currDsr != null && prevDsr != null) {
    const risePp = Math.round((currDsr - prevDsr) * 1e4) / 1e4;
    if (risePp >= DSR_RISE_THRESHOLD) {
      push(
        "dsr_rising",
        "medium",
        `\u8D1F\u503A\u507F\u8FD8\u6BD4\u7387\u8F83\u4E0A\u6B21\u5FEB\u7167\u4E0A\u5347 ${(risePp * 100).toFixed(1)} \u4E2A\u767E\u5206\u70B9`,
        `Debt service ratio rose ${(risePp * 100).toFixed(1)} percentage points since the last snapshot`
      );
    }
  }
  if (currDsr != null && currDsr > DSR_HIGH_THRESHOLD) {
    push(
      "dsr_high",
      "high",
      `\u8D1F\u503A\u507F\u8FD8\u6BD4\u7387\u8FBE ${(currDsr * 100).toFixed(1)}%\uFF0C\u8D85\u8FC7 60%`,
      `Debt service ratio is ${(currDsr * 100).toFixed(1)}%, above 60%`
    );
  }
  const lastQuarterly = lastApproved(reviews, "quarterly");
  if (lastQuarterly) {
    const since = daysBetween(lastQuarterly.approved_at ?? lastQuarterly.period_end, asOf);
    if (since > QUARTERLY_OVERDUE_DAYS) {
      push(
        "quarterly_review_overdue",
        "high",
        `\u5B63\u5EA6\u590D\u68C0\u5DF2\u903E\u671F ${since} \u5929\uFF08\u4E0A\u6B21\u6279\u51C6\uFF1A${lastQuarterly.period_end}\uFF09`,
        `Quarterly review is ${since} days overdue (last approved: ${lastQuarterly.period_end})`
      );
    } else if (since > QUARTERLY_DUE_DAYS) {
      push(
        "quarterly_review_due",
        "medium",
        `\u5B63\u5EA6\u590D\u68C0\u5DF2\u5230\u671F ${since} \u5929\uFF08\u4E0A\u6B21\u6279\u51C6\uFF1A${lastQuarterly.period_end}\uFF09`,
        `Quarterly review is due, ${since} days since last approved (${lastQuarterly.period_end})`
      );
    }
  }
  const lastAnnual = lastApproved(reviews, "annual");
  if (lastAnnual) {
    const since = daysBetween(lastAnnual.approved_at ?? lastAnnual.period_end, asOf);
    if (since > ANNUAL_DUE_DAYS) {
      push(
        "annual_review_due",
        "medium",
        `\u5E74\u5EA6\u5168\u9762\u590D\u68C0\u5DF2\u5230\u671F ${since} \u5929\uFF08\u4E0A\u6B21\u6279\u51C6\uFF1A${lastAnnual.period_end}\uFF09`,
        `Annual full review is due, ${since} days since last approved (${lastAnnual.period_end})`
      );
    }
  }
  if (liabilities.length > 0) {
    const asOfDate = typeof asOf === "string" ? new Date(asOf) : asOf;
    const estimatedNames = [];
    liabilities.forEach((l, i) => {
      const est = input.loanEstimates?.[i] ?? estimateLoan(l, asOfDate);
      if (est.estimated.includes("interest_rate"))
        estimatedNames.push(l.name ?? l.liability_type);
    });
    if (estimatedNames.length > 0) {
      push(
        "estimated_rate",
        "low",
        `${estimatedNames.length} \u9879\u8D1F\u503A\u7684\u5229\u7387\u4E3A\u4F30\u7B97\u503C\uFF08${estimatedNames.join("\u3001")}\uFF09\uFF0C\u590D\u68C0\u65F6\u8BF7\u66F4\u65B0\u5229\u7387`,
        `${estimatedNames.length} liabilit${estimatedNames.length === 1 ? "y has" : "ies have"} an estimated interest rate (${estimatedNames.join(", ")}) \u2014 update it at the next review`
      );
    }
  }
  const policies = input.policies ?? [];
  const missingPremiumCount = policies.filter((p) => {
    const inForce = p.status == null || p.status === "in_force";
    if (!inForce)
      return false;
    if (p.premium_frequency === "single_premium")
      return false;
    return p.premium == null || p.premium === 0;
  }).length;
  if (missingPremiumCount > 0) {
    push(
      "policy_missing_premium",
      "medium",
      `${missingPremiumCount} \u4EFD\u751F\u6548\u4FDD\u5355\u672A\u8BB0\u5F55\u4FDD\u8D39\uFF0C\u73B0\u91D1\u6D41\u53EF\u80FD\u5C11\u7B97`,
      `${missingPremiumCount} in-force polic${missingPremiumCount === 1 ? "y" : "ies"} ${missingPremiumCount === 1 ? "has" : "have"} no premium recorded \u2014 cash flow may be understated`
    );
  }
  for (const r of reviews) {
    if (r.status !== "submitted")
      continue;
    push(
      "review_pending",
      "low",
      `\u6709\u4E00\u4EFD${r.kind === "quarterly" ? "\u5B63\u5EA6" : "\u5E74\u5EA6"}\u590D\u68C0\uFF08\u622A\u81F3 ${r.period_end}\uFF09\u5F85\u5BA1\u6838`,
      `A ${r.kind} review (period ending ${r.period_end}) is awaiting approval`
    );
  }
  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

// supabase/functions/_shared/insurance/cna.ts
var CNA_DEFAULTS = {
  income_replacement_years: 10,
  education_per_child: 8e4,
  education_inflation: 0.04,
  education_years: 10,
  ci_income_multiple: 3,
  rounding: 1e3
};
var round = (n) => Math.round(n / CNA_DEFAULTS.rounding) * CNA_DEFAULTS.rounding;
function incomeBandMidpoint(band) {
  const map = {
    "RM3,000 \u4EE5\u4E0B": 2e3,
    "RM3,000-5,000": 4e3,
    "RM5,000-8,000": 6500,
    "RM8,000-12,000": 1e4,
    "RM12,000 \u4EE5\u4E0A": 15e3
  };
  return map[(band ?? "").trim()] ?? 0;
}
var NOTE_GROUP_COVER = "\u542B\u56E2\u4FDD\uFF0C\u79BB\u804C\u5373\u5931\u6548 / Includes group-employer cover, which lapses once employment ends";
var NOTE_TPD_ASSUMED = "\u5047\u8BBE\u5BFF\u9669\u542B TPD\uFF0C\u4FDD\u5355\u672A\u5355\u72EC\u5217\u660E\u5168\u6B8B\u4FDD\u969C / Assumes the life plan's sum assured also covers TPD (no separate TPD benefit on file)";
var NOTE_MEDICAL_LOW_LIMIT = "\u533B\u7597\u5361\u5E74\u9650\u989D\u504F\u4F4E\uFF08\u4F4E\u4E8E RM1,000,000\uFF09 / Medical card annual limit is low (below RM1,000,000)";
var NOTE_MEDICAL_NO_COVER = "\u672A\u89C1\u533B\u7597\u5361\u4FDD\u969C / No medical card cover on file";
var NOTE_MEDICAL_LIMIT_UNKNOWN = "\u672A\u8BB0\u5F55\u5E74\u9650\u989D / No annual limit recorded on file";
var NOTE_CI_EARLY_NOT_TRACKED = "\u7CFB\u7EDF\u672A\u5355\u72EC\u8BB0\u5F55\u65E9\u671F/\u665A\u671F\u91CD\u75BE\u8D54\u4ED8\u6BD4\u4F8B\uFF0C\u5982\u4FDD\u5355\u542B\u6B64\u9879\u8BF7\u4EBA\u5DE5\u6838\u5BF9 / Early-stage critical illness payout isn't tracked separately \u2014 verify manually if the policy includes one";
var noteMrtaOffset = (amount) => `\u5DF2\u6263\u9664 MRTA/MLTA \u4FDD\u5355\u8986\u76D6\u7684\u623F\u8D37\u4F59\u989D RM${amount.toLocaleString()} / Excludes RM${amount.toLocaleString()} of mortgage balance already covered by an MRTA/MLTA policy`;
function defaultCoverageDetail(input) {
  return {
    death_cover: input.life_cover,
    death_has_group: false,
    tpd_cover: input.life_cover,
    tpd_has_group: false,
    tpd_assumed_from_life: true,
    ci_cover: input.ci_cover,
    ci_has_group: false,
    ci_early_cover: 0,
    ci_early_has_group: false,
    has_medical: input.has_medical,
    medical_annual_limit: 0,
    medical_has_group: false,
    pa_cover: 0,
    pa_has_group: false,
    liabilities_covered_by_policy: 0
  };
}
function lineItem(need, cover, notes) {
  const item = { cover: round(cover), notes };
  if (need != null) {
    item.need = round(need);
    item.gap = round(Math.max(0, need - cover));
  }
  return item;
}
function buildProtectionSet(cov, needBasis) {
  const netLiabilities = Math.max(
    0,
    needBasis.liabilitiesGross - cov.liabilities_covered_by_policy
  );
  const lifeNeed = needBasis.incomeReplacement + netLiabilities + needBasis.education - needBasis.liquidAssets;
  const deathNotes = [];
  if (cov.death_has_group)
    deathNotes.push(NOTE_GROUP_COVER);
  if (cov.liabilities_covered_by_policy > 0) {
    deathNotes.push(noteMrtaOffset(cov.liabilities_covered_by_policy));
  }
  const tpdNotes = [];
  if (cov.tpd_has_group)
    tpdNotes.push(NOTE_GROUP_COVER);
  if (cov.tpd_assumed_from_life)
    tpdNotes.push(NOTE_TPD_ASSUMED);
  if (cov.liabilities_covered_by_policy > 0) {
    tpdNotes.push(noteMrtaOffset(cov.liabilities_covered_by_policy));
  }
  const ciNotes = [];
  if (cov.ci_has_group)
    ciNotes.push(NOTE_GROUP_COVER);
  const ciEarlyNotes = [NOTE_CI_EARLY_NOT_TRACKED];
  if (cov.ci_early_has_group)
    ciEarlyNotes.push(NOTE_GROUP_COVER);
  const limitKnown = cov.medical_annual_limit > 0;
  const lowLimit = cov.has_medical && limitKnown && cov.medical_annual_limit < 1e6;
  const limitUnknown = cov.has_medical && !limitKnown;
  const medicalNotes = [];
  if (!cov.has_medical)
    medicalNotes.push(NOTE_MEDICAL_NO_COVER);
  if (limitUnknown)
    medicalNotes.push(NOTE_MEDICAL_LIMIT_UNKNOWN);
  if (lowLimit)
    medicalNotes.push(NOTE_MEDICAL_LOW_LIMIT);
  if (cov.medical_has_group)
    medicalNotes.push(NOTE_GROUP_COVER);
  const paNotes = [];
  if (cov.pa_has_group)
    paNotes.push(NOTE_GROUP_COVER);
  return {
    death: lineItem(lifeNeed, cov.death_cover, deathNotes),
    tpd: lineItem(lifeNeed, cov.tpd_cover, tpdNotes),
    ci: lineItem(needBasis.ciNeed, cov.ci_cover, ciNotes),
    ci_early_cover: lineItem(void 0, cov.ci_early_cover, ciEarlyNotes),
    medical: {
      ...lineItem(void 0, cov.medical_annual_limit, medicalNotes),
      has_cover: cov.has_medical,
      annual_limit: round(cov.medical_annual_limit),
      low_limit: lowLimit,
      limit_unknown: limitUnknown
    },
    pa: lineItem(void 0, cov.pa_cover, paNotes)
  };
}
function computeCna(input) {
  const d = CNA_DEFAULTS;
  const useEducationOverride = input.education_need_override != null;
  const assumptions = [
    `\u6536\u5165\u66FF\u4EE3\u5E74\u6570\u6309 ${d.income_replacement_years} \u5E74\u8BA1\u7B97`,
    useEducationOverride ? "\u6559\u80B2\u91D1\u9700\u6C42\u53D6\u81EA\u5BA2\u6237\u7684\u771F\u5B9E\u6559\u80B2\u76EE\u6807\uFF08\u76EE\u6807\u89C4\u5212\u6A21\u5757\u63A8\u7B97\u7684\u672A\u6765\u6210\u672C\uFF09" : `\u6559\u80B2\u91D1\u6309\u6BCF\u540D\u53D7\u629A\u517B\u4EBA RM${d.education_per_child.toLocaleString()}\u3001\u6BCF\u5E74 ${d.education_inflation * 100}% \u901A\u80C0\u3001${d.education_years} \u5E74\u671F\u4F30\u7B97`,
    `\u91CD\u75BE\u4FDD\u969C\u9700\u6C42\u6309\u5E74\u6536\u5165 ${d.ci_income_multiple} \u500D\u4F30\u7B97`,
    `\u6240\u6709\u91D1\u989D\u53D6\u6574\u5230\u6700\u8FD1 RM${d.rounding.toLocaleString()}`
  ];
  if (input.income_estimated) {
    assumptions.push("\u5E74\u6536\u5165\u6309\u8868\u5355\u6536\u5165\u533A\u95F4\u4E2D\u503C\u4F30\u7B97\uFF0C\u5B9E\u9645\u6570\u5B57\u53EF\u80FD\u6709\u51FA\u5165");
  }
  if (input.liabilities_total === null) {
    assumptions.push("\u672A\u63D0\u4F9B\u8D1F\u503A\u8D44\u6599\uFF0C\u6682\u6309 RM0 \u8BA1\u7B97\uFF0C\u5B9E\u9645\u7F3A\u53E3\u53EF\u80FD\u66F4\u5927");
  }
  if (input.liquid_assets === null) {
    assumptions.push("\u672A\u63D0\u4F9B\u6D41\u52A8\u8D44\u4EA7\u8D44\u6599\uFF0C\u6682\u6309 RM0 \u8BA1\u7B97");
  }
  const liabilities = input.liabilities_total ?? 0;
  const liquidAssets = input.liquid_assets ?? 0;
  const incomeReplacement = input.annual_income * d.income_replacement_years;
  const education = useEducationOverride ? input.education_need_override : input.dependents * d.education_per_child * Math.pow(1 + d.education_inflation, d.education_years);
  const ciNeed = input.annual_income * d.ci_income_multiple;
  const mainCoverage = input.coverage ?? defaultCoverageDetail(input);
  const exGroupCoverage = input.coverage_excluding_group ?? mainCoverage;
  const netLiabilitiesMain = Math.max(
    0,
    liabilities - mainCoverage.liabilities_covered_by_policy
  );
  const totalLifeNeed = incomeReplacement + netLiabilitiesMain + education;
  const lifeCovered = input.life_cover + liquidAssets;
  const lifeGap = Math.max(0, totalLifeNeed - lifeCovered);
  const ciGap = Math.max(0, ciNeed - input.ci_cover);
  const needBasis = {
    incomeReplacement,
    liabilitiesGross: liabilities,
    education,
    liquidAssets,
    ciNeed
  };
  const mainSet = buildProtectionSet(mainCoverage, needBasis);
  const exGroupSet = buildProtectionSet(exGroupCoverage, needBasis);
  return {
    assumptions,
    inputs: input,
    needs: {
      income_replacement: round(incomeReplacement),
      liabilities: round(netLiabilitiesMain),
      education: round(education),
      total_life: round(totalLifeNeed),
      ci: round(ciNeed)
    },
    resources: {
      life_cover: round(input.life_cover),
      ci_cover: round(input.ci_cover),
      liquid_assets: round(liquidAssets)
    },
    gaps: [
      {
        key: "life",
        label: "\u4EBA\u5BFF\u4FDD\u969C",
        need: round(totalLifeNeed),
        covered: round(lifeCovered),
        gap: round(lifeGap)
      },
      {
        key: "ci",
        label: "\u91CD\u75BE\u4FDD\u969C",
        need: round(ciNeed),
        covered: round(input.ci_cover),
        gap: round(ciGap)
      },
      {
        key: "medical",
        label: "\u533B\u7597\u4FDD\u969C",
        flag_only: true,
        has_cover: input.has_medical
      }
    ],
    insufficient: input.annual_income <= 0,
    death: mainSet.death,
    tpd: mainSet.tpd,
    ci: mainSet.ci,
    ci_early_cover: mainSet.ci_early_cover,
    medical: mainSet.medical,
    pa: mainSet.pa,
    excluding_group: exGroupSet
  };
}

// supabase/functions/_shared/insurance/mapping.ts
function parseAmount(raw) {
  if (typeof raw === "number")
    return isFinite(raw) ? raw : 0;
  if (typeof raw !== "string")
    return 0;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned)
    return 0;
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}
function parseDependents(raw) {
  if (typeof raw === "number")
    return Math.max(0, Math.floor(raw));
  if (typeof raw !== "string")
    return 0;
  const m = raw.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
var LIFE_TYPES_EXTRACTED = ["term life", "whole life", "investment-linked"];
function buildProspectCnaInput(profile, extractedPolicies) {
  const mc = profile.manual_coverage ?? {};
  let lifeCover = mc.life ?? 0;
  let ciCover = mc.ci ?? 0;
  let hasMedical = (mc.medical ?? 0) > 0;
  for (const p of extractedPolicies ?? []) {
    const type = (p.policy_type ?? "").toLowerCase();
    const sum = parseAmount(p.sum_assured);
    if (LIFE_TYPES_EXTRACTED.some((t) => type.includes(t)))
      lifeCover += sum;
    if (type.includes("critical illness"))
      ciCover += sum;
    if (type.includes("medical"))
      hasMedical = true;
  }
  return {
    annual_income: incomeBandMidpoint(profile.monthly_income_band ?? "") * 12,
    income_estimated: true,
    liabilities_total: null,
    liquid_assets: null,
    life_cover: lifeCover,
    ci_cover: ciCover,
    has_medical: hasMedical,
    dependents: parseDependents(profile.dependents)
  };
}
var LIFE_POLICY_TYPES = ["life", "investment_linked"];
var PREMIUM_ANNUALIZE = {
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  single_premium: 0
};
var CASHFLOW_ANNUALIZE = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semi_annual: 2,
  annual: 1,
  one_off: 0
};
var CI_RIDER_CATEGORIES = ["critical_illness", "cancer"];
function isCoverageCounted(p) {
  return p.status == null || p.status === "in_force" || p.status === "paid_up";
}
function buildCoverageDetail(policies, liabilities, excludeGroup) {
  const pool = policies.filter(
    (p) => isCoverageCounted(p) && (!excludeGroup || p.is_group_employer !== true)
  );
  let deathCover = 0, deathHasGroup = false;
  let disabilityCover = 0, disabilityHasGroup = false;
  let ciCover = 0, ciHasGroup = false;
  let hasMedical = false, medicalHasGroup = false, medicalAnnualLimit = 0;
  let paCover = 0, paHasGroup = false;
  const mrtaLiabilityIds = /* @__PURE__ */ new Set();
  for (const p of pool) {
    const isGroup = p.is_group_employer === true;
    const baseSum = p.sum_assured ?? 0;
    if (LIFE_POLICY_TYPES.includes(p.policy_type)) {
      deathCover += baseSum;
      if (baseSum > 0 && isGroup)
        deathHasGroup = true;
    }
    if (p.policy_type === "critical_illness") {
      ciCover += baseSum;
      if (baseSum > 0 && isGroup)
        ciHasGroup = true;
    }
    if (p.policy_type === "disability") {
      disabilityCover += baseSum;
      if (baseSum > 0 && isGroup)
        disabilityHasGroup = true;
    }
    if (p.policy_type === "accident") {
      paCover += baseSum;
      if (baseSum > 0 && isGroup)
        paHasGroup = true;
    }
    if (p.policy_type === "medical") {
      hasMedical = true;
      if (isGroup)
        medicalHasGroup = true;
      const limit = p.annual_limit ?? 0;
      if (limit > medicalAnnualLimit)
        medicalAnnualLimit = limit;
    }
    if (p.covers_liability_id)
      mrtaLiabilityIds.add(p.covers_liability_id);
    for (const r of p.policy_riders ?? []) {
      const riderSum = r.sum_assured ?? 0;
      if (r.category === "life") {
        deathCover += riderSum;
        if (riderSum > 0 && isGroup)
          deathHasGroup = true;
      } else if (r.category === "disability") {
        disabilityCover += riderSum;
        if (riderSum > 0 && isGroup)
          disabilityHasGroup = true;
      } else if (CI_RIDER_CATEGORIES.includes(r.category)) {
        ciCover += riderSum;
        if (riderSum > 0 && isGroup)
          ciHasGroup = true;
      } else if (r.category === "medical") {
        hasMedical = true;
        if (isGroup)
          medicalHasGroup = true;
        const limit = r.annual_limit ?? 0;
        if (limit > medicalAnnualLimit)
          medicalAnnualLimit = limit;
      } else if (r.category === "accident") {
        paCover += riderSum;
        if (riderSum > 0 && isGroup)
          paHasGroup = true;
      }
    }
  }
  const liabilitiesCoveredByPolicy = [...mrtaLiabilityIds].reduce((sum, id) => {
    const l = liabilities.find((x) => x.id === id);
    return sum + (l?.outstanding_balance ?? 0);
  }, 0);
  const hasOwnTpdCover = disabilityCover > 0;
  return {
    death_cover: deathCover,
    death_has_group: deathHasGroup,
    tpd_cover: hasOwnTpdCover ? disabilityCover : deathCover,
    tpd_has_group: hasOwnTpdCover ? disabilityHasGroup : deathHasGroup,
    tpd_assumed_from_life: !hasOwnTpdCover,
    ci_cover: ciCover,
    ci_has_group: ciHasGroup,
    // No policy_riders category distinguishes early/advance-stage CI payouts
    // today — decision 1's ci_early_cover stays 0 with an explanatory note
    // (computeCna adds it) until that data exists.
    ci_early_cover: 0,
    ci_early_has_group: false,
    has_medical: hasMedical,
    medical_annual_limit: medicalAnnualLimit,
    medical_has_group: medicalHasGroup,
    pa_cover: paCover,
    pa_has_group: paHasGroup,
    liabilities_covered_by_policy: liabilitiesCoveredByPolicy
  };
}
function annualizeInflows(inflows) {
  return inflows.reduce(
    (sum, e) => sum + e.amount * (CASHFLOW_ANNUALIZE[e.frequency] ?? 12),
    0
  );
}
function annualPremiumTotal(policies) {
  return policies.reduce(
    (sum, p) => sum + (p.premium ?? 0) * (PREMIUM_ANNUALIZE[p.premium_frequency ?? "annual"] ?? 1),
    0
  );
}
function buildCfpCnaInput(f, overrides = {}) {
  const coverage = buildCoverageDetail(f.policies, f.liabilities, false);
  const coverageExcludingGroup = buildCoverageDetail(f.policies, f.liabilities, true);
  return {
    // The baseline's figure wins: it was annualised from the months the advisor
    // chose, so the income replacement and CI needs below rest on the same
    // basis as every other figure in the report. Falling back to the row-by-row
    // sum keeps the prospect path (no baseline, income as a band) working.
    annual_income: overrides.annual_income ?? annualizeInflows(f.inflows),
    liabilities_total: f.liabilities.reduce(
      (s, l) => s + (l.outstanding_balance ?? 0),
      0
    ),
    liquid_assets: overrides.liquid_assets ?? f.assets.filter((a) => isLiquid(a.asset_type)).reduce((s, a) => s + (a.current_value ?? 0), 0),
    life_cover: coverage.death_cover,
    ci_cover: coverage.ci_cover,
    has_medical: coverage.has_medical,
    dependents: f.client.number_of_dependants ?? 0,
    ...overrides.education_need != null ? { education_need_override: overrides.education_need } : {},
    coverage,
    coverage_excluding_group: coverageExcludingGroup
  };
}

// supabase/functions/_shared/finance/allocation.ts
var ALLOCATION_BUCKETS = ["equity", "bond", "cash", "alternatives"];
var MODEL_PORTFOLIOS = {
  conservative: { equity: 20, bond: 55, cash: 20, alternatives: 5 },
  moderate: { equity: 35, bond: 45, cash: 15, alternatives: 5 },
  balanced: { equity: 50, bond: 35, cash: 10, alternatives: 5 },
  growth: { equity: 65, bond: 25, cash: 5, alternatives: 5 },
  aggressive: { equity: 80, bond: 10, cash: 5, alternatives: 5 }
};
function riskBandFromSuitability(band) {
  switch (band) {
    case "STABLE":
      return "conservative";
    case "BALANCED":
      return "balanced";
    case "GROWTH":
      return "growth";
    case "AGGRESSIVE_GROWTH":
      return "aggressive";
    default:
      return null;
  }
}
var REBALANCE_THRESHOLD_PP = 5;
var round3 = (n) => Math.round(n);
function allocationOf(assets, holdings = [], cash = 0) {
  const sumBucket = (bucket) => (assets ?? []).filter((a) => allocationBucketOf(a.asset_type) === bucket).reduce((s, a) => s + (a.current_value ?? 0), 0);
  const equity = sumBucket("equity") + (holdings ?? []).reduce((s, h) => s + (h.market_value ?? 0), 0);
  const bond = sumBucket("bond");
  const alternatives = sumBucket("alternatives");
  return { equity, bond, cash, alternatives };
}
function currentAllocationRows(amounts) {
  const investable_total = ALLOCATION_BUCKETS.reduce((s, k) => s + amounts[k], 0);
  const rows = ALLOCATION_BUCKETS.map((bucket) => ({
    bucket,
    amount: round3(amounts[bucket]),
    pct: investable_total > 0 ? Number((amounts[bucket] / investable_total * 100).toFixed(1)) : null
  }));
  return { investable_total, rows };
}
function driftAgainst(model, allocation) {
  const investable_total = allocation.reduce((s, r) => s + r.amount, 0);
  const target_allocation = ALLOCATION_BUCKETS.map((bucket) => ({
    bucket,
    amount: round3(model[bucket] / 100 * investable_total),
    pct: model[bucket]
  }));
  const drift = ALLOCATION_BUCKETS.map((bucket) => {
    const currentPct = allocation.find((r) => r.bucket === bucket)?.pct ?? null;
    const target = model[bucket];
    return {
      bucket,
      current_pct: currentPct,
      target_pct: target,
      drift_pp: currentPct != null ? Number((currentPct - target).toFixed(1)) : null
    };
  });
  const rebalancing_actions = drift.filter((d) => d.drift_pp != null && Math.abs(d.drift_pp) > REBALANCE_THRESHOLD_PP).map((d) => ({
    bucket: d.bucket,
    action: d.drift_pp > 0 ? "reduce" : "increase",
    amount: round3(Math.abs(d.drift_pp) / 100 * investable_total)
  }));
  return { target_allocation, drift, rebalancing_actions };
}

// supabase/functions/_shared/taxonomy/index.ts
function isTransferCategory2(code, direction = "outflow") {
  return wealthEffectOf(code, direction) === "transfer";
}
export {
  ALLOCATION_BUCKETS,
  ASSET_CLASSES,
  ASSET_TYPES,
  CASHFLOW_CATEGORIES,
  CASHFLOW_GROUPS,
  CATEGORY_BY_CODE,
  CNA_DEFAULTS,
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
  MODEL_PORTFOLIOS,
  QUADRANTS,
  SOCSO_EIS_WAGE_CEILING,
  SOCSO_EMPLOYEE_RATE,
  STATUTORY_NOTE,
  STATUTORY_SENIOR_AGE,
  TRANSFER_CATEGORY_CODES,
  activeItems,
  allocationBucketOf,
  allocationOf,
  annualPremiumTotal,
  annualizeInflows,
  annualizeItems,
  annualizeItemsByCategory,
  assessAsset,
  assessAssets,
  assetClassOf,
  assetTypeLabel,
  assetTypeMeta,
  buildCfpCnaInput,
  buildProspectCnaInput,
  categoriesOf,
  categoryLabel,
  classifyAsset,
  classifyCashflowRow,
  computeAlerts,
  computeCna,
  computeSnapshot,
  currentAllocationRows,
  deriveLoanItems,
  derivePremiumItems,
  deriveStatutoryItems,
  driftAgainst,
  endItem,
  estimateLoan,
  groupOf,
  incomeBandMidpoint,
  isActiveAt,
  isLiquid,
  isRetirementCapital,
  isSuperseded,
  isTransferCategory2 as isTransferCategory,
  itemMonthlyAmount,
  itemsFromMonthRows,
  levelUpAsset,
  levelUpLiabilityType,
  liabilityTypeLabel,
  liabilityTypeMeta,
  liquidityLevel,
  monthStart,
  parseAmount,
  parseDependents,
  planCashflow,
  premiumCategoryOf,
  reconcile,
  resolveCategory,
  reviseItem,
  riskBandFromSuitability,
  twr,
  valueChangeAnnual,
  wealthEffectOf
};
