import { supabaseAdmin } from './_lib/supabase';

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
    // 1. Sign in with Supabase Auth
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

    // 2. Fetch client record
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (clientError || !clientData) {
      console.error("Client Fetch Error:", clientError);
      return res.status(404).json({ error: 'Client profile not found' });
    }

    // 3. Return session shape (matching frontend expectations)
    let currentAge = clientData.age || 30;
    if (!clientData.age && clientData.date_of_birth) {
      const birthYear = new Date(clientData.date_of_birth).getFullYear();
      if (!isNaN(birthYear)) {
        currentAge = new Date().getFullYear() - birthYear;
      }
    }

    // Include custom_fields in the response if any mapping is needed, 
    // though the frontend relies on the exact keys returned here.
    return res.status(200).json({
      success: true,
      token: session.access_token, // JWT token from Supabase Auth
      refresh_token: session.refresh_token,
      name: clientData.full_name,
      email: clientData.email,
      recordId: clientData.id,
      currentAge,
      retirementAge: clientData.retirement_age || 55,
      familyName: clientData.family_name || "",
      givenName: clientData.given_name || "",
      advisor: clientData.advisor || "",
      occupation: clientData.occupation || "",
      dob: clientData.date_of_birth || "",
      nric: clientData.nric || "",
      gender: clientData.gender || "",
      maritalStatus: clientData.marital_status || "",
      nationality: clientData.nationality || "",
      residency: clientData.residency || "",
      epfAccountNumber: clientData.epf_account_number || "",
      ppaAccountNumber: clientData.ppa_account_number || "",
      correspondenceAddress: clientData.correspondence_address || "",
      correspondencePostalCode: clientData.correspondence_postal_code || "",
      correspondenceCity: clientData.correspondence_city || "",
      correspondenceState: clientData.correspondence_state || ""
    });

  } catch (error) {
    console.error("Login API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}
