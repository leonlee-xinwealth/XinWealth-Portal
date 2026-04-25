import { supabaseAdmin } from './_lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authentication & Authorization (Verify Supabase JWT)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
    }

    const { recordId, fields } = req.body; 

    if (!fields) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // 2. Backend Validation (Sanitize and validate inputs)
    const sanitizedFields = {};
    const customFields = {};
    
    // Define allowed fields and validation rules
    const allowedFields = {
      'Family Name': { dbKey: 'family_name', type: 'string' },
      'Given Name': { dbKey: 'given_name', type: 'string' },
      'NRIC': { dbKey: 'nric', type: 'string' },
      'Date of Birth': { dbKey: 'date_of_birth', type: 'date' },
      'Age': { dbKey: 'age', type: 'number' },
      'Gender': { dbKey: 'gender', type: 'string' },
      'Marital Status': { dbKey: 'marital_status', type: 'string' },
      'Nationality': { dbKey: 'nationality', type: 'string' },
      'Residency': { dbKey: 'residency', type: 'string' },
      'EPF Account Number': { dbKey: 'epf_account_number', type: 'string' },
      'PPA Account Number': { dbKey: 'ppa_account_number', type: 'string' },
      'Correspondence Address': { dbKey: 'correspondence_address', type: 'string' },
      'Correspondence Postal Code': { dbKey: 'correspondence_postal_code', type: 'string' }, 
      'Correspondence City': { dbKey: 'correspondence_city', type: 'string' },
      'Correspondence State': { dbKey: 'correspondence_state', type: 'string' }
    };

    for (const [key, val] of Object.entries(fields)) {
      if (!allowedFields[key]) {
        // Unknown fields go to custom_fields
        customFields[key] = val;
        continue;
      }

      let cleanVal = String(val).trim();
      if (cleanVal === '') {
        sanitizedFields[allowedFields[key].dbKey] = null;
        continue;
      }

      if (allowedFields[key].type === 'number') {
        if (!/^\d+$/.test(cleanVal)) {
          return res.status(400).json({ error: `Validation Error: ${key} must contain only numbers.` });
        }
        sanitizedFields[allowedFields[key].dbKey] = parseInt(cleanVal, 10);
      } else if (allowedFields[key].type === 'date') {
        const dateObj = new Date(cleanVal);
        if (isNaN(dateObj.getTime())) {
          return res.status(400).json({ error: `Validation Error: Invalid date format for ${key}.` });
        }
        if (dateObj > new Date()) {
          return res.status(400).json({ error: `Validation Error: ${key} cannot be in the future.` });
        }
        sanitizedFields[allowedFields[key].dbKey] = dateObj.toISOString().split('T')[0];
      } else {
        if (cleanVal.length > 500) {
          return res.status(400).json({ error: `Validation Error: ${key} exceeds maximum length.` });
        }
        sanitizedFields[allowedFields[key].dbKey] = cleanVal;
      }
    }

    // Auto-calculate Age in backend to enforce consistency
    if (sanitizedFields['date_of_birth']) {
      const dob = new Date(sanitizedFields['date_of_birth']);
      if (!isNaN(dob.getTime())) {
        const ageDiffMs = Date.now() - dob.getTime();
        const ageDate = new Date(ageDiffMs);
        const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
        sanitizedFields['age'] = calculatedAge;
      }
    }

    if (Object.keys(customFields).length > 0) {
      // Merge existing custom_fields
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('custom_fields')
        .eq('user_id', user.id)
        .single();
        
      sanitizedFields['custom_fields'] = {
        ...(existingClient?.custom_fields || {}),
        ...customFields
      };
    }

    if (Object.keys(sanitizedFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    // 4. Update Record
    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update(sanitizedFields)
      .eq('user_id', user.id);
    
    if (updateError) {
      return res.status(500).json({ error: `Update Failed: ${updateError.message}` });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Update Client API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
