import { PortfolioDataPoint, Transaction, ClientProfile } from '../types';

/**
 * Connects to Vercel Serverless Functions in the /api folder.
 * These functions then securely communicate with Lark Base.
 */

// Helper to store/retrieve user session
const setSession = (data: any) => localStorage.setItem('xinwealth_user', JSON.stringify(data));
const getSession = () => {
  const s = localStorage.getItem('xinwealth_user');
  return s ? JSON.parse(s) : null;
};
export const clearSession = () => localStorage.removeItem('xinwealth_user');

export const authenticateUser = async (email: string, pass: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });

    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const userData = await response.json();
    // Store user name to fetch specific data later
    setSession(userData); 
    return true;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

// Helper to fetch data from our backend
const fetchData = async () => {
  const user = getSession();
  if (!user || !user.name) throw new Error("No user session found");

  const response = await fetch(`/api/data?name=${encodeURIComponent(user.name)}`);
  if (!response.ok) throw new Error("Failed to fetch data");
  return response.json();
};

export const fetchClientProfile = async (): Promise<ClientProfile> => {
  const data = await fetchData();
  const latestRecord = data.records[data.records.length - 1]; // Assuming sorted by date

  if (!latestRecord) {
     return { name: getSession()?.name || 'Client', totalValue: 0, totalReturn: 0, returnPercentage: 0, lastUpdated: '-' };
  }

  // Calculate generic profile data based on latest record
  // Note: Lark fields come in as fields["End Value"] etc.
  const currentVal = latestRecord.fields["End Value"] || 0;
  const startVal = data.records[0]?.fields["Start Value"] || 0; // Compare vs first record
  const totalRet = currentVal - startVal;
  const retPercent = startVal > 0 ? (totalRet / startVal) * 100 : 0;

  return {
    name: getSession()?.name,
    totalValue: currentVal,
    totalReturn: totalRet,
    returnPercentage: parseFloat(retPercent.toFixed(2)),
    lastUpdated: new Date(latestRecord.fields["Date"] || Date.now()).toLocaleDateString()
  };
};

export const fetchPortfolioHistory = async (): Promise<PortfolioDataPoint[]> => {
  const data = await fetchData();
  
  // Transform Lark records to Graph data
  return data.records.map((record: any) => ({
    date: new Date(record.fields["Date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    portfolioValue: record.fields["End Value"] || 0,
    fdValue: record.fields["FD"] || 0
  }));
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const data = await fetchData();

  // Filter records that have "Cashflow" to show as transactions
  // We map the "Investment" table rows to transactions for simplicity based on your screenshot
  const txs = data.records
    .filter((r: any) => r.fields["Cashflow"] && r.fields["Cashflow"] !== 0)
    .map((r: any, index: number) => ({
      id: r.recordId || `tx-${index}`,
      date: new Date(r.fields["Date"]).toLocaleDateString('en-CA'),
      type: r.fields["Cashflow"] > 0 ? 'Deposit' : 'Withdrawal', // Simplified logic
      asset: 'Portfolio Adjustment',
      amount: Math.abs(r.fields["Cashflow"]),
      status: 'Completed'
    }));
    
  // Reverse to show newest first
  return txs.reverse();
};