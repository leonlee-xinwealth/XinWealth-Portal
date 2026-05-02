import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) return configError(res);

  const { fields } = req.body || {};
  if (!fields || typeof fields !== 'object') {
    return res.status(400).json({ error: 'fields is required' });
  }

  try {
    const { user, error: authErr } = await getAuthUser(req);
    if (authErr || !user) {
      return res.status(401).json({ error: `Unauthorized: ${authErr || 'Invalid token'}` });
    }

    const { data: userProfile, error: userProfileErr } = await supabaseAdmin
      .from('user_profiles')
      .select('client_id')
      .eq('id', user.id)
      .maybeSingle();

    if (userProfileErr) {
      return res.status(500).json({ error: 'Failed to resolve client id', details: userProfileErr.message });
    }

    const clientId = userProfile?.client_id;
    if (!clientId) {
      return res.status(404).json({ error: 'Client link not found for this user' });
    }

    const clean = {};
    const src = fields;

    if (src.salutation !== undefined) clean.salutation = src.salutation || null;
    if (src.email !== undefined) clean.email = src.email ? String(src.email).trim().toLowerCase() : null;
    if (src.nric !== undefined) clean.nric = src.nric || null;
    if (src.gender !== undefined) clean.gender = src.gender || null;
    if (src.maritalStatus !== undefined) clean.marital_status = src.maritalStatus || null;
    if (src.nationality !== undefined) clean.nationality = src.nationality || null;
    if (src.residency !== undefined) clean.residency = src.residency || null;
    if (src.occupation !== undefined) clean.occupation = src.occupation || null;
    if (src.contactNumber !== undefined) clean.phone = src.contactNumber || null;
    if (src.epfAccountNumber !== undefined) clean.epf_account_number = src.epfAccountNumber || null;
    if (src.ppaAccountNumber !== undefined) clean.ppa_account_number = src.ppaAccountNumber || null;
    if (src.correspondenceAddress !== undefined) clean.correspondence_address = src.correspondenceAddress || null;
    if (src.correspondencePostalCode !== undefined) clean.correspondence_postal_code = src.correspondencePostalCode || null;
    if (src.correspondenceCity !== undefined) clean.correspondence_city = src.correspondenceCity || null;
    if (src.correspondenceState !== undefined) clean.correspondence_state = src.correspondenceState || null;
    if (src.retirementAge !== undefined) clean.retirement_age = src.retirementAge === '' ? null : Number(src.retirementAge);
    if (src.taxStatus !== undefined) clean.tax_residency = src.taxStatus || null;

    const fullNameParts = [];
    if (src.givenName) fullNameParts.push(String(src.givenName).trim());
    if (src.familyName) fullNameParts.push(String(src.familyName).trim());
    if (fullNameParts.length > 0) clean.full_name = fullNameParts.join(' ').trim();
    if (src.name && !clean.full_name) clean.full_name = String(src.name).trim();

    if (src.dob !== undefined) {
      const d = new Date(src.dob);
      clean.date_of_birth = Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
    }

    if (Object.keys(clean).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(clean)
      .eq('id', clientId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Update Failed', details: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
