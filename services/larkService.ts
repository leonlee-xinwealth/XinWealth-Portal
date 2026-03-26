import { PortfolioDataPoint, Transaction, ClientProfile, KYCData, FinancialHealthData } from '../types';

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
// Updated to handle "RM" prefix and commas
const safeFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // Remove "RM", commas, spaces, and other non-numeric chars (except dot and minus)
    const clean = val.replace(/RM/g, '').replace(/,/g, '').trim();
    return parseFloat(clean) || 0;
  }
  return 0;
};

// --- DATA CLEANING HELPER ---
// Groups records by Month-Year (YYYY-MM) and keeps only the LATEST record for that month.
// This fixes the chart duplication issue and prevents double-counting cashflows in math formulas.
const deduplicateByMonth = (records: any[]) => {
  const map = new Map<string, any>();

  records.forEach(record => {
    const d = new Date(record.fields["Date"] || record.fields["date"]);
    if (isNaN(d.getTime())) return;

    // Key format: 2025-08
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;

    // Since records are sorted by date from API, setting it repeatedly 
    // ensures the Map holds the *last* (latest) record for that month.
    map.set(key, record);
  });

  // Convert map values back to array
  return Array.from(map.values());
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
  if (!user || (!user.name && !user.email)) throw new Error("No user session found. Please sign out and sign in again.");

  // ADDED TIMESTAMP TO PREVENT CACHING
  const queryName = user.name || user.email;
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/data?name=${encodeURIComponent(queryName)}&_t=${timestamp}`);

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

  if (values.length !== dates.length || values.length === 0) return 0;

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

// Calculate TWR
// Formula per period: (End - (Start + CF)) / (Start + CF)
const calculateTWR = (records: any[]): number => {
  let cumulativeTwr = 1;
  let prevEndValue = 0; // Represents "Start Value" of current period

  for (const record of records) {
    const endValue = safeFloat(record.fields["End Value"] || record.fields["end value"]);
    const cashflow = safeFloat(record.fields["Cashflow"] || record.fields["cashflow"]);

    // Denominator (Capital Base) = Start Value + Cashflow
    const capitalBase = prevEndValue + cashflow;

    if (capitalBase === 0) {
      // Handle edge case (e.g. first month no money yet? or full withdrawal)
      prevEndValue = endValue;
      continue;
    }

    // Gain = End - CapitalBase
    // Return = Gain / CapitalBase
    const gain = endValue - capitalBase;
    const periodReturn = gain / capitalBase;

    cumulativeTwr *= (1 + periodReturn);

    // The End Value of this month becomes the Start Value of next month
    prevEndValue = endValue;
  }

  return (cumulativeTwr - 1) * 100;
};

export const fetchClientProfile = async (): Promise<ClientProfile> => {
  const data = await fetchData();
  let rawRecords = data.records;

  if (!rawRecords || rawRecords.length === 0) {
    return {
      name: getSession()?.name || 'Client',
      totalValue: 0,
      totalInvested: 0,
      totalReturn: 0,
      returnPercentage: 0,
      twr: 0,
      mwr: 0,
      fdDifference: 0,
      fdDifferenceValue: 0,
      lastUpdated: '-'
    };
  }

  // CRITICAL STEP: CLEAN DATA
  // Use unique monthly records for calculations to avoid double counting
  const cleanRecords = deduplicateByMonth(rawRecords);

  const latestRecord = cleanRecords[cleanRecords.length - 1];
  const currentVal = safeFloat(latestRecord.fields["End Value"]);

  // 1. Total Invested (Sum of Net Cashflow)
  // Use cleanRecords to avoid double counting if API returns duplicates
  const totalInvested = cleanRecords.reduce((acc: number, r: any) => {
    return acc + safeFloat(r.fields["Cashflow"]);
  }, 0);

  // 2. Total Return Formula: (Portfolio Market Value / Sum of Net Cashflow) - 1
  const retPercent = totalInvested !== 0 ? ((currentVal / totalInvested) - 1) * 100 : 0;
  const totalRet = currentVal - totalInvested;

  // 3. TWR Calculation
  const twr = calculateTWR(cleanRecords);

  // 4. MWR (XIRR) Calculation
  const xirrStreams = cleanRecords
    .filter((r: any) => safeFloat(r.fields["Cashflow"]) !== 0)
    .map((r: any) => ({
      amount: -safeFloat(r.fields["Cashflow"]), // Cash IN is negative for XIRR
      date: new Date(r.fields["Date"] || r.fields["date"])
    }));

  // Add terminal value
  xirrStreams.push({
    amount: currentVal,
    date: new Date(latestRecord.fields["Date"] || latestRecord.fields["date"])
  });

  const mwr = calculateXIRR(
    xirrStreams.map(s => s.amount),
    xirrStreams.map(s => s.date)
  );

  // 5. FD Difference (Based on Latest Lark FD Value)
  const latestFDValue = safeFloat(latestRecord.fields["FD"] || latestRecord.fields["fd"]);

  let fdDiff = 0;
  let fdDiffValue = 0;
  if (latestFDValue > 0) {
    fdDiff = ((currentVal - latestFDValue) / latestFDValue) * 100;
    fdDiffValue = currentVal - latestFDValue;
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
    fdDifferenceValue: fdDiffValue,
    lastUpdated: new Date(latestRecord.fields["Date"] || latestRecord.fields["date"]).toLocaleDateString()
  };
};

export const fetchPortfolioHistory = async (): Promise<PortfolioDataPoint[]> => {
  const data = await fetchData();
  const rawRecords = data.records;

  // Clean duplicates so the chart doesn't show "Aug 25" twice
  const cleanRecords = deduplicateByMonth(rawRecords);

  return cleanRecords
    .map((record: any) => {
      const val = safeFloat(record.fields["End Value"] || record.fields["end value"]);
      const fd = safeFloat(record.fields["FD"] || record.fields["fd"]);

      return {
        date: new Date(record.fields["Date"] || record.fields["date"]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        portfolioValue: val,
        fdValue: fd
      };
    })
    .filter((point) => {
      // Keep point if value is valid, or if it's explicitly 0 but has a valid date
      return !isNaN(point.portfolioValue);
    });
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  return [];
};

export const submitKYC = async (formData: KYCData): Promise<{ success: boolean; submissionId: string }> => {
  try {
    const response = await fetch('/api/kyc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'KYC Submission failed');
    }

    return data;
  } catch (error) {
    console.error("KYC Submission Error:", error);
    throw error;
  }
};

export const fetchRawHealthData = async (): Promise<any> => {
  const user = getSession();
  if (!user || (!user.name && !user.email)) throw new Error("No user session found. Please sign out and sign in again.");

  const queryName = user.name || user.email;
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/health?name=${encodeURIComponent(queryName)}&_t=${timestamp}`);
  
  if (!response.ok) {
     throw new Error("Failed to fetch health data");
  }

  return await response.json();
};

