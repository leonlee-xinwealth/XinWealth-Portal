// api/prs-application.js
// Token-based API for client PRS form prefill (GET) and submission (POST).
// NOTE: toClientsPayload logic is duplicated from components/advisor/prs/prsSync.ts.
// Both files must be kept in sync when field mappings change.
import { supabaseAdmin } from './_lib/supabase.js';

const ADVISOR_ONLY_KEYS = [
  'consultant_name', 'consultant_code', 'consultant_nric', 'consultant_phone',
  'branch_name_code', 'distributor_code', 'channel', 'class_for_application',
  'utc_recommended_category', 'utc_basis', 'utc_basis_other', 'utc_funds', 'sign_date',
];

const GENDERS = ['male', 'female'];
const MARITAL = ['single', 'married', 'divorced', 'widowed'];
const TAX_RES = ['resident', 'non_resident'];
const RACE_LABELS = { bumiputera: 'Bumiputera', chinese: 'Chinese', indian: 'Indian' };
const SOURCE_LABELS = {
  employment: 'Employment', investment: 'Investment', retirement: 'Retirement',
  sales_of_assets: 'Sales of Assets', inheritance: 'Inheritance',
  savings: 'Savings', business: 'Business',
};

function toClientsPayload(d) {
  const p = {};
  const put = (col, v) => { if (v) p[col] = v; };
  put('salutation', d.salutation); put('full_name', d.full_name); put('nric', d.nric);
  put('date_of_birth', d.date_of_birth);
  if (GENDERS.includes(d.gender)) p.gender = d.gender;
  put('nationality', d.nationality);
  if (MARITAL.includes(d.marital_status)) p.marital_status = d.marital_status;
  if (d.race === 'others') put('race', d.race_other);
  else if (d.race && RACE_LABELS[d.race]) p.race = RACE_LABELS[d.race];
  put('phone', d.phone_mobile); put('email', d.email);
  put('correspondence_address', d.corr_address);
  put('correspondence_city', d.corr_city);
  put('correspondence_state', d.corr_state);
  put('correspondence_postal_code', d.corr_postcode);
  put('employer_name', d.employer_name);
  if (d.source_of_funds === 'others') put('source_of_funds', d.source_of_funds_other);
  else if (d.source_of_funds && SOURCE_LABELS[d.source_of_funds]) p.source_of_funds = SOURCE_LABELS[d.source_of_funds];
  if (TAX_RES.includes(d.tax_residency)) p.tax_residency = d.tax_residency;
  put('tin_number', d.tin_number);
  put('epf_account_number', d.epf_account_number);
  put('ppa_account_number', d.ppa_account_no);
  put('bank_name', d.bank_name);
  put('bank_account_number', d.bank_account_number);
  if (d.pep_status === 'yes') p.pep_status = true;
  if (d.pep_status === 'no') p.pep_status = false;
  if (d.occupation_other) put('occupation', d.occupation_other);
  const answers = [d.isa_q1_age, d.isa_q2_experience, d.isa_q3_understanding,
    d.isa_q4_objective, d.isa_q5_duration, d.isa_q6_risk];
  if (answers.every(a => a === '1' || a === '3' || a === '5')) {
    const score = answers.reduce((s, a) => s + parseInt(a, 10), 0);
    p.risk_profile = score <= 13 ? 'conservative' : score <= 22 ? 'moderate' : 'aggressive';
  }
  return p;
}

async function findValidApplication(token) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) return { error: 404 };
  const { data: app } = await supabaseAdmin
    .from('prs_applications').select('*').eq('token', token).maybeSingle();
  if (!app) return { error: 404 };
  if (app.status !== 'awaiting_client') return { error: 410 };
  if (app.token_expires_at && new Date(app.token_expires_at) < new Date()) return { error: 410 };
  return { app };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' });

  try {
    if (req.method === 'GET') {
      const { app, error } = await findValidApplication(req.query.token);
      if (error) return res.status(error).json({ error: error === 404 ? 'INVALID_TOKEN' : 'LINK_EXPIRED' });
      const formData = { ...app.form_data };
      for (const k of ADVISOR_ONLY_KEYS) delete formData[k];
      return res.status(200).json({ form_data: formData });
    }

    if (req.method === 'POST') {
      const { token, form_data: incoming } = req.body || {};
      const { app, error } = await findValidApplication(token);
      if (error) return res.status(error).json({ error: error === 404 ? 'INVALID_TOKEN' : 'LINK_EXPIRED' });
      if (!incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'form_data required' });
      if (!String(incoming.full_name || '').trim()) return res.status(400).json({ error: 'FULL_NAME_REQUIRED' });

      const cleaned = { ...incoming };
      for (const k of ADVISOR_ONLY_KEYS) delete cleaned[k];
      const merged = { ...app.form_data, ...cleaned };

      let clientId = app.client_id;
      const payload = toClientsPayload(merged);
      if (clientId) {
        if (Object.keys(payload).length > 0) {
          const { error: e } = await supabaseAdmin.from('clients').update(payload).eq('id', clientId);
          if (e) throw new Error(`Failed to update client: ${e.message}`);
        }
      } else {
        const { data: created, error: e } = await supabaseAdmin.from('clients').insert({
          advisor_id: app.advisor_id,
          status: 'prospect',
          pipeline_stage: 'interested',
          ...payload,
        }).select('id').single();
        if (e) throw new Error(`Failed to create client: ${e.message}`);
        clientId = created.id;
      }

      const { error: upErr } = await supabaseAdmin.from('prs_applications').update({
        form_data: merged,
        client_id: clientId,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        token: null,
        token_expires_at: null,
      }).eq('id', app.id);
      if (upErr) throw new Error(`Failed to submit: ${upErr.message}`);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('PRS application API error:', e);
    return res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
