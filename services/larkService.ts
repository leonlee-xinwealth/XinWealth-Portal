import { PortfolioDataPoint, Transaction, ClientProfile } from '../types';

/**
 * Connects to Vercel Serverless Functions in the /api folder.
 */

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

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
       const data = await response.json();
       if (!response.ok) {
         throw new Error(data.error || 'Authentication failed (Server Error)');
       }
       setSession(data); 
       return true;
    } else {
       // If backend returns HTML (e.g. 404 page or Vercel error page)
       const text = await response.text();
       console.error("Non-JSON response from server:", text);
       throw new Error(`Server connection failed. Status: ${response.status}. Please ensure API is running.`);
    }

  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

const fetchData = async () => {
  const user = getSession();
  if (!user || !user.name) throw new Error("No user session found");

  const response = await fetch(`/api/data?name=${encodeURIComponent(user.name)}`);
  
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch data");
      return data;
  } else {
      throw new Error("Server connection failed (Invalid Response)");
  }
};

export const fetchClientProfile = async (): Promise<ClientProfile> => {
  const data = await fetchData();
  const records = data.records;
  
  if (!records || records.length === 0) {
     return { name: getSession()?.name || 'Client', totalValue: 0, totalReturn: 0, returnPercentage: 0, lastUpdated: '-' };
  }

  const latestRecord = records[records.length - 1]; 

  // Fields mapping - robust check
  const endValue = latestRecord.fields["End Value"] || latestRecord.fields["end value"] || 0;
  
  const totalInvested = records.reduce((acc: number, r: any) => {
    const cashflow = r.fields["Cashflow"] || r.fields["cashflow"] || 0;
    return acc + cashflow;
  }, 0);

  const totalRet = endValue - totalInvested;
  const retPercent = totalInvested > 0 ? (totalRet / totalInvested) * 100 : 0;
  const dateStr = latestRecord.fields["Date"] || latestRecord.fields["date"] || Date.now();

  return {
    name: getSession()?.name,
    totalValue: endValue,
    totalReturn: totalRet,
    returnPercentage: parseFloat(retPercent.toFixed(2)),
    lastUpdated: new Date(dateStr).toLocaleDateString()
  };
};

export const fetchPortfolioHistory = async (): Promise<PortfolioDataPoint[]> => {
  const data = await fetchData();
  
  return data.records.map((record: any) => ({
    date: new Date(record.fields["Date"] || record.fields["date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    portfolioValue: record.fields["End Value"] || record.fields["end value"] || 0,
    fdValue: record.fields["FD"] || record.fields["fd"] || 0
  }));
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const data = await fetchData();

  return data.records
    .filter((r: any) => {
        const cf = r.fields["Cashflow"] || r.fields["cashflow"];
        return cf && cf !== 0;
    })
    .map((r: any, index: number) => {
      const cf = r.fields["Cashflow"] || r.fields["cashflow"];
      return {
        id: r.recordId || `tx-${index}`,
        date: new Date(r.fields["Date"] || r.fields["date"]).toLocaleDateString('en-CA'),
        type: cf > 0 ? 'Deposit' : 'Withdrawal',
        asset: 'Portfolio Adjustment',
        amount: Math.abs(cf),
        status: 'Completed'
      };
    })
    .reverse();
};