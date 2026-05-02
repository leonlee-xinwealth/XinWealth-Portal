import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Missing email on auth user' });
  }

  const { data: clientRow, error: clientErr } = await supabaseAdmin
    .from('clients')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (clientErr) {
    return res.status(500).json({ error: 'Error fetching client from database', details: clientErr.message });
  }

  if (!clientRow) {
    return res.status(404).json({ error: 'Client profile not found' });
  }

  return res.status(200).json({
    success: true,
    email,
    name: clientRow.full_name || email,
    recordId: clientRow.id,
    advisor: clientRow.advisor_id || '',
    nric: clientRow.nric || '',
    dob: clientRow.date_of_birth || '',
    gender: clientRow.gender || '',
    maritalStatus: clientRow.marital_status || '',
    nationality: clientRow.nationality || '',
    residency: clientRow.residency || '',
    occupation: clientRow.occupation || '',
    retirementAge: clientRow.retirement_age || 55,
    epfAccountNumber: clientRow.epf_account_number || '',
    ppaAccountNumber: clientRow.ppa_account_number || '',
    correspondenceAddress: clientRow.correspondence_address || '',
    correspondencePostalCode: clientRow.correspondence_postal_code || '',
    correspondenceCity: clientRow.correspondence_city || '',
    correspondenceState: clientRow.correspondence_state || ''
  });
}

