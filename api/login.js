import { supabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ 
      error: 'Server Config Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables in Vercel.' 
    });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // 1. Sign in with Supabase Auth (The standard way)
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error("Supabase Auth Error:", authError);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = authData.user;
    const session = authData.session;

    const normalizedEmail = String(email || user.email || '').trim().toLowerCase();

    const fetchUserProfile = async () => {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return { data, error };
    };

    const upsertUserProfile = async (clientRow) => {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: user.id,
          role: 'client',
          client_id: clientRow.id,
          advisor_id: clientRow.advisor_id || null
        }, { onConflict: 'id' });
      return { error };
    };

    const fetchClientById = async (clientId) => {
      if (!clientId) return { data: null, error: null };
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();
      return { data, error };
    };

    const fetchClientByEmail = async () => {
      if (!normalizedEmail) return { data: null, error: null };
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      return { data, error };
    };

    const { data: userProfile, error: userProfileErr } = await fetchUserProfile();
    if (userProfileErr) {
      console.error('User Profile Fetch Error:', userProfileErr);
    }

    let clientRow = null;

    if (userProfile?.client_id) {
      const { data: byClientId, error: byClientIdErr } = await fetchClientById(userProfile.client_id);
      if (byClientIdErr) {
        console.error('Client Fetch Error (client_id):', byClientIdErr);
      } else {
        clientRow = byClientId;
      }
    }

    if (!clientRow) {
      const { data: byEmail, error: byEmailErr } = await fetchClientByEmail();
      if (byEmailErr) {
        console.error('Client Fetch Error (email):', byEmailErr);
        return res.status(500).json({ error: 'Error fetching client from database', details: byEmailErr.message });
      }
      clientRow = byEmail;
    }

    if (!clientRow) {
      return res.status(404).json({ error: 'Client profile not found' });
    }

    const { error: upsertUserProfileErr } = await upsertUserProfile(clientRow);
    if (upsertUserProfileErr) {
      console.error('User Profile Upsert Error:', upsertUserProfileErr);
      return res.status(500).json({
        error: 'Error linking auth user to client record',
        details: {
          message: upsertUserProfileErr.message,
          code: upsertUserProfileErr.code,
          hint: upsertUserProfileErr.hint,
          details: upsertUserProfileErr.details
        }
      });
    }

    const fullName = clientRow.full_name || clientRow.email || normalizedEmail || user.email;

    let currentAge = 30;
    if (clientRow.date_of_birth) {
      const birthDate = new Date(clientRow.date_of_birth);
      if (!isNaN(birthDate.getTime())) {
        currentAge = new Date().getFullYear() - birthDate.getFullYear();
      }
    }

    return res.status(200).json({
      success: true,
      token: session.access_token,
      refresh_token: session.refresh_token,
      name: fullName,
      email: (clientRow.email || normalizedEmail || user.email || '').trim().toLowerCase(),
      recordId: clientRow.id,
      currentAge,
      retirementAge: clientRow.retirement_age || 55,
      familyName: "",
      givenName: "",
      advisor: clientRow.advisor_id || "",
      occupation: clientRow.occupation || "",
      dob: clientRow.date_of_birth || "",
      nric: clientRow.nric || "",
      gender: clientRow.gender || "",
      maritalStatus: clientRow.marital_status || "",
      nationality: clientRow.nationality || "",
      residency: clientRow.residency || "",
      epfAccountNumber: clientRow.epf_account_number || "",
      ppaAccountNumber: clientRow.ppa_account_number || "",
      correspondenceAddress: clientRow.correspondence_address || "",
      correspondencePostalCode: clientRow.correspondence_postal_code || "",
      correspondenceCity: clientRow.correspondence_city || "",
      correspondenceState: clientRow.correspondence_state || ""
    });

  } catch (error) {
    console.error("Login API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}
