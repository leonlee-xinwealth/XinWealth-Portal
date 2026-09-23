export enum ViewState {
  PLAYER = 'PLAYER',
  INVESTMENT = 'INVESTMENT',
  INSURANCE = 'INSURANCE',
  HEALTH_CHECK = 'HEALTH_CHECK',
  TAX = 'TAX',
  FINANCIAL_GOAL = 'FINANCIAL_GOAL',
  NET_WORTH = 'NET_WORTH',
  CASHFLOW = 'CASHFLOW',
  RETIREMENT = 'RETIREMENT',
  SETTINGS = 'SETTINGS'
}

export interface Transaction {
  id: string;
  date: string;
  type: 'Deposit' | 'Withdrawal' | 'Dividend' | 'Buy' | 'Sell';
  asset: string;
  amount: number;
  status: 'Completed' | 'Pending';
}

export interface PortfolioDataPoint {
  date: string;
  portfolioValue: number;
  fdValue: number; // The value if invested in Fixed Deposit (Calculated at 3%)
}

export interface AnalyticsItem {
  id: string;
  name: string;
  type: 'Asset' | 'Liability';
  category: string;
  initialValue: number;
  currentValue: number;
  progress: number; // % Repayment or % Growth
  monthlyRoi: number;
  cumulativeCashflow: number;
  equity?: number; // Asset Value - Liability Value
  history: {
    date: string;
    value: number;
    cashflow: number;
  }[];
}

export interface FinancialAnalytics {
  items: AnalyticsItem[];
  totalEquity: number;
  netWorthTrend: { date: string; assets: number; liabilities: number; netWorth: number }[];
}

export interface FinancialHealthData {
  basicLiquidityRatio: number;
  liquidAssetToNetWorth: number;
  solvencyRatio: number;
  debtServiceRatio: number;
  nonMortgageDSR: number;
  lifeInsuranceCoverage: number;
  savingsRatio: number;
  investAssetsToNetWorth: number;
  passiveIncomeCoverage: number;
  // Raw values for calculation display
  raw: {
    cashAndFD: number;
    monthlyExpenses: number;
    netWorth: number;
    totalAssets: number;
    totalMonthlyDebtRepayment: number;
    monthlyNetIncome: number;
    consumerDebtRepayment: number;
    totalSumAssured: number;
    annualIncome: number;
    monthlySavings: number;
    monthlyGrossIncome: number;
    investmentAssets: number;
    annualPassiveIncome: number;
    annualExpenses: number;
    insurance: any[]; // Add insurance raw data
  };
  analytics?: FinancialAnalytics;
}

// ── P3: per-asset 2×2 quality + portfolio allocation vs target ──
// Shapes returned additively by api/health.js (decisions 3/4, spec
// docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md),
// mirroring supabase/functions/_shared/finance/assetQuality.ts and
// allocation.ts's result types on the Deno side. fetchRawHealthData() stays
// loosely typed (`any`) for its existing consumers; components that read
// these two fields cast to these types instead.

export type AssetQualityQuadrant =
  | 'productive'
  | 'yielding_depreciating'
  | 'appreciating_cash_consuming'
  | 'consuming';

export interface AssetQualityAssessment {
  asset_id: string;
  asset_class: 'A' | 'B' | 'C' | 'D';
  /** null for class A/B — they don't get a 2×2 label. */
  quadrant: AssetQualityQuadrant | null;
  net_cash_flow_monthly: number;
  value_change_annual: number | null;
  value_change_source: 'history' | 'default_depreciation' | 'none';
  total_return_annual: number;
  return_pct: number | null;
  notes: string[];
}

export interface AssetQualityQuadrantTotal {
  count: number;
  value: number;
  net_cash_flow_monthly: number;
}

export interface AssetQualitySummary {
  assets: AssetQualityAssessment[];
  by_quadrant: Record<AssetQualityQuadrant, AssetQualityQuadrantTotal>;
}

export type PortfolioAllocationBucket = 'equity' | 'bond' | 'cash' | 'alternatives';

export interface PortfolioAllocationRow {
  bucket: PortfolioAllocationBucket;
  amount: number;
  pct: number | null;
}

export interface PortfolioDriftRow {
  bucket: PortfolioAllocationBucket;
  current_pct: number | null;
  target_pct: number;
  drift_pp: number | null;
}

export interface PortfolioRebalancingAction {
  bucket: PortfolioAllocationBucket;
  action: 'increase' | 'reduce';
  amount: number;
}

export interface PortfolioAllocationSummary {
  /** risk band the target allocation is drawn from (e.g. "growth") — falls
   *  back to "balanced" when neither a suitability result nor
   *  clients.risk_profile resolves to a known band (see risk_band_defaulted). */
  risk_band: string;
  /** true when risk_band fell back to "balanced" rather than being resolved
   *  from suitability or clients.risk_profile. */
  risk_band_defaulted: boolean;
  /** which source won: the client's latest suitability result, or the
   *  advisor-set clients.risk_profile — null when risk_band_defaulted. */
  risk_band_source: 'suitability' | 'profile' | null;
  investable_total: number;
  current_allocation: PortfolioAllocationRow[];
  target_allocation: PortfolioAllocationRow[];
  drift: PortfolioDriftRow[];
  rebalancing_actions: PortfolioRebalancingAction[];
}

