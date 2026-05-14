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

const parseDeductibleUnit = (notes) => {
  const s = String(notes || '').toLowerCase();
  if (!s) return null;
  if (s.includes('case') || s.includes('per case') || s.includes('每次')) return 'case';
  if (s.includes('year') || s.includes('yr') || s.includes('per year') || s.includes('每年')) return 'yr';
  return null;
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
    .select('plan_id,pre_retirement_amount,notes,sort_order')
    .in('plan_id', planIds);

  if (deductiblesError) return res.status(500).json({ error: deductiblesError.message });

  const { data: features, error: featuresError } = await supabaseAdmin
    .from('plan_features')
    .select('plan_id,feature_name,feature_description,is_selling_point,sort_order')
    .in('plan_id', planIds)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (featuresError) return res.status(500).json({ error: featuresError.message });

  const { data: coverage, error: coverageError } = await supabaseAdmin
    .from('plan_coverage')
    .select(
      [
        'plan_id',
        'plan_tier_id',
        'icu_limit',
        'icu_max_days',
        'room_board_max_days',
        'pre_hospitalization_days',
        'post_hospitalization_days',
        'outpatient_details',
        'emergency_details',
        'panel_hospital_notes',
        'overseas_coverage_details',
        'no_claim_benefit',
        'pricing_details'
      ].join(',')
    )
    .in('plan_id', planIds);

  if (coverageError) return res.status(500).json({ error: coverageError.message });

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

  const { data: riderTiers, error: riderTiersError } = await supabaseAdmin
    .from('rider_tiers')
    .select('id,rider_id,tier_name,annual_limit,lifetime_limit,room_board_daily,deductible_min,deductible_unit,sort_order')
    .in('rider_id', riderIds)
    .order('sort_order', { ascending: true, nullsFirst: false });

  if (riderTiersError) return res.status(500).json({ error: riderTiersError.message });

  const riderTiersByRider = new Map();
  for (const rt of riderTiers || []) {
    const arr = riderTiersByRider.get(rt.rider_id) || [];
    arr.push(rt);
    riderTiersByRider.set(rt.rider_id, arr);
  }

  const riderTierIds = Array.from(new Set((riderTiers || []).map((rt) => rt.id)));

  const { data: riderTierBenefits, error: riderTierBenefitsError } = await supabaseAdmin
    .from('rider_tier_benefits')
    .select('rider_tier_id,benefit_id,value_type,value_amount,value_unit,display_text,notes,sort_order')
    .in('rider_tier_id', riderTierIds);

  if (riderTierBenefitsError) return res.status(500).json({ error: riderTierBenefitsError.message });

  const benefitIds = Array.from(new Set((riderTierBenefits || []).map((b) => b.benefit_id)));

  const { data: benefitCatalog, error: benefitCatalogError } = await supabaseAdmin
    .from('benefit_catalog')
    .select('id,section,canonical_name,sort_order')
    .in('id', benefitIds);

  if (benefitCatalogError) return res.status(500).json({ error: benefitCatalogError.message });

  const benefitById = new Map();
  for (const b of benefitCatalog || []) benefitById.set(b.id, b);

  const formatBenefitValue = (b) => {
    if (b?.display_text) return b.display_text;
    const type = String(b?.value_type || '').toLowerCase();
    if (type === 'not_covered') return '—';
    if (type === 'as_charged') return 'As charged';
    const amt = toNumberOrNull(b?.value_amount);
    if (amt === null) return '—';
    const unit = b?.value_unit ? ` ${b.value_unit}` : '';
    return `${amt}${unit}`;
  };

  const benefitsByRiderTierId = new Map();
  for (const b of riderTierBenefits || []) {
    const meta = benefitById.get(b.benefit_id);
    const canonical = meta?.canonical_name;
    if (!canonical) continue;
    const cur = benefitsByRiderTierId.get(b.rider_tier_id) || {};
    cur[canonical] = formatBenefitValue(b);
    benefitsByRiderTierId.set(b.rider_tier_id, cur);
  }

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
    const nextAmount = minNumber([prev?.amount ?? null, val]);
    const unit = parseDeductibleUnit(d.notes);
    const notes = d.notes || null;
    deductibleByPlan.set(planId, { amount: nextAmount, unit, notes });
  }

  const featuresByPlan = new Map();
  for (const f of features || []) {
    const arr = featuresByPlan.get(f.plan_id) || [];
    arr.push(f);
    featuresByPlan.set(f.plan_id, arr);
  }

  const coverageByPlan = new Map();
  for (const c of coverage || []) {
    const byTier = coverageByPlan.get(c.plan_id) || new Map();
    const key = c.plan_tier_id || '__plan__';
    byTier.set(key, c);
    coverageByPlan.set(c.plan_id, byTier);
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

    const linkedRiders = planRidersByPlan.get(p.id) || [];
    const planTierNames = new Set((tiersByPlan.get(p.id) || []).map((t) => t.tier_name));

    let benefitRiderId = null;
    let bestMatchCount = 0;
    for (const link of linkedRiders) {
      const rts = riderTiersByRider.get(link.rider_id) || [];
      if (rts.length === 0) continue;
      const cnt = rts.reduce((acc, rt) => (planTierNames.has(rt.tier_name) ? acc + 1 : acc), 0);
      if (cnt > bestMatchCount) {
        bestMatchCount = cnt;
        benefitRiderId = link.rider_id;
      }
    }

    const benefitRiderTiers = benefitRiderId ? riderTiersByRider.get(benefitRiderId) || [] : [];
    const riderTierIdByName = new Map(benefitRiderTiers.map((rt) => [rt.tier_name, rt.id]));

    const allTiers = tiersByPlan.get(p.id) || [];
    const byTierCoverage = coverageByPlan.get(p.id) || new Map();
    const planLevelCoverage = byTierCoverage.get('__plan__') || null;
    const anyCoverage = planLevelCoverage || (byTierCoverage.size > 0 ? Array.from(byTierCoverage.values())[0] : null);
    let tiersModel = allTiers.map((tier) => {
      const tierCov = byTierCoverage.get(tier.id) || null;
      const c = tierCov || anyCoverage;
      const ridTierId = riderTierIdByName.get(tier.tier_name) || null;
      const benefits = ridTierId ? benefitsByRiderTierId.get(ridTierId) || null : null;
      return {
        id: tier.id,
        tierName: tier.tier_name,
        annualLimit: toNumberOrNull(tier.annual_limit),
        lifetimeLimit: toNumberOrNull(tier.lifetime_limit),
        roomBoardDailyLimit: toNumberOrNull(tier.room_board_daily_limit),
        sortOrder: tier.sort_order ?? null,
        benefits,
        coverage: c
          ? {
              preHospitalizationDays: c.pre_hospitalization_days ?? null,
              postHospitalizationDays: c.post_hospitalization_days ?? null,
              icuMaxDays: c.icu_max_days ?? null,
              icuLimit: c.icu_limit ?? null,
              roomBoardMaxDays: c.room_board_max_days ?? null,
              outpatientDetails: c.outpatient_details ?? null,
              emergencyDetails: c.emergency_details ?? null,
              panelHospitalNotes: c.panel_hospital_notes ?? null,
              overseasCoverageDetails: c.overseas_coverage_details ?? null,
              noClaimBenefit: c.no_claim_benefit ?? null,
              pricingDetails: c.pricing_details ?? null
            }
          : null
      };
    });
    if (tiersModel.length === 0 && planLevelCoverage) {
      tiersModel = [
        {
          id: `${p.id}__base`,
          tierName: 'Standard',
          annualLimit: undefined,
          lifetimeLimit: undefined,
          roomBoardDailyLimit: undefined,
          sortOrder: null,
          benefits: null,
          coverage: {
            preHospitalizationDays: planLevelCoverage.pre_hospitalization_days ?? null,
            postHospitalizationDays: planLevelCoverage.post_hospitalization_days ?? null,
            icuMaxDays: planLevelCoverage.icu_max_days ?? null,
            icuLimit: planLevelCoverage.icu_limit ?? null,
            roomBoardMaxDays: planLevelCoverage.room_board_max_days ?? null,
            outpatientDetails: planLevelCoverage.outpatient_details ?? null,
            emergencyDetails: planLevelCoverage.emergency_details ?? null,
            panelHospitalNotes: planLevelCoverage.panel_hospital_notes ?? null,
            overseasCoverageDetails: planLevelCoverage.overseas_coverage_details ?? null,
            noClaimBenefit: planLevelCoverage.no_claim_benefit ?? null,
            pricingDetails: planLevelCoverage.pricing_details ?? null
          }
        }
      ];
    }
    const defaultTier = tiersModel.length > 0 ? tiersModel[0] : null;
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

    const deductibleModel = deductibleByPlan.get(p.id) || { amount: null, unit: null, notes: null };
    const featureModels = (featuresByPlan.get(p.id) || []).map((f) => ({
      name: f.feature_name,
      description: f.feature_description,
      isSellingPoint: Boolean(f.is_selling_point),
      sortOrder: f.sort_order ?? null
    }));
    const exclusionModels = exclusionsByPlan.get(p.id) || [];

    const isPlanEmpty =
      tiersModel.length === 0 &&
      !defaultTier &&
      !anyCoverage &&
      !deductibleModel.amount &&
      featureModels.length === 0 &&
      exclusionModels.length === 0 &&
      riderModels.length === 0;
    if (isPlanEmpty) {
      plansByInsurer.set(insurerId, arr);
      continue;
    }

    arr.push({
      id: p.id,
      insurerId,
      name: p.name,
      tiers: tiersModel,
      defaultTier,
      deductible: deductibleModel,
      features: featureModels,
      exclusions: exclusionModels,
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

