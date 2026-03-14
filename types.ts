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
  
  // Placholders for next steps
  income: any;
  assets: any;
  liabilities: any;
  expenses: any;
  investments: any;
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
  income: {},
  assets: {},
  liabilities: {},
  expenses: {},
  investments: {}
};