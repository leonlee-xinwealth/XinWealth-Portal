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
  // Credits to standard XIRR algorithm implementations
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
// Since we have monthly snapshots, we chain periodic returns.
// Period Return = (EndVal - StartVal - Cashflow) / (StartVal + 0.5 * Cashflow)
// Note: This assumes Cashflow happens roughly in middle of month if unknown, or we handle it based on available data.
const calculateTWR = (records: any[]): number => {
    let cumulativeTwr = 1;
    let prevEndValue = 0;

    for (const record of records) {
        const endValue = record.fields["End Value"] || 0;
        const cashflow = record.fields["Cashflow"] || 0;
        
        // Start Value for this period is End Value of previous period
        const startValue = prevEndValue;

        // Simple Modified Dietz for the period
        // Denominator: Capital at risk. We assume CF happens mid-period => 0.5 weight
        // If startValue is 0 (first deposit), denominator is just cashflow (or 0.5 depending on timing convention)
        // Let's assume CF happens at START of period for the very first entry, and mid for others.
        
        let denominator = startValue + (cashflow * 0.5); // Modified Dietz assumption
        
        // Handling first deposit scenario specifically
        if (startValue === 0 && cashflow > 0) {
             denominator = cashflow; // First deposit is the basis
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

// Calculate Dynamic FD Series (3% p.a.)
// Returns map of date string -> fd value
const calculateFDSeries = (records: any[]): Map<string, number> => {
    const fdMap = new Map<string, number>();
    let currentFD = 0;
    const rate = 0.03; // 3%

    if (records.length === 0) return fdMap;

    let prevDate = new Date(records[0].fields["Date"]);

    for (const record of records) {
        const currDate = new Date(record.fields["Date"]);
        const cashflow = record.fields["Cashflow"] || 0;

        // Calculate interest accrued since last record
        const timeDiff = currDate.getTime() - prevDate.getTime();
        const daysDiff = timeDiff / (1000 * 3600 * 24);
        
        // Apply interest
        currentFD = currentFD * (1 + (rate * (daysDiff / 365)));
        
        // Add new cashflow
        currentFD += cashflow;

        fdMap.set(currDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), currentFD);
        
        prevDate = currDate;
    }
    return fdMap;
};


export const fetchClientProfile = async (): Promise<ClientProfile> => {
  const data = await fetchData();
  const records = data.records; // Assuming sorted by date from API
  
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
  const currentVal = latestRecord.fields["End Value"] || 0;
  
  const totalInvested = records.reduce((acc: number, r: any) => {
    return acc + (r.fields["Cashflow"] || 0);
  }, 0);

  // 1. Total Return (Simple ROI based on Net Cashflow)
  // Formula: (Current - Invested) / Invested
  const totalRet = currentVal - totalInvested;
  const retPercent = totalInvested > 0 ? (totalRet / totalInvested) * 100 : 0;

  // 2. TWR Calculation
  const twr = calculateTWR(records);

  // 3. MWR (XIRR) Calculation
  // Prepare streams: [ {amount: -cashflow, date}, {amount: -cashflow, date} ... {amount: +currentVal, date: now} ]
  // Note: XIRR function expects deposits as negative, current value as positive
  const xirrStreams = records
    .filter((r: any) => r.fields["Cashflow"] !== 0)
    .map((r: any) => ({
        amount: -(r.fields["Cashflow"] || 0), // Cash IN to portfolio is negative for XIRR (investment)
        date: new Date(r.fields["Date"])
    }));
  
  // Add terminal value (as if we withdrew everything today)
  xirrStreams.push({
      amount: currentVal,
      date: new Date(latestRecord.fields["Date"])
  });

  const mwr = calculateXIRR(
      xirrStreams.map(s => s.amount),
      xirrStreams.map(s => s.date)
  );

  // 4. FD Difference (vs 3%)
  // Re-run FD calc to get the final FD value
  const fdMap = calculateFDSeries(records);
  const latestDateKey = new Date(latestRecord.fields["Date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  // We might need to match exact keys, or just run the logic up to end
  // Let's simplify: run the logic one last time for the final number
  let finalFD = 0;
  let prevDate = new Date(records[0].fields["Date"]);
  records.forEach((r: any) => {
      const d = new Date(r.fields["Date"]);
      const cf = r.fields["Cashflow"] || 0;
      const days = (d.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
      finalFD = finalFD * (1 + (0.03 * (days / 365)));
      finalFD += cf;
      prevDate = d;
  });
  
  const fdDiff = finalFD > 0 ? ((currentVal - finalFD) / finalFD) * 100 : 0;

  return {
    name: getSession()?.name,
    totalValue: currentVal,
    totalInvested: totalInvested,
    totalReturn: totalRet,
    returnPercentage: parseFloat(retPercent.toFixed(2)),
    twr: parseFloat(twr.toFixed(2)),
    mwr: parseFloat(mwr.toFixed(2)),
    fdDifference: parseFloat(fdDiff.toFixed(2)),
    lastUpdated: new Date(latestRecord.fields["Date"]).toLocaleDateString()
  };
};

export const fetchPortfolioHistory = async (): Promise<PortfolioDataPoint[]> => {
  const data = await fetchData();
  const records = data.records;
  
  const fdMap = calculateFDSeries(records);

  return records.map((record: any) => {
    const dateKey = new Date(record.fields["Date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return {
        date: dateKey,
        portfolioValue: record.fields["End Value"] || 0,
        fdValue: fdMap.get(dateKey) || 0 // Use calculated FD
    };
  });
};

// Deprecated: fetchTransactions removed as per request
export const fetchTransactions = async (): Promise<Transaction[]> => {
    return [];
};