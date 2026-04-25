import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;

// Service-role client — used for all DB queries (bypasses RLS safely on the server)
export const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Helper: look up a profile by the "name" param (either email or "Given Family" full name)
export const findProfileByName = async (name) => {
  const cleanName = String(name).trim();
  const isEmail   = cleanName.includes('@');

  if (isEmail) {
    const { data } = await supabase
      .from('profiles')
      .select('id, given_name, family_name, email')
      .eq('email', cleanName.toLowerCase())
      .maybeSingle();
    return data;
  }

  // Try "Given Family" and "Family Given" combinations
  const { data } = await supabase
    .from('profiles')
    .select('id, given_name, family_name, email');

  return data?.find(p => {
    const gf = `${p.given_name || ''} ${p.family_name || ''}`.trim();
    const fg = `${p.family_name || ''} ${p.given_name || ''}`.trim();
    return gf === cleanName || fg === cleanName;
  }) ?? null;
};

// Helper: sign in via Supabase Auth REST (returns { user, session } or throws)
export const supabaseSignIn = async (email, password) => {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body:    JSON.stringify({ email, password })
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.msg || 'Authentication failed');
  return json; // { access_token, user: { id, email }, ... }
};

// Helper: convert period_month date (YYYY-MM-DD) → { monthName, year }
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
export const parsePeriod = (dateStr) => {
  if (!dateStr) return { monthName: null, year: null };
  const d = new Date(dateStr);
  return {
    monthName: MONTH_NAMES[d.getUTCMonth()],
    year:      String(d.getUTCFullYear())
  };
};
