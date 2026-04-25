import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { recordId, ...updates } = req.body;

  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }

  try {
    // Map frontend fields back to profile columns if necessary
    const profileUpdates = { ...updates };
    
    // If name was updated, we might need to split it back, but frontend usually sends givenName/familyName
    if (updates.givenName) profileUpdates.given_name = updates.givenName;
    if (updates.familyName) profileUpdates.family_name = updates.familyName;
    if (updates.dob) profileUpdates.date_of_birth = updates.dob;
    if (updates.advisor) profileUpdates.advisor_id = updates.advisor;

    // Remove keys that don't exist in profiles or are handled above
    const cleanUpdates = {};
    const validColumns = [
      'given_name', 'family_name', 'salutation', 'email', 'nric', 
      'date_of_birth', 'gender', 'marital_status', 'nationality', 
      'residency', 'employment_status', 'tax_status', 'occupation', 
      'retirement_age', 'epf_account_number', 'ppa_account_number', 
      'correspondence_address', 'correspondence_postal_code', 
      'correspondence_city', 'correspondence_state'
    ];

    validColumns.forEach(col => {
      if (profileUpdates[col] !== undefined) cleanUpdates[col] = profileUpdates[col];
    });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(cleanUpdates)
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
