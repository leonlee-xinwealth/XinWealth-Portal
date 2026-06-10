import { PortfolioDataPoint, Transaction, ClientProfile, KYCData, FinancialHealthData, UserSession, FinancialAnalytics, AnalyticsItem, Portfolio, PortfolioSnapshot, PortfolioMetrics, PortfolioMonthlyPoint } from '../types';

import { getAccessToken, supabase } from '../lib/supabase';

const setSession = (data: any) => localStorage.setItem('xinwealth_user', JSON.stringify(data));
export const updateSession = (partialData: Partial<UserSession>) => {
  const current = getSession();
  if (current) {
    setSession({ ...current, ...partialData });
  }
};
export const getSession = (): UserSession | null => {
  const s = localStorage.getItem('xinwealth_user');
  return s ? JSON.parse(s) as UserSession : null;
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

export const authenticateUser = async (email: string, pass: string): Promise<boolean> => {
  try {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const trimmedPass = pass || '';
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPass
    });

    if (error) {
      throw new Error(error.message || 'Invalid email or password');
    }

    const accessToken = data.session?.access_token || (await getAccessToken());
    if (!accessToken) {
      throw new Error('Authentication succeeded but no access token was returned');
    }

    const meRes = await fetch('/api/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const me = await meRes.json();
    if (!meRes.ok) {
      throw new Error(me.error || 'Failed to load user profile');
    }

    setSession({
      ...me,
      token: accessToken
    });
    return true;

  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
};

const fetchData = async () => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const timestamp = new Date().getTime();
  const response = await fetch(`/api/data?_t=${timestamp}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

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


export const fetchTransactions = async (): Promise<Transaction[]> => {
  return [];
};

export const fetchPortfolios = async (): Promise<Portfolio[]> => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const res = await fetch('/api/portfolios', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const contentType = res.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('Server connection failed (Invalid Response)');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch portfolios');
  return (data.portfolios || []) as Portfolio[];
};

// ── Private helpers for portfolio metrics ──

const FD_ANNUAL_RATE = 0.03;


const _calcTWRFromSnapshots = (history: PortfolioSnapshot[]): number => {
  let cumulative = 1;
  let prevEndValue = 0;
  for (const snap of history) {
    const capitalBase = prevEndValue + snap.cashflow;
    if (capitalBase === 0) { prevEndValue = snap.end_value; continue; }
    cumulative *= (1 + (snap.end_value - capitalBase) / capitalBase);
    prevEndValue = snap.end_value;
  }
  return (cumulative - 1) * 100;
};

const _emptyMetrics = (): PortfolioMetrics => ({
  currentValue: 0, totalReturnPct: 0, cagr: 0, xirr: 0, twr: 0,
  fdCurrentValue: 0, fdDiffAbsolute: 0, fdDiffPct: 0, monthlyData: []
});

export const computePortfolioMetrics = (portfolio: Portfolio): PortfolioMetrics => {
  const history = portfolio.portfolio_history;
  if (!history.length) return _emptyMetrics();

  const capital = portfolio.capital_injection;
  const injectionDate = new Date(portfolio.injection_date);
  const latest = history[history.length - 1];
  const currentValue = latest.end_value;
  const latestDate = new Date(latest.snapshot_date);

  const sumCashflows = history.reduce((s, h) => s + h.cashflow, 0);
  if (sumCashflows === 0) {
    console.warn(`[computePortfolioMetrics] portfolio ${portfolio.id}: all cashflows are 0, falling back to capital_injection for totalReturnPct`);
  }
  const totalCashflow = sumCashflows || capital;
  const totalReturnPct = totalCashflow > 0 ? ((currentValue / totalCashflow) - 1) * 100 : 0;

  const monthsElapsed =
    (latestDate.getFullYear() - injectionDate.getFullYear()) * 12
    + (latestDate.getMonth() - injectionDate.getMonth());
  // CAGR uses exact days for annualisation; FD uses integer months (matches snapshot granularity)
  const yearsElapsed = (latestDate.getTime() - injectionDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const cagr = yearsElapsed > 0 && capital > 0
    ? (Math.pow(currentValue / capital, 1 / yearsElapsed) - 1) * 100
    : 0;

  const twr = _calcTWRFromSnapshots(history);

  // XIRR: cashflow dates use snapshot_date as proxy for injection timing.
  // Initial injection is modelled as end-of-month; slight timing offset vs injection_date is acceptable.
  const xirrStreams = history
    .filter(h => h.cashflow !== 0)
    .map(h => ({ amount: -h.cashflow, date: new Date(h.snapshot_date) }));
  xirrStreams.push({ amount: currentValue, date: latestDate });
  const xirr = calculateXIRR(
    xirrStreams.map(x => x.amount),
    xirrStreams.map(x => x.date)
  );

  const monthlyRate = FD_ANNUAL_RATE / 12;
  const monthlyData: PortfolioMonthlyPoint[] = history.map(h => {
    const snapDate = new Date(h.snapshot_date);
    const months =
      (snapDate.getFullYear() - injectionDate.getFullYear()) * 12
      + (snapDate.getMonth() - injectionDate.getMonth());
    const fdValue = parseFloat((capital * Math.pow(1 + monthlyRate, months)).toFixed(2));
    return {
      label: snapDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      portfolioValue: h.end_value,
      fdValue,
      fdDiff: parseFloat((h.end_value - fdValue).toFixed(2))
    };
  });

  const fdCurrentValue = monthlyData[monthlyData.length - 1].fdValue;
  const fdDiffAbsolute = parseFloat((currentValue - fdCurrentValue).toFixed(2));
  const fdDiffPct = fdCurrentValue > 0
    ? parseFloat(((fdDiffAbsolute / fdCurrentValue) * 100).toFixed(2))
    : 0;

  return {
    currentValue,
    totalReturnPct: parseFloat(totalReturnPct.toFixed(2)),
    cagr: parseFloat(cagr.toFixed(2)),
    xirr: parseFloat(xirr.toFixed(2)),
    twr: parseFloat(twr.toFixed(2)),
    fdCurrentValue,
    fdDiffAbsolute,
    fdDiffPct,
    monthlyData
  };
};

export const checkEmailAvailable = async (
  email: string
): Promise<{ available: boolean; reason?: string }> => {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) return { available: false, reason: 'INVALID_EMAIL' };

  const response = await fetch(`/api/check-email?email=${encodeURIComponent(trimmed)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to check email');
  }
  return data;
};

export const submitKYC = async (formData: KYCData): Promise<{ success: boolean; submissionId: string }> => {
  try {
    // Public endpoint — no auth header. Anyone with the /kyc URL can submit.
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

export const submitLevelUp = async (formData: any): Promise<{ success: boolean }> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Authentication error. Please login again.');

    const response = await fetch('/api/levelUp', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(formData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Level Up Submission failed');
    }

    return data;
  } catch (error) {
    console.error("Level Up Submission Error:", error);
    throw error;
  }
};

/**
 * Advanced Financial Analytics Engine
 * Calculates Equity, Progress, ROI, and Cumulative Cashflow
 */
export const calculateAnalytics = (data: any): FinancialAnalytics => {
  const assets = data.assets || [];
  const liabilities = data.liabilities || [];
  const snapshots = data.monthlySnapshot || [];
  
  // 1. Group snapshots by parent Net Worth item ID
  const snapByItemId: Record<string, any[]> = {};
  snapshots.forEach((s: any) => {
    if (!s || !s.fields) return;
    const parentIds = s.fields["Net Worth"];
    if (Array.isArray(parentIds)) {
      parentIds.forEach((id: any) => {
        const actualId = typeof id === 'string' ? id : (id.id || id.text);
        if (actualId) {
          if (!snapByItemId[actualId]) snapByItemId[actualId] = [];
          snapByItemId[actualId].push(s);
        }
      });
    }
  });

  // Sort each item's snapshots by date
  Object.keys(snapByItemId).forEach(id => {
    snapByItemId[id].sort((a, b) => {
      const dateA = new Date(a.fields["Date"] || a.fields["date"]).getTime();
      const dateB = new Date(b.fields["Date"] || b.fields["date"]).getTime();
      return dateA - dateB;
    });
  });

  // 2. Process each Master Item (Assets + Liabilities)
  const masterItems = [...assets, ...liabilities];
  const analyticsItems: AnalyticsItem[] = masterItems.map(item => {
    const itemSnapshots = snapByItemId[item.id] || [];
    const latestSnap = itemSnapshots[itemSnapshots.length - 1];
    
    // Initial Value from Master
    const initialValue = safeFloat(item.fields["Original Purchase Price/Principal"] || item.fields["Original Loan Amount"] || 0);
    
    // Current Value from latest Snapshot, fallback to Master Value
    const currentValue = latestSnap 
      ? safeFloat(latestSnap.fields["Current Value"] || latestSnap.fields["Value"] || 0)
      : safeFloat(item.fields["Value"] || item.fields["value"] || 0);

    // Cumulative Cashflow
    const cumulativeCashflow = itemSnapshots.reduce((acc, s) => acc + safeFloat(s.fields["Cashflow"]), 0);

    // ROI Calculation (Simplistic: V_now / V_start - 1, ignoring cashflow timing for now)
    // Monthly ROI Formula: (V_now - (V_last + Cashflow)) / (V_last + Cashflow)
    let monthlyRoi = 0;
    if (itemSnapshots.length >= 2) {
      const vNow = safeFloat(latestSnap.fields["Current Value"] || 0);
      const prevSnap = itemSnapshots[itemSnapshots.length - 2];
      const vPrev = safeFloat(prevSnap.fields["Current Value"] || 0);
      const cashflow = safeFloat(latestSnap.fields["Cashflow"] || 0);
      
      if (vPrev + cashflow !== 0) {
        monthlyRoi = (vNow - (vPrev + cashflow)) / (vPrev + cashflow);
      }
    }

    // Repayment Progress for Liabilities
    const isLiability = item.fields["Type"] === "Liability";
    let progress = 0;
    if (isLiability && initialValue > 0) {
      progress = ((initialValue - currentValue) / initialValue) * 100;
    }

    return {
      id: item.id,
      name: item.fields["Description"] || "Unknown",
      type: item.fields["Type"] || "Asset",
      category: item.fields["Category"] || "Other",
      initialValue,
      currentValue,
      progress,
      monthlyRoi: parseFloat((monthlyRoi * 100).toFixed(2)),
      cumulativeCashflow,
      history: itemSnapshots.map(s => ({
        date: s.fields["Date"] || s.fields["date"],
        value: safeFloat(s.fields["Current Value"] || s.fields["Value"] || 0),
        cashflow: safeFloat(s.fields["Cashflow"] || 0)
      }))
    };
  });

  // 3. Equity Calculation (Asset.Value - LinkedLiability.Value)
  analyticsItems.forEach(ai => {
    if (ai.type === 'Liability') {
      const masterRecord = liabilities.find((l: any) => l.id === ai.id);
      const linkedAssetIds = masterRecord?.fields["Linked Asset"];
      if (Array.isArray(linkedAssetIds) && linkedAssetIds.length > 0) {
        const assetId = typeof linkedAssetIds[0] === 'string' ? linkedAssetIds[0] : linkedAssetIds[0].id;
        const linkedAsset = analyticsItems.find(a => a.id === assetId);
        if (linkedAsset) {
          ai.equity = linkedAsset.currentValue - ai.currentValue;
        }
      }
    }
  });

  // 4. Trend Analysis
  const dates = Array.from(new Set(snapshots.filter((s: any) => s && s.fields && (s.fields["Date"] || s.fields["date"])).map((s: any) => s.fields["Date"] || s.fields["date"]))) as string[];
  dates.sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

  const netWorthTrend = dates.map(d => {
    let assetsSum = 0;
    let liabilitiesSum = 0;
    
    analyticsItems.forEach(item => {
      const hist = item.history.find((h: any) => h.date === d);
      if (hist) {
        if (item.type === 'Asset') assetsSum += hist.value;
        else liabilitiesSum += hist.value;
      }
    });

    return {
      date: d,
      assets: assetsSum,
      liabilities: liabilitiesSum,
      netWorth: assetsSum - liabilitiesSum
    };
  });

  const totalEquity = analyticsItems.reduce((acc, item) => acc + (item.equity || 0), 0);

  return {
    items: analyticsItems,
    totalEquity,
    netWorthTrend
  };
};

export const fetchRawHealthData = async (): Promise<any> => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const timestamp = new Date().getTime();
  const response = await fetch(`/api/health?_t=${timestamp}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!response.ok) {
     throw new Error("Failed to fetch health data");
  }

  return await response.json();
};

export const updateClientInfo = async (recordId: string, fields: any): Promise<{ success: boolean }> => {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) throw new Error('Authentication error. Please login again.');

    const response = await fetch('/api/updateClient', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ recordId, fields }) // We still send recordId for fallback or validation, though backend will trust token
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update client info');
    }

    return data;
  } catch (error) {
    console.error("Update Client Info Error:", error);
    throw error;
  }
};

export const getLatestRecords = (records: any[]) => {
  if (!records || records.length === 0) return [];
  // Sort by Submission Date or created time if available, otherwise by Year and Month
  const sorted = [...records].sort((a, b) => {
    // First try Year and Month
    const yearA = parseInt(a.fields["Year"] || a.fields["year"] || "0", 10);
    const yearB = parseInt(b.fields["Year"] || b.fields["year"] || "0", 10);
    if (yearA !== yearB) return yearB - yearA; // Descending
    
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const getMonthIndex = (m: string) => monthNames.indexOf(m);
    const monthA = getMonthIndex(a.fields["Month"] || a.fields["month"] || "");
    const monthB = getMonthIndex(b.fields["Month"] || b.fields["month"] || "");
    if (monthA !== monthB) return monthB - monthA;

    // Fallback to record creation time
    return b.create_time - a.create_time; 
  });

  // The first one is the latest. We want all records that share its Year and Month.
  const latestYear = sorted[0].fields["Year"] || sorted[0].fields["year"];
  const latestMonth = sorted[0].fields["Month"] || sorted[0].fields["month"];
  
  // If no month/year, just return all (for backward compatibility)
  if (!latestYear && !latestMonth) return records;

  return sorted.filter(r => 
    (r.fields["Year"] || r.fields["year"]) === latestYear && 
    (r.fields["Month"] || r.fields["month"]) === latestMonth
  );
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

  // 1. Calculate components using only the latest snapshots
  const latestAssets = getLatestRecords(data.assets || []);
  const latestInvestments = getLatestRecords(data.investments || []);
  const latestLiabilities = getLatestRecords(data.liabilities || []);
  const latestExpenses = getLatestRecords(data.expenses || []);
  const latestIncomes = getLatestRecords(data.incomes || []);

  let cashAndFD = 0;
  let totalAssets = 0;
  let investmentAssets = 0;
  
  latestAssets.forEach((item: any) => {
    const val = getValue(item, ["Value", "value", "Amount", "amount"]);
    const cat = item.fields["Category"] || "";
    totalAssets += val;
    if (cat === "Cash/Savings" || cat === "Savings" || cat === "Savings/Current Account" || cat === "Fixed Deposit" || cat === "Money Market Fund For Savings") {
      cashAndFD += val;
    }
  });

  latestInvestments.forEach((item: any) => {
    const val = getValue(item, ["Amount", "amount", "Value", "value", "End Value"]);
    totalAssets += val;
    investmentAssets += val;
  });

  let totalLiabilities = 0;
  latestLiabilities.forEach((item: any) => {
    const val = getValue(item, ["Value", "value", "Outstanding Amount", "outstanding amount", "Amount", "amount"]);
    totalLiabilities += val;
  });

  const netWorth = totalAssets - totalLiabilities;

  let monthlyExpenses = 0;
  let annualExpenses = 0;
  let totalMonthlyDebtRepayment = 0;
  let consumerDebtRepayment = 0; 

  latestExpenses.forEach((item: any) => {
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
       consumerDebtRepayment += val; 
    }
  });

  let monthlyGrossIncome = 0;
  let annualPassiveIncome = 0;

  // For dynamic annual income calculation
  let totalCurrentYearIncome = 0;
  const currentYear = new Date().getFullYear().toString();
  const recordedMonths = new Set<string>();

  data.incomes?.forEach((item: any) => {
    let val = getValue(item, ["Amount", "amount"]);
    const year = item.fields["Year"] || item.fields["year"] || "";
    const month = item.fields["Month"] || item.fields["month"] || "";

    if (year === currentYear) {
      totalCurrentYearIncome += val;
      if (month) recordedMonths.add(month);
    }
  });

  latestIncomes.forEach((item: any) => {
    let val = getValue(item, ["Amount", "amount"]);
    const cat = item.fields["Category"] || "";

    if (cat === 'Annual Bonus') {
      monthlyGrossIncome += val / 12;
    } else {
      monthlyGrossIncome += val;
    }

    if (cat === 'Rental Income' || cat === 'Dividend Income') {
      annualPassiveIncome += val * 12;
    }
  });

  const monthlyNetIncome = monthlyGrossIncome; // Approximate if tax isn't detailed
  const monthlySavings = monthlyNetIncome - monthlyExpenses;
  
  // Calculate dynamic annual income
  let annualIncome = 0;
  const monthsCount = recordedMonths.size;
  if (monthsCount > 0) {
    annualIncome = (totalCurrentYearIncome / monthsCount) * 12;
  } else {
    // Fallback to legacy calculation if no data for current year
    annualIncome = monthlyGrossIncome * 12;
  }
  
  // Total Sum Assured - hardcoded to 0 for now as no insurance table
  const totalSumAssured = 0;

  // 2. Calculate Ratios — NaN signals "no data" (denominator is zero / client hasn't filled in)
  const basicLiquidityRatio = monthlyExpenses > 0 ? cashAndFD / monthlyExpenses : NaN;
  const liquidAssetToNetWorth = netWorth > 0 ? cashAndFD / netWorth : NaN;
  const solvencyRatio = totalAssets > 0 ? netWorth / totalAssets : NaN;
  const debtServiceRatio = monthlyNetIncome > 0 ? totalMonthlyDebtRepayment / monthlyNetIncome : NaN;
  const nonMortgageDSR = monthlyNetIncome > 0 ? consumerDebtRepayment / monthlyNetIncome : NaN;
  const lifeInsuranceCoverage = annualIncome > 0 ? totalSumAssured / annualIncome : NaN;
  const savingsRatio = monthlyGrossIncome > 0 ? monthlySavings / monthlyGrossIncome : NaN;
  const investAssetsToNetWorth = netWorth > 0 ? investmentAssets / netWorth : NaN;
  const passiveIncomeCoverage = annualExpenses > 0 ? annualPassiveIncome / annualExpenses : NaN;

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
      annualExpenses,
      insurance: data.insurance || []
    },
    analytics: calculateAnalytics(data)
  };
};
