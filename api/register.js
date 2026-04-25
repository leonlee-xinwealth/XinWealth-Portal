import { supabase } from './_supabase.js';

// Maps the employment status string from the form to the Supabase enum value
const toEmploymentEnum = (val) => {
  const map = {
    'employed':      'employed',
    'self-employed': 'self_employed',
    'self_employed': 'self_employed',
    'unemployed':    'unemployed',
    'retired':       'retired',
    'student':       'student'
  };
  return map[String(val || '').toLowerCase().replace(/\s+/g, '_')] || null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    fullName, icNumber, contactNumber, emailAddress,
    nationality, maritalStatus, occupation, employmentStatus, taxStatus
  } = req.body;

  const cleanFullName      = String(fullName      || '').trim();
  const cleanIcNumber      = String(icNumber      || '').trim();
  const cleanContactNumber = String(contactNumber || '').trim();
  const cleanEmail         = String(emailAddress  || '').trim().toLowerCase();

  if (!cleanIcNumber || !cleanFullName || !cleanContactNumber || !cleanEmail) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    // Check for duplicate NRIC
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .not('nric', 'is', null);

    const duplicate = existing?.find(p => {
      return (p.nric || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() ===
             cleanIcNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    });

    if (duplicate) {
      return res.status(409).json({ error: 'Existing Client: Already have an account with this IC Number. No need to apply again.' });
    }

    // Create auth user via admin API (generates invite — advisor sets password later)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:         cleanEmail,
      email_confirm: true,          // mark email as confirmed
      user_metadata: { full_name: cleanFullName }
    });

    if (authError) {
      // If user already exists in auth, look up their profile
      if (authError.message?.includes('already registered')) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return res.status(500).json({ error: `Failed to create auth user: ${authError.message}` });
    }

    const userId = authData.user.id;

    // Parse name into given / family
    const nameParts  = cleanFullName.split(' ');
    const givenName  = nameParts[0] || cleanFullName;
    const familyName = nameParts.slice(1).join(' ') || '';

    // Create profile record
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id:                userId,
        given_name:        givenName,
        family_name:       familyName,
        email:             cleanEmail,
        nric:              cleanIcNumber  || null,
        nationality:       String(nationality    || '').trim() || null,
        marital_status:    String(maritalStatus  || '').trim().toLowerCase() || null,
        occupation:        String(occupation     || '').trim() || null,
        employment_status: toEmploymentEnum(employmentStatus),
        tax_status:        String(taxStatus || '').trim().toLowerCase().replace(/[-\s]/g, '_') || null
      });

    if (profileError) {
      console.error('Profile insert error:', profileError);
      // Cleanup auth user if profile insert fails
      await supabase.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: `Failed to create profile: ${profileError.message}` });
    }

    return res.status(200).json({
      success:   true,
      message:   'Account Registration Successful',
      recordId:  userId
    });

  } catch (error) {
    console.error('Register API Error:', error);
    return res.status(500).json({ error: `Internal Error: ${error.message}` });
  }
}
