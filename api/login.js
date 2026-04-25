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

    // 2. Fetch profile record from 'profiles' table
    let { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile Fetch Error (id):", profileError);
      return res.status(500).json({ error: 'Error fetching profile from database', details: profileError.message });
    }

    // Fallback: If not found by id, try finding by email (in case auth user was created separately)
    if (!profileData) {
      console.log(`Profile not found for id ${user.id}, attempting email fallback for ${email}`);
      const { data: emailData, error: emailError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (emailError) {
        console.error("Profile Fetch Error (email):", emailError);
      }

      if (emailData) {
        profileData = emailData;
      } else {
        // Create a minimal profile if one doesn't exist yet (Auto-onboarding)
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            given_name: user.email.split('@')[0],
            role: 'client'
          })
          .select()
          .single();
        
        if (createError) {
          console.error("Auto-create Profile Error:", createError);
          return res.status(404).json({ error: 'Profile not found and could not be auto-created.' });
        }
        profileData = newProfile;
      }
    }

    // 3. Return session shape (matching frontend expectations)
    // Map family_name + given_name to name
    const fullName = `${profileData.given_name || ''} ${profileData.family_name || ''}`.trim() || profileData.email;

    // Calculate age from date_of_birth
    let currentAge = profileData.age || 30;
    if (profileData.date_of_birth) {
      const birthDate = new Date(profileData.date_of_birth);
      if (!isNaN(birthDate.getTime())) {
        currentAge = new Date().getFullYear() - birthDate.getFullYear();
      }
    }

    return res.status(200).json({
      success: true,
      token: session.access_token,
      refresh_token: session.refresh_token,
      name: fullName,
      email: profileData.email,
      recordId: profileData.id,
      currentAge,
      retirementAge: profileData.retirement_age || 55,
      familyName: profileData.family_name || "",
      givenName: profileData.given_name || "",
      advisor: profileData.advisor_id || "", // Note: in profiles it is advisor_id
      occupation: profileData.occupation || "",
      dob: profileData.date_of_birth || "",
      nric: profileData.nric || "",
      gender: profileData.gender || "",
      maritalStatus: profileData.marital_status || "",
      nationality: profileData.nationality || "",
      residency: profileData.residency || "",
      epfAccountNumber: profileData.epf_account_number || "",
      ppaAccountNumber: profileData.ppa_account_number || "",
      correspondenceAddress: profileData.correspondence_address || "",
      correspondencePostalCode: profileData.correspondence_postal_code || "",
      correspondenceCity: profileData.correspondence_city || "",
      correspondenceState: profileData.correspondence_state || ""
    });

  } catch (error) {
    console.error("Login API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}
