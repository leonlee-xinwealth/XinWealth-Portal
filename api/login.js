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

    const fetchProfileById = async () => {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      return { data, error };
    };

    const fetchProfileByEmail = async () => {
      if (!normalizedEmail) return { data: null, error: null };
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      return { data, error };
    };

    const fetchClientForUser = async () => {
      const { data, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
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

    const upsertProfileFromClient = async (clientRow) => {
      const advisorId = clientRow?.advisor_id || clientRow?.advisor || null;
      const dateOfBirth = clientRow?.date_of_birth ? new Date(clientRow.date_of_birth) : null;
      const isoDob = dateOfBirth && !isNaN(dateOfBirth.getTime())
        ? dateOfBirth.toISOString().slice(0, 10)
        : null;

      const profileUpsert = {
        id: user.id,
        role: 'client',
        email: (clientRow?.email || normalizedEmail || user.email || '').trim().toLowerCase() || null,
        family_name: clientRow?.family_name || null,
        given_name: clientRow?.given_name || null,
        salutation: clientRow?.salutation || null,
        nric: clientRow?.nric || null,
        date_of_birth: isoDob,
        gender: clientRow?.gender || null,
        marital_status: clientRow?.marital_status || null,
        nationality: clientRow?.nationality || null,
        residency: clientRow?.residency || null,
        employment_status: clientRow?.employment_status || null,
        tax_status: clientRow?.tax_status || null,
        occupation: clientRow?.occupation || null,
        retirement_age: clientRow?.retirement_age ?? null,
        epf_account_number: clientRow?.epf_account_number || null,
        ppa_account_number: clientRow?.ppa_account_number || null,
        correspondence_address: clientRow?.correspondence_address || null,
        correspondence_postal_code: clientRow?.correspondence_postal_code || null,
        correspondence_city: clientRow?.correspondence_city || null,
        correspondence_state: clientRow?.correspondence_state || null,
        advisor_id: advisorId
      };

      const { error } = await supabaseAdmin
        .from('profiles')
        .upsert(profileUpsert, { onConflict: 'id' });

      return { error };
    };

    const linkClientToAuthUser = async (clientRow) => {
      if (!clientRow?.id) return { error: null };
      const current = clientRow.user_id || null;
      if (current === user.id) return { error: null };
      const { error } = await supabaseAdmin
        .from('clients')
        .update({ user_id: user.id })
        .eq('id', clientRow.id);
      return { error };
    };

    let profileData = null;

    const { data: byId, error: byIdErr } = await fetchProfileById();
    if (byIdErr) {
      console.error('Profile Fetch Error (id):', byIdErr);
    } else {
      profileData = byId;
    }

    if (!profileData) {
      const { data: clientByUser, error: clientByUserErr } = await fetchClientForUser();
      if (clientByUserErr) console.error('Client Fetch Error (user_id):', clientByUserErr);

      const clientRow = clientByUser || (await fetchClientByEmail()).data;
      if (clientRow) {
        const { error: linkErr } = await linkClientToAuthUser(clientRow);
        if (linkErr) console.error('Client Link Error (user_id):', linkErr);

        const { error: upsertErr } = await upsertProfileFromClient(clientRow);
        if (upsertErr) {
          console.error('Profile Upsert Error (from client):', upsertErr);
          return res.status(500).json({ error: 'Error syncing profile from client record', details: upsertErr.message });
        }

        const { data: syncedProfile, error: syncedErr } = await fetchProfileById();
        if (syncedErr) {
          console.error('Profile Fetch Error (after sync):', syncedErr);
          return res.status(500).json({ error: 'Error fetching profile from database', details: syncedErr.message });
        }
        profileData = syncedProfile;
      }
    }

    if (!profileData) {
      const { data: emailProfile, error: emailErr } = await fetchProfileByEmail();
      if (emailErr) {
        console.error('Profile Fetch Error (email):', emailErr);
      }

      if (emailProfile) {
        profileData = emailProfile;
      } else {
        const seedEmail = normalizedEmail || user.email;
        const seedGiven = seedEmail ? String(seedEmail).split('@')[0] : 'client';

        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: user.id,
            email: seedEmail,
            given_name: seedGiven,
            role: 'client'
          })
          .select()
          .single();

        if (createError) {
          console.error('Auto-create Profile Error:', createError);
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
