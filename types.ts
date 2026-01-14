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
  lastUpdated: string;
}