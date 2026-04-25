import jwt from 'jsonwebtoken';
import { supabase, supabaseSignIn } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // 1. Verify credentials via Supabase Auth
    let authUser;
    try {
      const authResult = await supabaseSignIn(email.trim(), password);
      authUser = authResult.user;
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || 'Invalid email or password' });
    }

    // 2. Fetch profile + advisor name in one query
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id, given_name, family_name, salutation, email, nric,
        date_of_birth, gender, marital_status, nationality, residency,
        employment_status, tax_status, occupation, retirement_age,
        epf_account_number, ppa_account_number,
        correspondence_address, correspondence_postal_code,
        correspondence_city, correspondence_state,
        advisor_id,
        advisor:advisor_id ( given_name, family_name )
      `)
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found. Please contact your advisor.' });
    }

    // 3. Parse date of birth → formatted string + age
    let dob = '';
    let currentAge = 30;
    if (profile.date_of_birth) {
      const dobDate = new Date(profile.date_of_birth);
      if (!isNaN(dobDate.getTime())) {
        const yyyy = dobDate.getFullYear();
        const mm   = String(dobDate.getMonth() + 1).padStart(2, '0');
        const dd   = String(dobDate.getDate()).padStart(2, '0');
        dob = `${yyyy}/${mm}/${dd}`;
        currentAge = new Date().getFullYear() - yyyy;
      }
    }

    const advisorName = profile.advisor
      ? `${profile.advisor.given_name || ''} ${profile.advisor.family_name || ''}`.trim()
      : '';

    const fullName = `${profile.given_name || ''} ${profile.family_name || ''}`.trim();

    // 4. Issue our own JWT (keeps the rest of the app unchanged)
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_xinwealth';
    const authToken = jwt.sign(
      { recordId: profile.id, email: profile.email },
      jwtSecret,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token:   authToken,
      name:    fullName,
      email:   profile.email,
      recordId: profile.id,
      currentAge,
      retirementAge:            parseInt(profile.retirement_age) || 55,
      familyName:               profile.family_name               || '',
      givenName:                profile.given_name                || '',
      advisor:                  advisorName,
      occupation:               profile.occupation                || '',
      dob,
      nric:                     profile.nric                      || '',
      gender:                   profile.gender                    || '',
      maritalStatus:            profile.marital_status            || '',
      nationality:              profile.nationality               || '',
      residency:                profile.residency                 || '',
      epfAccountNumber:         profile.epf_account_number        || '',
      ppaAccountNumber:         profile.ppa_account_number        || '',
      correspondenceAddress:    profile.correspondence_address    || '',
      correspondencePostalCode: profile.correspondence_postal_code|| '',
      correspondenceCity:       profile.correspondence_city       || '',
      correspondenceState:      profile.correspondence_state      || ''
    });

  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({ error: `Internal Error: ${error.message}` });
  }
}