export interface ClientProfile {
  name: string;
  totalValue: number;
  totalInvested: number;
  totalReturn: number;
  returnPercentage: number; // Simple Return (Value / Cost - 1)
  twr: number; // Time Weighted Return
  mwr: number; // Money Weighted Return (XIRR)
  fdDifference: number; // % Difference vs FD
  fdDifferenceValue: number; // Absolute value difference vs FD
  lastUpdated: string;
}

export interface UserSession {
  success: boolean;
  token?: string; // JWT token for backend auth
  name: string;
  email: string;
  recordId: string;
  currentAge: number;
  retirementAge: number;
  familyName?: string;
  givenName?: string;
  advisor?: string;
  occupation?: string;
  // Extended fields for Player Info
  nric?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  residency?: string;
  epfAccountNumber?: string;
  ppaAccountNumber?: string;
  correspondenceAddress?: string;
  correspondencePostalCode?: string;
  correspondenceCity?: string;
  correspondenceState?: string;
}

export interface IncomeItem {
  id: string;
  amount: string;
  description: string;
  month: string;
  year: string;
}

export interface FinancialItem {
  id: string;
  amount: string;
  description: string;
  month?: string;
  year?: string;
  // Cashflow for Assets and Investments
  monthlyIncome?: string;
  monthlyExpenses?: string;
  // Loan fields for Property and Vehicle
  isUnderLoan?: boolean;
  outstandingBalance?: string;
  originalLoanAmount?: string; // New: Original Loan Amount
  interestRate?: string;
  tenure?: string;
  loanCommencementYear?: string;
  loanCommencementMonth?: string;
  loanEndYear?: string;
  loanEndMonth?: string;
  monthlyInstallment?: string;
  purchasePrice?: string; // New: Purchase Price / Principal
}

export interface ExpenseItem {
  id: string;
  type: string;
  amount: string;
  month: string;
  year: string;
}

export interface KYCIncomeData {
  salary: string;  
  salaryMonth: string;
  salaryYear: string;

  bonus: string;
  bonusMonth: string;
  bonusYear: string;

  directorFee: string;
  directorFeeMonth: string;
  directorFeeYear: string;

  commission: string;
  commissionMonth: string;
  commissionYear: string;

  dividendCompany: string;
  dividendCompanyMonth: string;
  dividendCompanyYear: string;

  dividendInvestment: string;
  dividendInvestmentMonth: string;
  dividendInvestmentYear: string;

  rentalIncome: string;
  rentalIncomeMonth: string;
  rentalIncomeYear: string;
}

export interface KYCAssetsData {
  savingsAccount: string;
  savingsAccountMonth: string;
  savingsAccountYear: string;
  fixedDeposit: string;
  fixedDepositMonth: string;
  fixedDepositYear: string;
  moneyMarketFund: string;
  moneyMarketFundMonth: string;
  moneyMarketFundYear: string;
  epfSejahtera: string;
  epfSejahteraMonth: string;
  epfSejahteraYear: string;
  epfPersaraan: string;
  epfPersaraanMonth: string;
  epfPersaraanYear: string;
  epfFleksibel: string;
  epfFleksibelMonth: string;
  epfFleksibelYear: string;
  properties: FinancialItem[];
  vehicles: FinancialItem[];
  otherAssets: FinancialItem[];
}

export interface KYCLiabilitiesData {
  studyLoans: FinancialItem[];
  personalLoans: FinancialItem[];
  renovationLoans: FinancialItem[];
  otherLoans: FinancialItem[];
}

export interface KYCExpensesData {
  household: ExpenseItem[];
  transportation: ExpenseItem[];
  dependants: ExpenseItem[];
  personal: ExpenseItem[];
  miscellaneous: ExpenseItem[];
  otherExpenses: ExpenseItem[];
}

export interface KYCInvestmentsData {
  etf: FinancialItem[];
  bonds: FinancialItem[];
  stocks: FinancialItem[];
  unitTrusts: FinancialItem[];
  fixedDeposits: FinancialItem[];
  forex: FinancialItem[];
  moneyMarket: FinancialItem[];
  otherInvestments: FinancialItem[];
}

export interface KYCData {
  globalMonth: string;
  globalYear: string;
  // Basic Info
  familyName: string;
  givenName: string;
  salutation: string;
  email: string;
  dateOfBirth: string;
  nationality: string;
  residency: string;
  maritalStatus: string;
  retirementAge: string;
  
  // Employment
  employmentStatus: string;
  taxStatus: string;
  occupation: string;
  
  // PDPA
  pdpaAccepted: boolean;

  // Advisor attribution — set from the /kyc?ref=<code> link so the submission
  // is routed to the correct advisor. Optional; API falls back to a default.
  advisorRef?: string;

