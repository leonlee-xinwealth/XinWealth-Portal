import {
  PortfolioDataPoint, Transaction, ClientProfile, KYCData, FinancialHealthData, UserSession, FinancialAnalytics,
  AnalyticsItem, Portfolio, PortfolioSnapshot, PortfolioMetrics, PortfolioMonthlyPoint,
  AssetQualitySummary, PortfolioAllocationSummary, HealthSnapshot, CnaResult, ReviewStatus, CurrentPlan,
} from '../types';

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

  const response = await fetch(`/api/kyc?email=${encodeURIComponent(trimmed)}`);
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

// ── P4 Task C — quarterly review (client-submitted). Same /api/levelUp
// endpoint as submitLevelUp above (Vercel Hobby plan is at its function-count
// limit — spec docs/superpowers/specs/2026-09-27-cfp-p4-review-monitoring-design.md
// section C), distinguished by `mode: 'review'`. ──

export interface ReviewPrefillAsset { id: string; name: string; type: string; current_value: number; }
export interface ReviewPrefillLiability {
  id: string; name: string; type: string; outstanding_balance: number;
  interest_rate: number | null; monthly_payment: number | null;
}
export interface ReviewSummary {
  id: string; status: string; kind?: string; period_end: string;
  submitted_at?: string | null; approved_at?: string | null; advisor_note?: string | null;
}
export interface ReviewPrefillData {
  assets: ReviewPrefillAsset[];
  liabilities: ReviewPrefillLiability[];
  review: ReviewSummary | null;
  review_unavailable: boolean;
}

export const fetchReviewPrefill = async (): Promise<ReviewPrefillData> => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const res = await fetch('/api/levelUp?mode=review&action=prefill', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load review data');
  return data as ReviewPrefillData;
};

export interface SubmitQuarterlyReviewPayload {
  assets: Array<{ asset_id: string; value: number }>;
  liabilities: Array<{ liability_id: string; balance: number; interest_rate?: number | null; monthly_payment?: number | null }>;
  notes?: string | null;
}

/** Throws with message 'REVIEW_UNAVAILABLE' when the `reviews` table isn't
 *  deployed yet (api/levelUp.js's 503 `{error:'review_unavailable'}`) and
 *  'REVIEW_ALREADY_PENDING' when one is already awaiting approval — callers
 *  (LevelUp.tsx) match on these to show the right message. */
export const submitQuarterlyReview = async (
  payload: SubmitQuarterlyReviewPayload
): Promise<{ success: boolean; review?: ReviewSummary }> => {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Authentication error. Please login again.');

  const res = await fetch('/api/levelUp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ mode: 'review', action: 'submit_review', ...payload })
  });
  const data = await res.json();
  if (!res.ok) {
    if (data?.error === 'review_unavailable') throw new Error('REVIEW_UNAVAILABLE');
    if (data?.error === 'review_already_pending') throw new Error('REVIEW_ALREADY_PENDING');
    throw new Error(data.error || 'Failed to submit review');
  }
  return data;
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

/**
 * P3 (spec docs/superpowers/specs/2026-09-26-cfp-p3-assets-portfolio-design.md
 * 决策 3/4): api/health.js now returns two additive fields alongside the
 * existing ones — the per-asset 2×2 (`asset_quality`) and the portfolio
 * allocation vs the target model (`portfolio`). These are plain pick helpers
 * over an already-fetched fetchRawHealthData() response (no extra network
 * call) so callers (NetWorth.tsx) get typed access instead of `data.asset_quality`.
 */
export const pickAssetQuality = (data: any): AssetQualitySummary | null =>
  (data?.asset_quality as AssetQualitySummary) ?? null;

export const pickPortfolioAllocation = (data: any): PortfolioAllocationSummary | null =>
  (data?.portfolio as PortfolioAllocationSummary) ?? null;

/**
 * P2b/P4 (spec docs/superpowers/specs/2026-09-25-cfp-p2b-standing-items-design.md
 * D2, 2026-09-27-cfp-p4-review-monitoring-design.md 决策 3): api/health.js's
 * `current` field — the plan-sourced "as of today" income/expenses/surplus/
 * debt-service/EPF figures. Cashflow.tsx and Retirement.tsx read this
 * instead of summing the latest month's raw rows by hand.
 */
