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

  const {
    fullName,
    icNumber,
    contactNumber,
    emailAddress,
    nationality,
    maritalStatus,
    occupation,
    employmentStatus,
    taxStatus
  } = req.body;

  const cleanFullName = String(fullName || '').trim();
  const cleanIcNumber = String(icNumber || '').trim();
  const cleanContactNumber = String(contactNumber || '').trim();
  const cleanEmailAddress = String(emailAddress || '').trim();

  if (!cleanIcNumber || !cleanFullName || !cleanContactNumber || !cleanEmailAddress) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }

  try {
    // 1. Check if client exists by email or NRIC
    const { data: existingClient, error: searchError } = await supabaseAdmin
      .from('clients')
      .select('id, nric, email')
      .or(`email.eq.${cleanEmailAddress},nric.eq.${cleanIcNumber}`);

    if (searchError) {
      throw searchError;
    }

    if (existingClient && existingClient.length > 0) {
      return res.status(409).json({ error: 'Existing Client: Already have an account with this Email or IC Number. No need to apply again.' });
    }

    // 2. Create Auth User in Supabase
    // We do not set a password here; the user will need to use "Forgot Password" or an invite link to set it.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmailAddress,
      email_confirm: true,
    });

    if (authError) {
      console.error("Supabase Auth Create Error:", authError);
      return res.status(500).json({ error: `Failed to create auth user: ${authError.message}` });
    }

    const userId = authData.user.id;

    // 3. Create record in clients table
    const { data: clientData, error: insertError } = await supabaseAdmin
      .from('clients')
      .insert({
        user_id: userId,
        full_name: cleanFullName,
        nric: cleanIcNumber,
        contact_number: cleanContactNumber,
        email: cleanEmailAddress,
        nationality: nationality || "",
        marital_status: maritalStatus || "",
        occupation: occupation || "",
        employment_status: employmentStatus || "",
        tax_status: taxStatus || ""
      })
      .select()
      .single();

    if (insertError) {
      console.error("Supabase Insert Client Error:", insertError);
      // Rollback auth user creation if client insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: `Failed to create client record: ${insertError.message}` });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Account Registration Successful', 
      recordId: clientData.id 
    });

  } catch (error) {
    console.error("Register API Logic Error:", error);
    return res.status(500).json({ error: `Internal Logic Error: ${error.message}` });
  }
}
