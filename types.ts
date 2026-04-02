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
  }
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
  correspodenceAddress?: string;
  correspodencePostalCode?: string;
  correspodenceCity?: string;
  correspodenceState?: string;
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
  // Loan fields for Property and Vehicle
  isUnderLoan?: boolean;
  outstandingBalance?: string;
  interestRate?: string;
  tenure?: string;
  loanCommencementYear?: string;
  loanCommencementMonth?: string;
  monthlyInstallment?: string;
}

export interface ExpenseItem {
  id: string;
  type: string;
  amount: string;
  month: string;
  year: string;
}

export interface KYCIncomeData {
  monthlySalary: string;
  salaryMonth: string;
  salaryYear: string;
  annualBonus: string;
  bonusMonth: string;
  bonusYear: string;
  rentalIncome: IncomeItem[];
  dividendIncome: IncomeItem[];
  otherIncome: IncomeItem[];
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
  
  // Next steps
  income: KYCIncomeData;
  assets: KYCAssetsData;
  liabilities: KYCLiabilitiesData;
  expenses: KYCExpensesData;
  investments: KYCInvestmentsData;
}

export const initialKYCData: KYCData = {
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
    monthlySalary: '',
    salaryMonth: new Date().getMonth().toString(),
    salaryYear: new Date().getFullYear().toString(),
    annualBonus: '',
    bonusMonth: new Date().getMonth().toString(),
    bonusYear: new Date().getFullYear().toString(),
    rentalIncome: [],
    dividendIncome: [],
    otherIncome: []
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