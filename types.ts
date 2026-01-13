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
  fdValue: number; // The value if invested in Fixed Deposit
}

export interface ClientProfile {
  name: string;
  totalValue: number;
  totalReturn: number;
  returnPercentage: number;
  lastUpdated: string;
}