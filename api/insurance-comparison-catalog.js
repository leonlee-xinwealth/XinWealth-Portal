import { applyCors, configError, getAuthUser, supabaseAdmin } from './_lib/supabase.js';

const toNumberOrNull = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const minNumber = (values) => {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Math.min(...nums);
};

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return configError(res);

  const { user, error } = await getAuthUser(req);
  if (error || !user) {
    return res.status(401).json({ error: `Unauthorized: ${error || 'Invalid token'}` });
  }

  const purpose = String(req.query?.purpose || 'medical');
  if (purpose !== 'medical') {
    return res.status(400).json({ error: 'Only medical purpose is supported for now' });
  }

  const { data: insurers, error: insurersError } = await supabaseAdmin
    .from('insurers')
    .select('id,name,short_name,logo_url')
    .order('name');

  if (insurersError) return res.status(500).json({ error: insurersError.message });

  const { data: plans, error: plansError } = await supabaseAdmin
    .from('plans')
    .select('id,insurer_id,name,coverage_types,is_active')
    .contains('coverage_types', ['medical'])
    .or('is_active.is.null,is_active.eq.true')
    .order('name');

  if (plansError) return res.status(500).json({ error: plansError.message });

  const planIds = (plans || []).map((p) => p.id);

  const { data: tiers, error: tiersError } = await supabaseAdmin
    .from('plan_tiers')
    .select('id,plan_id,tier_name,room_board_daily_limit,annual_limit,lifetime_limit,sort_order')
    .in('plan_id', planIds)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (tiersError) return res.status(500).json({ error: tiersError.message });

  const { data: deductibles, error: deductiblesError } = await supabaseAdmin
    .from('plan_deductibles')
    .select('plan_id,pre_retirement_amount')
    .in('plan_id', planIds);

  if (deductiblesError) return res.status(500).json({ error: deductiblesError.message });

  const { data: features, error: featuresError } = await supabaseAdmin
    .from('plan_features')
    .select('plan_id,feature_name,feature_description,is_selling_point,sort_order')
    .in('plan_id', planIds)
    .eq('is_selling_point', true)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (featuresError) return res.status(500).json({ error: featuresError.message });

  const { data: exclusions, error: exclusionsError } = await supabaseAdmin
    .from('plan_exclusions')
    .select('plan_id,exclusion_description')
    .in('plan_id', planIds);

  if (exclusionsError) return res.status(500).json({ error: exclusionsError.message });

  const { data: planRiders, error: planRidersError } = await supabaseAdmin
    .from('plan_riders')
    .select('plan_id,rider_id,is_required,depends_on_rider_id')
    .in('plan_id', planIds);

  if (planRidersError) return res.status(500).json({ error: planRidersError.message });

  const riderIds = Array.from(new Set((planRiders || []).map((pr) => pr.rider_id)));

  const { data: riders, error: ridersError } = await supabaseAdmin
    .from('riders')
    .select('id,insurer_id,name,category,description,is_active')
    .in('id', riderIds)
    .or('is_active.is.null,is_active.eq.true')
    .order('name');

  if (ridersError) return res.status(500).json({ error: ridersError.message });

  const { data: riderClauses, error: riderClausesError } = await supabaseAdmin
    .from('rider_clauses')
    .select('rider_id,clause_type,applies_to,headline_value,effective_limit,advisor_alert,severity,show_in_comparison,sort_order')
    .in('rider_id', riderIds)
    .or('show_in_comparison.is.null,show_in_comparison.eq.true')
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (riderClausesError) return res.status(500).json({ error: riderClausesError.message });

  const tiersByPlan = new Map();
  for (const t of tiers || []) {
    const arr = tiersByPlan.get(t.plan_id) || [];
    arr.push(t);
    tiersByPlan.set(t.plan_id, arr);
  }

  const deductibleByPlan = new Map();
  for (const d of deductibles || []) {
    const planId = d.plan_id;
    const prev = deductibleByPlan.get(planId);
    const val = toNumberOrNull(d.pre_retirement_amount);
    deductibleByPlan.set(planId, minNumber([prev ?? null, val]));
  }

  const featuresByPlan = new Map();
  for (const f of features || []) {
    const arr = featuresByPlan.get(f.plan_id) || [];
    arr.push(f);
    featuresByPlan.set(f.plan_id, arr);
  }

  const exclusionsByPlan = new Map();
  for (const e of exclusions || []) {
    const arr = exclusionsByPlan.get(e.plan_id) || [];
    arr.push(e.exclusion_description);
    exclusionsByPlan.set(e.plan_id, arr);
  }

  const riderById = new Map();
  for (const r of riders || []) {
    riderById.set(r.id, r);
  }

  const clausesByRider = new Map();
  for (const c of riderClauses || []) {
    const arr = clausesByRider.get(c.rider_id) || [];
    arr.push(c);
    clausesByRider.set(c.rider_id, arr);
  }

  const planRidersByPlan = new Map();
  for (const pr of planRiders || []) {
    const arr = planRidersByPlan.get(pr.plan_id) || [];
    arr.push(pr);
    planRidersByPlan.set(pr.plan_id, arr);
  }

  const plansByInsurer = new Map();
  for (const p of plans || []) {
    const insurerId = p.insurer_id;
    const arr = plansByInsurer.get(insurerId) || [];

    const allTiers = tiersByPlan.get(p.id) || [];
    const lowestTier = allTiers.length > 0 ? allTiers[0] : null;

    const linkedRiders = planRidersByPlan.get(p.id) || [];
    const riderModels = linkedRiders
      .map((link) => {
        const r = riderById.get(link.rider_id);
        if (!r) return null;
        return {
          id: r.id,
          name: r.name,
          category: r.category,
          description: r.description,
          isRequired: Boolean(link.is_required),
          dependsOnRiderId: link.depends_on_rider_id || null,
          clauses: (clausesByRider.get(r.id) || []).map((c) => ({
            clauseType: c.clause_type,
            appliesTo: c.applies_to,
            headlineValue: c.headline_value,
            effectiveLimit: c.effective_limit,
            advisorAlert: c.advisor_alert,
            severity: c.severity
          }))
        };
      })
      .filter(Boolean);

    arr.push({
      id: p.id,
      insurerId,
      name: p.name,
      defaultTier: lowestTier
        ? {
            id: lowestTier.id,
            tierName: lowestTier.tier_name,
            annualLimit: toNumberOrNull(lowestTier.annual_limit),
            lifetimeLimit: toNumberOrNull(lowestTier.lifetime_limit),
            roomBoardDailyLimit: toNumberOrNull(lowestTier.room_board_daily_limit)
          }
        : null,
      deductible: deductibleByPlan.get(p.id) ?? null,
      features: (featuresByPlan.get(p.id) || []).map((f) => ({
        name: f.feature_name,
        description: f.feature_description
      })),
      exclusions: exclusionsByPlan.get(p.id) || [],
      riders: riderModels
    });

    plansByInsurer.set(insurerId, arr);
  }

  return res.status(200).json({
    purpose: 'medical',
    insurers: (insurers || []).map((i) => ({
      id: i.id,
      name: i.name,
      shortName: i.short_name,
      logoUrl: i.logo_url,
      plans: plansByInsurer.get(i.id) || []
    }))
  });
}

