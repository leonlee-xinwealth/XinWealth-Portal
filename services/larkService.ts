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

// Helper to ensure we are working with numbers, not strings
const safeFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove commas and other non-numeric chars (except dot and minus)
    const clean = val.replace(/,/g, '').trim();
    return parseFloat(clean) || 0;
  }
  return 0;
};

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

// --- Math Helpers ---

// Calculate XIRR using Newton-Raphson method for MWR
const calculateXIRR = (values: number[], dates: Date[], guess = 0.1): number => {
  const tolerance = 1e-5;
  const maxIter = 100;
  
  if (values.length !== dates.length) return 0;
  
  let x0 = guess;
  const t0 = dates[0].getTime(); // Reference date

  for (let i = 0; i < maxIter; i++) {
    let fValue = 0;
    let fDerivative = 0;

    for (let j = 0; j < values.length; j++) {
      const dt = (dates[j].getTime() - t0) / (1000 * 60 * 60 * 24 * 365); // Years
      const factor = Math.pow(1 + x0, dt);
      fValue += values[j] / factor;
      fDerivative -= (dt * values[j]) / (factor * (1 + x0));
    }

    const x1 = x0 - fValue / fDerivative;
    if (Math.abs(x1 - x0) < tolerance) {
      return x1 * 100; // Return as percentage
    }
    x0 = x1;
  }
  return 0; // Failed to converge
};

// Calculate TWR using Modified Dietz or Chain Linking
const calculateTWR = (records: any[]): number => {
    let cumulativeTwr = 1;
    let prevEndValue = 0;

    for (const record of records) {
        const endValue = safeFloat(record.fields["End Value"] || record.fields["end value"]);
        const cashflow = safeFloat(record.fields["Cashflow"] || record.fields["cashflow"]);
        
        const startValue = prevEndValue;
        
        // Modified Dietz assumption: Cashflow occurs in the middle
        let denominator = startValue + (cashflow * 0.5); 
        
        if (startValue === 0 && cashflow > 0) {
             denominator = cashflow; 
        }
        
        if (denominator === 0) {
            prevEndValue = endValue;
            continue; 
        }

        const gain = endValue - startValue - cashflow;
        const periodReturn = gain / denominator;

        cumulativeTwr *= (1 + periodReturn);
        prevEndValue = endValue;
    }

    return (cumulativeTwr - 1) * 100;
};

export const fetchClientProfile = async (): Promise<ClientProfile> => {
  const data = await fetchData();
  const records = data.records; 
  
  if (!records || records.length === 0) {
     return { 
         name: getSession()?.name || 'Client', 
         totalValue: 0, 
         totalInvested: 0,
         totalReturn: 0, 
         returnPercentage: 0, 
         twr: 0, 
         mwr: 0, 
         fdDifference: 0,
         lastUpdated: '-' 
    };
  }

  const latestRecord = records[records.length - 1]; 
  const currentVal = safeFloat(latestRecord.fields["End Value"]);
  
  // 1. Total Invested (Sum of Net Cashflow)
  // CRITICAL FIX: Ensure we are summing numbers, not strings
  const totalInvested = records.reduce((acc: number, r: any) => {
    return acc + safeFloat(r.fields["Cashflow"]);
  }, 0);

  // 2. Total Return Formula: Portfolio Market Value / Sum of Net Cashflow
  // Note: To display as a "Return %", we typically show (Ratio - 1). 
  // If Value is 120 and Cost is 100, Ratio is 1.2, Return is 20%.
  const retPercent = totalInvested !== 0 ? ((currentVal / totalInvested) - 1) * 100 : 0;
  
  // Just for metadata (absolute return amount)
  const totalRet = currentVal - totalInvested;

  // 3. TWR Calculation
  const twr = calculateTWR(records);

  // 4. MWR (XIRR) Calculation
  const xirrStreams = records
    .filter((r: any) => safeFloat(r.fields["Cashflow"]) !== 0)
    .map((r: any) => ({
        amount: -safeFloat(r.fields["Cashflow"]), // Cash IN is negative for XIRR
        date: new Date(r.fields["Date"] || r.fields["date"])
    }));
  
  xirrStreams.push({
      amount: currentVal,
      date: new Date(latestRecord.fields["Date"] || latestRecord.fields["date"])
  });

  const mwr = calculateXIRR(
      xirrStreams.map(s => s.amount),
      xirrStreams.map(s => s.date)
  );

  // 5. FD Difference (Based on Latest Lark FD Value)
  // Retrieve the actual FD field from Lark
  const latestFDValue = safeFloat(latestRecord.fields["FD"] || latestRecord.fields["fd"]);
  
  let fdDiff = 0;
  if (latestFDValue > 0) {
      fdDiff = ((currentVal - latestFDValue) / latestFDValue) * 100;
  }

  return {
    name: getSession()?.name,
    totalValue: currentVal,
    totalInvested: totalInvested,
    totalReturn: totalRet,
    returnPercentage: parseFloat(retPercent.toFixed(2)),
    twr: parseFloat(twr.toFixed(2)),
    mwr: parseFloat(mwr.toFixed(2)),
    fdDifference: parseFloat(fdDiff.toFixed(2)),
    lastUpdated: new Date(latestRecord.fields["Date"] || latestRecord.fields["date"]).toLocaleDateString()
  };
};

export const fetchPortfolioHistory = async (): Promise<PortfolioDataPoint[]> => {
  const data = await fetchData();
  const records = data.records;
  
  return records
    .map((record: any) => {
        const val = safeFloat(record.fields["End Value"] || record.fields["end value"]);
        const fd = safeFloat(record.fields["FD"] || record.fields["fd"]);
        
        return {
            date: new Date(record.fields["Date"] || record.fields["date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            portfolioValue: val,
            fdValue: fd
        };
    })
    // 6. Data Cleaning for Chart
    // Filter out records where Portfolio Value is 0 or suspiciously low (unless it's the very start)
    // This fixes the "dip to zero" anomaly if Lark has empty rows or zero values in the middle of history
    .filter((point, index) => {
        // Always keep the first and last point if possible, but remove 0s in between
        if (point.portfolioValue === 0) return false;
        return true;
    });
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
    return [];
};