  // Next steps
  income: KYCIncomeData;
  assets: KYCAssetsData;
  liabilities: KYCLiabilitiesData;
  expenses: KYCExpensesData;
  investments: KYCInvestmentsData;
}

// ── Investment Tab (New Multi-Portfolio Architecture) ──

export interface Portfolio {
  id: string;
  name: string;
  currency: string;          // "SGD" | "MYR"
  capital_injection: number;
  injection_date: string;    // ISO date e.g. "2025-12-01"
  portfolio_history: PortfolioSnapshot[];
  // P3 (CFP assets & portfolio, decision 1): api/portfolios.js now reads
  // investment assets (class C + PRS) with their asset_valuations history,
  // falling back to the legacy portfolios/portfolio_history row when an
  // asset has no valuations yet. Both fields are additive/optional so
  // existing callers built before P3 keep compiling unchanged.
  /** taxonomy asset_type code (e.g. "unit_trust", "prs") — absent on a
   *  legacy-sourced row. */
  asset_type?: string;
  /** which table this row was shaped from. */
  source?: 'asset' | 'legacy';
}

export interface PortfolioSnapshot {
  snapshot_date: string;     // ISO date e.g. "2025-12-31"
  end_value: number;
  cashflow: number;
}

export interface PortfolioMetrics {
  currentValue: number;
  totalReturnPct: number;    // simple return % since inception
  cagr: number;              // annualised compound return %
  xirr: number;              // money-weighted annualised %
  twr: number;               // time-weighted cumulative %
  fdCurrentValue: number;    // FD equivalent at latest month
  fdDiffAbsolute: number;    // portfolio − FD in currency units
  fdDiffPct: number;         // (portfolio − FD) / FD × 100
  monthlyData: PortfolioMonthlyPoint[];
}

export interface PortfolioMonthlyPoint {
  label: string;             // "Dec 25", "Jan 26", …
  portfolioValue: number;
  fdValue: number;
  fdDiff: number;            // portfolioValue − fdValue
}

export const initialKYCData: KYCData = {
  globalMonth: new Date().getMonth().toString(),
  globalYear: new Date().getFullYear().toString(),
  familyName: '',
  givenName: '',
  salutation: '',
  email: '',
  dateOfBirth: '',
  nationality: '',
  residency: '',
  maritalStatus: '',
  retirementAge: '55',
  employmentStatus: '',
  taxStatus: '',
  occupation: '',
  pdpaAccepted: false,
  income: {
    salary: '', salaryMonth: new Date().getMonth().toString(), salaryYear: new Date().getFullYear().toString(),
    bonus: '', bonusMonth: new Date().getMonth().toString(), bonusYear: new Date().getFullYear().toString(),
    directorFee: '', directorFeeMonth: new Date().getMonth().toString(), directorFeeYear: new Date().getFullYear().toString(),
    commission: '', commissionMonth: new Date().getMonth().toString(), commissionYear: new Date().getFullYear().toString(),
    dividendCompany: '', dividendCompanyMonth: new Date().getMonth().toString(), dividendCompanyYear: new Date().getFullYear().toString(),
    dividendInvestment: '', dividendInvestmentMonth: new Date().getMonth().toString(), dividendInvestmentYear: new Date().getFullYear().toString(),
    rentalIncome: '', rentalIncomeMonth: new Date().getMonth().toString(), rentalIncomeYear: new Date().getFullYear().toString(),
  },
  assets: {
    savingsAccount: '',
    savingsAccountMonth: new Date().getMonth().toString(),
    savingsAccountYear: new Date().getFullYear().toString(),
    fixedDeposit: '',
    fixedDepositMonth: new Date().getMonth().toString(),
    fixedDepositYear: new Date().getFullYear().toString(),
    moneyMarketFund: '',
    moneyMarketFundMonth: new Date().getMonth().toString(),
    moneyMarketFundYear: new Date().getFullYear().toString(),
    epfSejahtera: '',
    epfSejahteraMonth: new Date().getMonth().toString(),
    epfSejahteraYear: new Date().getFullYear().toString(),
    epfPersaraan: '',
    epfPersaraanMonth: new Date().getMonth().toString(),
    epfPersaraanYear: new Date().getFullYear().toString(),
    epfFleksibel: '',
    epfFleksibelMonth: new Date().getMonth().toString(),
    epfFleksibelYear: new Date().getFullYear().toString(),
    properties: [],
    vehicles: [],
    otherAssets: [],
  },
  liabilities: {
    studyLoans: [],
    personalLoans: [],
    renovationLoans: [],
    otherLoans: [],
  },
  expenses: {
    household: [],
    transportation: [],
    dependants: [],
    personal: [],
    miscellaneous: [],
    otherExpenses: []
  },
  investments: {
    etf: [],
    bonds: [],
    stocks: [],
    unitTrusts: [],
    fixedDeposits: [],
    forex: [],
    moneyMarket: [],
    otherInvestments: []
  }
};