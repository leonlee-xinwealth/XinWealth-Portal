export enum ViewState {
  INVESTMENT = 'INVESTMENT',
  INSURANCE = 'INSURANCE',
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

export interface IncomeItem {
  id: string;
  amount: string;
  description: string;
}

export interface FinancialItem {
  id: string;
  amount: string;
  description: string;
}

export interface ExpenseItem {
  id: string;
  type: string;
  amount: string;
}

export interface KYCIncomeData {
  monthlySalary: string;
  annualBonus: string;
  rentalIncome: IncomeItem[];
  dividendIncome: IncomeItem[];
  otherIncome: IncomeItem[];
}

export interface KYCAssetsData {
  savings: string;
  epfSejahtera: string;
  epfPersaraan: string;
  epfFleksibel: string;
  properties: FinancialItem[];
  vehicles: FinancialItem[];
  otherAssets: FinancialItem[];
}

export interface KYCLiabilitiesData {
  mortgages: FinancialItem[];
  carLoans: FinancialItem[];
  studyLoans: FinancialItem[];
  interestOnlyLoans: FinancialItem[];
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
  name: string;
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
  name: '',
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
    annualBonus: '',
    rentalIncome: [],
    dividendIncome: [],
    otherIncome: []
  },
  assets: {
    savings: '',
    epfSejahtera: '',
    epfPersaraan: '',
    epfFleksibel: '',
    properties: [],
    vehicles: [],
    otherAssets: [],
  },
  liabilities: {
    mortgages: [],
    carLoans: [],
    studyLoans: [],
    interestOnlyLoans: [],
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