export const pickCurrentPlan = (data: any): CurrentPlan | null =>
  (data?.current as CurrentPlan) ?? null;

/**
 * P4 决策 6: api/health.js's `review_status` field — the client-home due/
 * 「等待顾问审核」 banner source. Degrades to "not due, not pending" rather
 * than null so a caller can render it without an extra null check.
 */
export const pickReviewStatus = (data: any): ReviewStatus =>
  (data?.review_status as ReviewStatus) ?? { last_approved_at: null, pending: false, due: false };

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

const EMPTY_REVIEW_STATUS: ReviewStatus = { last_approved_at: null, pending: false, due: false };

/**
 * P4 决策 3 / P5 决策 1 (spec docs/superpowers/specs/
 * 2026-09-27-cfp-p4-review-monitoring-design.md,
 * 2026-09-26-cfp-p5-insurance-design.md): every ratio here used to be
 * recomputed ad-hoc from the latest raw records — its own copy of the same
 * math HealthScoreCard.tsx and cfp-brain/baseline.ts each had. api/health.js
 * now computes them all once via the shared computeSnapshot()/computeCna()
 * formulas (`data.snapshot` / `data.insurance_gap`) and this function just
 * reads them, so the three call sites can never disagree again. A missing
 * `data.snapshot` (client not found) degrades every ratio/raw figure to
 * NaN/0 exactly as the old ad-hoc math did when it had no data to sum.
 */
export const fetchFinancialHealth = async (): Promise<FinancialHealthData> => {
  const data = await fetchRawHealthData();
  const snapshot: HealthSnapshot | null = data.snapshot ?? null;
  const raw_metrics = (snapshot?.raw_metrics ?? {}) as Record<string, number>;
  const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
  const ratio = (v: number | null | undefined): number => (v == null ? NaN : v);

  const annualIncome = num(raw_metrics.annual_income, num(snapshot?.monthly_income) * 12);
  const annualExpenses = num(snapshot?.monthly_expenses) * 12;
  const annualPassiveIncome = num(raw_metrics.passive_income_monthly) * 12;
  const totalSumAssured = num(raw_metrics.active_life_sum_assured);

  return {
    basicLiquidityRatio: ratio(snapshot?.basic_liquidity_ratio),
    liquidAssetToNetWorth: ratio(snapshot?.liquid_asset_to_net_worth),
    solvencyRatio: ratio(snapshot?.solvency_ratio),
    debtServiceRatio: ratio(snapshot?.debt_service_ratio),
    nonMortgageDSR: ratio(snapshot?.non_mortgage_dsr),
    lifeInsuranceCoverage: ratio(snapshot?.life_insurance_coverage),
    savingsRatio: ratio(snapshot?.savings_ratio),
    investAssetsToNetWorth: ratio(snapshot?.invest_assets_to_net_worth),
    passiveIncomeCoverage: ratio(snapshot?.passive_income_coverage),
    raw: {
      cashAndFD: num(raw_metrics.liquid_assets_total),
      monthlyExpenses: num(snapshot?.monthly_expenses),
      netWorth: num(snapshot?.net_worth),
      totalAssets: num(snapshot?.total_assets),
      totalMonthlyDebtRepayment: num(raw_metrics.monthly_debt_service),
      monthlyNetIncome: num(snapshot?.monthly_income),
      consumerDebtRepayment: num(raw_metrics.monthly_non_mortgage_service),
      // real in-force total (P5) — active life/investment_linked policies'
      // sum_assured, exactly what life_insurance_coverage's numerator is.
      totalSumAssured,
      annualIncome,
      monthlySavings: num(snapshot?.monthly_surplus),
      monthlyGrossIncome: num(snapshot?.monthly_income),
      investmentAssets: num(raw_metrics.invest_assets_total),
      annualPassiveIncome,
      annualExpenses,
      insurance: data.insurance || data.insurances || []
    },
    analytics: calculateAnalytics(data),
    snapshot,
    insuranceGap: (data.insurance_gap as CnaResult) ?? null,
    reviewStatus: (data.review_status as ReviewStatus) ?? EMPTY_REVIEW_STATUS,
    current: (data.current as CurrentPlan) ?? null,
  };
};
