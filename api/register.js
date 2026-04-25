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
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { email, password, fullName, nric, contactNumber, occupation } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      console.error("Auth Register Error:", authError);
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;

    // 2. Create profile in 'profiles' table
    // Split fullName into given_name and family_name
    const names = (fullName || '').split(' ');
    const given_name = names[0] || '';
    const family_name = names.slice(1).join(' ') || '';

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email: email,
        given_name,
        family_name,
        nric,
        occupation,
        role: 'client'
      })
      .select()
      .single();

    if (profileError) {
      console.error("Profile Creation Error:", profileError);
      // We don't return 400 here because the auth user is already created, 
      // but we warn them.
    }

    return res.status(200).json({
      success: true,
      message: 'Registration successful. You can now log in.',
      userId: user.id
    });

  } catch (error) {
    console.error("Register API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