export const fetchFinancialHealth = async (): Promise<FinancialHealthData> => {
  const data = await fetchRawHealthData();

  // Helper to extract value safely
  const getValue = (item: any, fieldNames: string[]): number => {
    for (const field of fieldNames) {
      if (item.fields[field] !== undefined) {
         return safeFloat(item.fields[field]);
      }
    }
    return 0;
  };

  // 1. Calculate components
  let cashAndFD = 0;
  let totalAssets = 0;
  let investmentAssets = 0;
  
  (data.assets || []).forEach((item: any) => {
    const val = getValue(item, ["Value", "value", "Amount", "amount"]);
    const cat = item.fields["Category"] || "";
    totalAssets += val;
    if (cat === "Cash/Savings" || cat === "Savings" || cat === "Savings/Current Account" || cat === "Fixed Deposit" || cat === "Money Market Fund For Savings") {
      cashAndFD += val;
    }
  });

  (data.investments || []).forEach((item: any) => {
    const val = getValue(item, ["Amount", "amount", "Value", "value", "End Value"]);
    totalAssets += val;
    investmentAssets += val;
  });

  let totalLiabilities = 0;
  (data.liabilities || []).forEach((item: any) => {
    const val = getValue(item, ["Outstanding Amount", "outstanding amount", "Amount", "amount"]);
    totalLiabilities += val;
  });

  const netWorth = totalAssets - totalLiabilities;

  let monthlyExpenses = 0;
  let annualExpenses = 0;
  let totalMonthlyDebtRepayment = 0;
  let consumerDebtRepayment = 0; // assuming non-mortgage loans

  (data.expenses || []).forEach((item: any) => {
    let val = getValue(item, ["Amount", "amount"]);
    const type = item.fields["Type"] || "";

    // Convert yearly to monthly if applicable
    if (type === 'Vacation/ Travel' || type === 'Income Tax Expense') {
       annualExpenses += val;
       val = val / 12;
    } else {
       annualExpenses += val * 12;
    }
    monthlyExpenses += val;

    if (type === 'Loan Repayment' || type.includes('Loan')) {
       totalMonthlyDebtRepayment += val;
       // Try to guess if consumer debt. In expenses we only have 'Loan Repayment' usually.
       // Let's assume all loan repayments in expenses are consumer unless specified as mortgage.
       // A simplistic approach:
       consumerDebtRepayment += val; 
    }
  });

  let monthlyGrossIncome = 0;
  let annualPassiveIncome = 0;

  (data.incomes || []).forEach((item: any) => {
    let val = getValue(item, ["Amount", "amount"]);
    const cat = item.fields["Category"] || "";

    if (cat === 'Annual Bonus') {
      monthlyGrossIncome += val / 12;
    } else {
      monthlyGrossIncome += val;
    }

    if (cat === 'Rental Income' || cat === 'Dividend Income') {
      // Assuming entered as monthly or yearly?
      // KYC form allows month/year but it's just amount. Let's assume amount is monthly unless it's a known annual thing.
      // Usually rental is monthly, dividend can be annual. We will just multiply by 12 for simplicity.
      annualPassiveIncome += val * 12;
    }
  });

  const monthlyNetIncome = monthlyGrossIncome; // Approximate if tax isn't detailed
  const monthlySavings = monthlyNetIncome - monthlyExpenses;
  const annualIncome = monthlyGrossIncome * 12;
  
  // Total Sum Assured - hardcoded to 0 for now as no insurance table
  const totalSumAssured = 0;

  // 2. Calculate Ratios
  const basicLiquidityRatio = monthlyExpenses > 0 ? cashAndFD / monthlyExpenses : 0;
  const liquidAssetToNetWorth = netWorth > 0 ? cashAndFD / netWorth : 0;
  const solvencyRatio = totalAssets > 0 ? netWorth / totalAssets : 0;
  const debtServiceRatio = monthlyNetIncome > 0 ? totalMonthlyDebtRepayment / monthlyNetIncome : 0;
  const nonMortgageDSR = monthlyNetIncome > 0 ? consumerDebtRepayment / monthlyNetIncome : 0;
  const lifeInsuranceCoverage = annualIncome > 0 ? totalSumAssured / annualIncome : 0;
  const savingsRatio = monthlyGrossIncome > 0 ? monthlySavings / monthlyGrossIncome : 0;
  const investAssetsToNetWorth = netWorth > 0 ? investmentAssets / netWorth : 0;
  const passiveIncomeCoverage = annualExpenses > 0 ? annualPassiveIncome / annualExpenses : 0;

  return {
    basicLiquidityRatio,
    liquidAssetToNetWorth,
    solvencyRatio,
    debtServiceRatio,
    nonMortgageDSR,
    lifeInsuranceCoverage,
    savingsRatio,
    investAssetsToNetWorth,
    passiveIncomeCoverage,
    raw: {
      cashAndFD,
      monthlyExpenses,
      netWorth,
      totalAssets,
      totalMonthlyDebtRepayment,
      monthlyNetIncome,
      consumerDebtRepayment,
      totalSumAssured,
      annualIncome,
      monthlySavings,
      monthlyGrossIncome,
      investmentAssets,
      annualPassiveIncome,
      annualExpenses
    }
  };
};