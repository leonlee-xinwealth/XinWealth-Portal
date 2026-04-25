import jwt from 'jsonwebtoken';
import { supabase } from './_supabase.js';

// Maps the Lark field names (sent from Player.tsx) → profiles column names + validation rules
const FIELD_MAP = {
  'Family Name':                { col: 'family_name',               type: 'string'       },
  'Given Name':                 { col: 'given_name',                type: 'string'       },
  'NRIC':                       { col: 'nric',                      type: 'string'       },
  'Date of Birth':              { col: 'date_of_birth',             type: 'date'         },
  'Gender':                     { col: 'gender',                    type: 'gender_enum'  },
  'Marital Status':             { col: 'marital_status',            type: 'marital_enum' },
  'Nationality':                { col: 'nationality',               type: 'string'       },
  'Residency':                  { col: 'residency',                 type: 'string'       },
  'EPF Account Number':         { col: 'epf_account_number',        type: 'string'       },
  'PPA Account Number':         { col: 'ppa_account_number',        type: 'string'       },
  'Correspondence Address':     { col: 'correspondence_address',    type: 'string'       },
  'Correspondence Postal Code': { col: 'correspondence_postal_code',type: 'digits_only'  },
  'Correspondence City':        { col: 'correspondence_city',       type: 'string'       },
  'Correspondence State':       { col: 'correspondence_state',      type: 'string'       }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  let jwtPayload;
  try {
    jwtPayload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'fallback_secret_xinwealth');
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }

  const profileId = jwtPayload.recordId; // always from verified token — never trust frontend
  const { fields } = req.body;

  if (!profileId || !fields) return res.status(400).json({ error: 'Missing target record or fields' });

  const update = {};

  for (const [larkField, val] of Object.entries(fields)) {
    const def = FIELD_MAP[larkField];
    if (!def) continue; // silently ignore unknown / unauthorised fields

    let clean = String(val).trim();
    if (clean === '') { update[def.col] = null; continue; }
    if (clean.length > 500) return res.status(400).json({ error: `${larkField} exceeds maximum length.` });

    switch (def.type) {
      case 'digits_only':
        if (!/^\d+$/.test(clean)) return res.status(400).json({ error: `${larkField} must contain only numbers.` });
        break;
      case 'date': {
        const d = new Date(clean);
        if (isNaN(d.getTime())) return res.status(400).json({ error: `Invalid date format for ${larkField}.` });
        if (d > new Date())     return res.status(400).json({ error: `${larkField} cannot be in the future.`  });
        clean = d.toISOString().split('T')[0]; // store as YYYY-MM-DD
        break;
      }
      case 'gender_enum':
        clean = clean.toLowerCase();
        if (!['male','female','other'].includes(clean)) return res.status(400).json({ error: `Invalid value for ${larkField}.` });
        break;
      case 'marital_enum':
        clean = clean.toLowerCase();
        if (!['single','married','divorced','widowed'].includes(clean)) return res.status(400).json({ error: `Invalid value for ${larkField}.` });
        break;
    }

    update[def.col] = clean;
  }

  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No valid fields provided for update.' });

  // Always refresh updated_at
  update.updated_at = new Date().toISOString();

  try {
    const { error } = await supabase.from('profiles').update(update).eq('id', profileId);
    if (error) return res.status(500).json({ error: `Update failed: ${error.message}` });
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Update Client API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
