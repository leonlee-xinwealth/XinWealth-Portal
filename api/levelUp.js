import jwt from 'jsonwebtoken';
import { supabase } from './_supabase.js';

const parseAmount = (val) => parseFloat(String(val || 0).replace(/,/g, '')) || 0;

// Convert targetMonth (0-11 index or month name) + targetYear → "YYYY-MM-01" date string
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const toPeriodMonth = (month, year) => {
  if (!year) return null;
  let m = parseInt(month);
  if (isNaN(m)) {
    m = MONTH_NAMES.findIndex(n => n.toLowerCase() === String(month).toLowerCase());
  }
  if (m < 0 || m > 11) m = 0;
  return `${year}-${String(m + 1).padStart(2, '0')}-01`;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // JWT auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let jwtPayload;
  try {
    jwtPayload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback_secret_xinwealth');
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }

  const profileId = jwtPayload.recordId;
  const { targetMonth, targetYear, incomes, expenses, assets, liabilities } = req.body;

  if (!profileId || !targetMonth || !targetYear) return res.status(400).json({ error: 'Missing required parameters' });

  const periodMonth = toPeriodMonth(targetMonth, targetYear);

  try {
    const run = async (table, rows) => {
      if (!rows?.length) return;
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw new Error(`Insert to ${table} failed: ${error.message}`);
    };

    // Map income category → income_type enum
    const INCOME_TYPE = {
      'Salary': 'salary', 'Annual Bonus': 'bonus', 'Bonus / One-off Incentives': 'bonus',
      'Director / Advisory / Professional Fees': 'director_fee',
      'Commission / Referral Fee': 'commission',
      'Dividend from Own Company': 'dividend_company',
      'Investment Dividends / Interest': 'dividend_investment',
      'Rental Income': 'rental'
    };

    const incomeRows = (incomes || []).map(item => ({
      profile_id:   profileId,
      income_type:  INCOME_TYPE[item.category] || 'other',
      amount:       parseAmount(item.amount),
      period_month: periodMonth,
      source_note:  item.description || null
    }));

    // Expenses — map category to enum, store description in description column
    const EXP_CAT = {
      'Household':'household', 'Transportation':'transportation', 'Dependants':'dependants',
      'Personal':'personal', 'Miscellaneous':'miscellaneous', 'Other':'other'
    };
    const expenseRows = (expenses || []).map(item => ({
      profile_id:   profileId,
      category:     EXP_CAT[item.type] || EXP_CAT[item.category] || 'other',
      amount:       parseAmount(item.amount),
      period_month: periodMonth,
      description:  item.description || null
    }));

    // Assets → assets table
    const assetRows = (assets || []).map(item => ({
      profile_id:  profileId,
      kind:        'other',             // category not reliably mapped from levelUp payload
      name:        item.description || item.category || 'Asset',
      value:       parseAmount(item.amount),
      acquired_at: periodMonth
    }));

    // Liabilities → liabilities table
    const LIABILITY_KIND = {
      'Study Loan':'study_loan', 'Personal Loan':'personal_loan',
      'Renovation Loan':'renovation_loan', 'Mortgage':'mortgage',
      'Car Loan':'car_loan', 'Credit Card':'credit_card', 'Other':'other'
    };
    const liabilityRows = (liabilities || []).map(item => ({
      profile_id: profileId,
      kind:       LIABILITY_KIND[item.category] || 'other',
      name:       item.description || item.category || 'Liability',
      balance:    parseAmount(item.amount)
    }));

    await Promise.all([
      run('incomes',     incomeRows),
      run('expenses',    expenseRows),
      run('assets',      assetRows),
      run('liabilities', liabilityRows)
    ]);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Level Up Submission Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
