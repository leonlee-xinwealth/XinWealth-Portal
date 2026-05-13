import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Building2,
  HeartPulse,
  Wallet,
  Target,
  Leaf,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { getAccessToken } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';

type Clause = {
  clauseType: string;
  appliesTo: string | null;
  headlineValue: string | null;
  effectiveLimit: string | null;
  advisorAlert: string;
  severity: string;
};

type Rider = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isRequired: boolean;
  dependsOnRiderId: string | null;
  clauses: Clause[];
};

type TierCoverage = {
  preHospitalizationDays: number | null;
  postHospitalizationDays: number | null;
  icuMaxDays: number | null;
  icuLimit: string | null;
  roomBoardMaxDays: number | null;
  outpatientDetails: string | null;
  emergencyDetails: string | null;
  panelHospitalNotes: string | null;
  overseasCoverageDetails: string | null;
  noClaimBenefit: string | null;
  pricingDetails: string | null;
};

type Tier = {
  id: string;
  tierName: string;
  annualLimit: number | null;
  lifetimeLimit: number | null;
  roomBoardDailyLimit: number | null;
  sortOrder: number | null;
  coverage: TierCoverage | null;
};

type PlanFeature = {
  name: string;
  description: string | null;
  isSellingPoint: boolean;
  sortOrder: number | null;
};

type Deductible = {
  amount: number | null;
  unit: string | null;
  notes: string | null;
};

type Plan = {
  id: string;
  insurerId: string;
  name: string;
  tiers: Tier[];
  defaultTier: Tier | null;
  deductible: Deductible;
  features: PlanFeature[];
  exclusions: string[];
  riders: Rider[];
};

type Insurer = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  plans: Plan[];
};

type CatalogResponse = {
  purpose: 'medical';
  insurers: Insurer[];
};

type SelectedComparison = {
  insurer: Insurer;
  plan: Plan;
  tier: Tier | null;
  riders: Rider[];
};

type ReviewCol = {
  insurerId: string;
  shortName: string;
  planName: string;
  tier: Tier | null;
  deductible: Deductible;
  plan: Plan;
};

const MIN_INSURERS = 3;

const InsuranceComparison: React.FC = () => {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const insurerLabel = (insurer: Insurer) => insurer.shortName || insurer.name;

  const displayPlanName = (planName: string, insurer: Insurer) => {
    const sn = (insurer.shortName || '').toLowerCase();
    const shouldTrimPlus = sn === 'hla' || sn === 'prudential' || sn === 'pru';
    if (!shouldTrimPlus) return planName;
    const idx = planName.indexOf('+');
    if (idx === -1) return planName;
    return planName.slice(0, idx).trim();
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  const [selectedInsurerIds, setSelectedInsurerIds] = useState<string[]>([]);
  const [selectedPlanIdsByInsurer, setSelectedPlanIdsByInsurer] = useState<Record<string, string>>({});
  const [selectedTierIdsByInsurer, setSelectedTierIdsByInsurer] = useState<Record<string, string>>({});
  const [selectedRidersByInsurer, setSelectedRidersByInsurer] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError('');

    (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (isMounted) setLoadError(t('Missing session. Please re-login.', '缺少登录状态，请重新登录。'));
        return;
      }
      const res = await fetch('/api/insurance-comparison-catalog?purpose=medical', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!res.ok) {
        const txt = await res.text();
        if (isMounted) setLoadError(txt || 'Failed to load catalog');
        return;
      }
      const data = (await res.json()) as CatalogResponse;
      if (isMounted) setCatalog(data);
    })()
      .catch((e) => {
        if (isMounted) setLoadError(String(e?.message || e));
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [language]);

  const insurers = useMemo(() => catalog?.insurers || [], [catalog]);

  const selectedInsurers = useMemo(() => {
    const map = new Map(insurers.map((i) => [i.id, i]));
    return selectedInsurerIds.map((id) => map.get(id)).filter((x): x is Insurer => Boolean(x));
  }, [insurers, selectedInsurerIds]);

  const toggleInsurer = (insurerId: string) => {
    setSelectedInsurerIds((prev) => {
      if (prev.includes(insurerId)) {
        const next = prev.filter((id) => id !== insurerId);
        setSelectedPlanIdsByInsurer((p) => {
          const { [insurerId]: _, ...rest } = p;
          return rest;
        });
        setSelectedTierIdsByInsurer((p) => {
          const { [insurerId]: _, ...rest } = p;
          return rest;
        });
        setSelectedRidersByInsurer((p) => {
          const { [insurerId]: _, ...rest } = p;
          return rest;
        });
        return next;
      }
      return [...prev, insurerId];
    });
  };

  const onPickPlan = (insurerId: string, planId: string) => {
    setSelectedPlanIdsByInsurer((prev) => ({ ...prev, [insurerId]: planId }));
    const insurer = insurers.find((i) => i.id === insurerId);
    const plan = insurer?.plans.find((p) => p.id === planId);
    const tiers = plan?.tiers || [];
    const bestTier =
      tiers.length === 0
        ? null
        : tiers.reduce((best, cur) => {
            const bestRb = best.roomBoardDailyLimit ?? -Infinity;
            const curRb = cur.roomBoardDailyLimit ?? -Infinity;
            return curRb > bestRb ? cur : best;
          }, tiers[0]);
    setSelectedTierIdsByInsurer((prev) => ({ ...prev, [insurerId]: bestTier?.id || '' }));
    const requiredRiders = (plan?.riders || []).filter((r) => r.isRequired).map((r) => r.id);
    setSelectedRidersByInsurer((prev) => ({ ...prev, [insurerId]: requiredRiders }));
  };

  const toggleRider = (insurerId: string, riderId: string) => {
    const insurer = insurers.find((i) => i.id === insurerId);
    const planId = selectedPlanIdsByInsurer[insurerId];
    const plan = insurer?.plans.find((p) => p.id === planId);
    const isRequired = !!plan?.riders.find((r) => r.id === riderId)?.isRequired;
    if (isRequired) return;

    setSelectedRidersByInsurer((prev) => {
      const current = prev[insurerId] || [];
      const next = current.includes(riderId) ? current.filter((id) => id !== riderId) : [...current, riderId];
      return { ...prev, [insurerId]: next };
    });
  };

  const canContinue = useMemo(() => {
    if (selectedInsurerIds.length < MIN_INSURERS) return false;
    return selectedInsurerIds.every((id) => {
      const planId = selectedPlanIdsByInsurer[id];
      if (!planId) return false;
      const insurer = insurers.find((i) => i.id === id);
      const plan = insurer?.plans.find((p) => p.id === planId);
      if (!plan) return false;
      if (!plan.tiers || plan.tiers.length === 0) return true;
      const tierId = selectedTierIdsByInsurer[id];
      return Boolean(tierId);
    });
  }, [insurers, selectedInsurerIds, selectedPlanIdsByInsurer, selectedTierIdsByInsurer]);

  const selection: SelectedComparison[] = useMemo(() => {
    const insurerMap = new Map(insurers.map((i) => [i.id, i]));
    return selectedInsurerIds
      .map((insurerId) => {
        const insurer = insurerMap.get(insurerId);
        if (!insurer) return null;
        const planId = selectedPlanIdsByInsurer[insurerId];
        const plan = insurer.plans.find((p) => p.id === planId);
        if (!plan) return null;
        const tierId = selectedTierIdsByInsurer[insurerId] || '';
        const tier =
          plan.tiers && plan.tiers.length > 0 ? plan.tiers.find((t) => t.id === tierId) || plan.tiers[0] : null;
        const riderIds = selectedRidersByInsurer[insurerId] || [];
        const riders = plan.riders.filter((r) => riderIds.includes(r.id));
        return { insurer, plan, tier, riders };
      })
      .filter((x): x is SelectedComparison => Boolean(x));
  }, [insurers, selectedInsurerIds, selectedPlanIdsByInsurer, selectedTierIdsByInsurer, selectedRidersByInsurer]);

  const gotoReview = () => {
    if (!canContinue) return;
    setStep(2);
  };

  const gotoCompare = () => {
    setStep(3);
  };

  const backToSelect = () => setStep(1);
  const backToReview = () => setStep(2);

  const [hasCompanyCover, setHasCompanyCover] = useState(false);
  const [scenario, setScenario] = useState<'comfort' | 'recovery' | 'selfpay' | 'cancer' | 'wellness' | null>(null);
  const [openBenefits, setOpenBenefits] = useState<{ outpatient: boolean; other: boolean }>({ outpatient: false, other: false });

  const formatMoney = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    if (!Number.isFinite(n)) return '—';
    if (n >= 1_000_000) {
      const v = n / 1_000_000;
      const dp = n % 1_000_000 === 0 ? 0 : 1;
      return `RM ${v.toFixed(dp)}M`;
    }
    return `RM ${n.toLocaleString()}`;
  };

  const formatDays = (n: number | null) => {
    if (n === null || n === undefined) return '—';
    return `${n}d`;
  };

  const getDeductibleDisplay = (d: Deductible) => {
    if (!d.amount) return '—';
    const unit =
      d.unit === 'yr' ? ` / ${t('yr', '年')}` : d.unit === 'case' ? ` / ${t('case', '次')}` : d.notes ? ` · ${d.notes}` : '';
    return `RM ${d.amount.toLocaleString()}${unit}`;
  };

  const getFeatureValue = (plan: Plan, keywords: string[]) => {
    const ks = keywords.map((k) => k.toLowerCase());
    const match = plan.features.find((f) => {
      const name = (f.name || '').toLowerCase();
      return ks.some((k) => name.includes(k));
    });
    return match?.description || '—';
  };

  const splitTextPieces = (text: string) =>
    text
      .split(/；|;|\n|\r|\u2022|\u00b7/)
      .map((s) => s.trim())
      .filter(Boolean);

  const extractPiece = (texts: Array<string | null | undefined>, keywords: string[]) => {
    const ks = keywords.map((k) => k.toLowerCase());
    const merged = texts.filter(Boolean).join('；');
    const pieces = splitTextPieces(merged);
    const hit = pieces.find((p) => {
      const v = p.toLowerCase();
      return ks.some((k) => v.includes(k));
    });
    return hit || '';
  };

  const getBenefitValue = (col: ReviewCol, benefitKey: string) => {
    const cov = col.tier?.coverage;
    const infoTexts = [
      cov?.outpatientDetails,
      cov?.emergencyDetails,
      cov?.panelHospitalNotes,
      cov?.overseasCoverageDetails,
      cov?.noClaimBenefit,
      cov?.pricingDetails
    ];

    const featureTexts = col.plan.features.flatMap((f) => [f.name, f.description].filter(Boolean)) as string[];

    const map: Record<string, string[][]> = {
      cancer_tx: [['癌症', 'cancer', 'chemo']],
      kidney_dialysis: [['肾', 'dialysis', 'kidney']],
      emergency_accidental: [['意外', 'accident', 'emergency', '牙科', 'dental']],
      dengue: [['骨痛热症', '登革', 'dengue', '寨卡', 'zika']],
      physiotherapy: [['物理', 'physio', 'rehab', '复健']],
      imaging: [['mri', 'pet', 'imaging', '影像']],
      home_nursing: [['home nursing', '居家', '护理']],
      lodger: [['lodger', '陪护', '住宿']],
      iol: [['iol', 'intraocular', '晶体']],
      tcm: [['tcm', 'traditional chinese', '中医', '脊骨', 'chiro']],
      organ_transplant: [['organ transplant', '器官移植', '移植']],
      overseas: [['overseas', '境外', '海外', '新加坡', 'singapore', '香港', 'hong kong', 'china', '中国', 'brunei', '汶莱']],
      alt_cancer: [['alternative cancer', 'alt', '替代', '癌症']],
      second_opinion: [['2nd opinion', 'second opinion', '第二意见']],
      ambulance: [['ambulance', '救护车', '撤离', 'evac']],
      maternity: [['maternity', '妊娠', '孕', '产后']],
      medical_appliances: [['medical appliances', '器材', 'appliances']],
      health_wallet: [['health wallet', '钱包', '无理赔', 'no-claim']],
      wellness: [['wellness', 'screening', '体检', '健检', '疫苗']],
      mental_health: [['mental', '精神', '心理', 'depression', 'ocd']],
      recovery_care: [['recovery', '复元', '护理金', 'rehab']]
    };

    const groups = map[benefitKey] || [];
    for (const keys of groups) {
      const piece = extractPiece(infoTexts, keys) || extractPiece(featureTexts, keys);
      if (piece) return piece;
    }
    return '—';
  };

  const getSelectedTier = (s: SelectedComparison) => s.tier || s.plan.defaultTier;

  const getBestMask = (values: Array<number | null>, hi: boolean) => {
    const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (nums.length === 0) return values.map(() => false);
    const best = hi ? Math.max(...nums) : Math.min(...nums);
    return values.map((v) => v === best);
  };

  const keyedSelection = useMemo(() => {
    const map = new Map<string, SelectedComparison>();
    for (const s of selection) map.set(s.insurer.id, s);
    return map;
  }, [selection]);

  const findByShortName = (shortName: string) => {
    const s = shortName.toLowerCase();
    return selection.find((x) => (x.insurer.shortName || '').toLowerCase() === s) || null;
  };

  const hla = findByShortName('hla');
  const aia = findByShortName('aia');
  const pru = findByShortName('pru');

  const recommended = useMemo(() => {
    if (!scenario) return null;
    if (scenario === 'comfort') {
      if (!hla) return null;
      return { ...hla, tier: getSelectedTier(hla) };
    }
    if (scenario === 'recovery') return aia ? { ...aia, tier: getSelectedTier(aia) } : null;
    if (scenario === 'selfpay') return pru ? { ...pru, tier: getSelectedTier(pru) } : null;
    if (scenario === 'cancer') return hla ? { ...hla, tier: getSelectedTier(hla) } : null;
    if (scenario === 'wellness') return aia ? { ...aia, tier: getSelectedTier(aia) } : null;
    return null;
  }, [aia, hla, pru, scenario]);

  const scenarioOutput = useMemo(() => {
    if (!scenario || !recommended) {
      return { why: '', highlightIds: [] as string[], warnInsurerId: '', warnMessage: '' };
    }

    const tier = recommended.tier || recommended.plan.defaultTier;
    if (scenario === 'comfort') {
      const rb = tier?.roomBoardDailyLimit ? `RM ${tier.roomBoardDailyLimit.toLocaleString()}/day` : '—';
      return {
        why: t(
          `HLA ${tier?.tierName || ''} has the highest R&B (${rb}). Best for clients who want private ward comfort without compromise.`,
          `HLA ${tier?.tierName || ''} 病房津贴最高（${rb}），适合重视私立病房舒适度的客户。`
        ),
        highlightIds: ['rb', 'annual'],
        warnInsurerId: '',
        warnMessage: ''
      };
    }

    if (scenario === 'recovery') {
      return {
        why: t(
          'AIA covers longer post-hosp for serious conditions + recovery care + Health Wallet. Strongest post-discharge support among the options.',
          'AIA 针对重疾的出院后保障更长，并带有复元护理 + Health Wallet，出院后支持更强。'
        ),
        highlightIds: ['post', 'icu'],
        warnInsurerId: '',
        warnMessage: ''
      };
    }

    if (scenario === 'selfpay') {
      const pruDed = recommended.plan.deductible.amount ? `RM ${recommended.plan.deductible.amount.toLocaleString()}` : '—';
      const hlaDed = hla?.plan.deductible.amount ? `RM ${hla.plan.deductible.amount.toLocaleString()}` : '—';
      return {
        why: hasCompanyCover
          ? t(
              `PRU deductible ${pruDed} — lowest fixed self-pay. Company insurance can absorb the deductible if needed.`,
              `PRU 免赔额 ${pruDed} — 固定自付最低；有公司医疗保障时更适合承接免赔额。`
            )
          : t(
              `PRU deductible ${pruDed} — lowest and most predictable self-pay. HLA deductible ${hlaDed} is much higher without company insurance to cushion it.`,
              `PRU 免赔额 ${pruDed} — 自付最低且更可预测；没有公司医疗保障时，HLA ${hlaDed} 自付会更高。`
            ),
        highlightIds: ['ded', 'maxSelfPay'],
        warnInsurerId: !hasCompanyCover && hla ? hla.insurer.id : '',
        warnMessage: t('RM 2,500 deductible — only suitable if client has company medical cover', 'RM 2,500 免赔额 — 仅适合客户有公司医疗保障时')
      };
    }

    if (scenario === 'cancer') {
      const alt = getBenefitValue(
        {
          insurerId: recommended.insurer.id,
          shortName: recommended.insurer.shortName || recommended.insurer.name,
          planName: recommended.plan.name,
          tier: tier || null,
          deductible: recommended.plan.deductible,
          plan: recommended.plan
        },
        'alt_cancer'
      );
      return {
        why: t(
          `HLA ${tier?.tierName || ''} includes alternative cancer-related benefit (${alt || '—'}) and strong outpatient cancer support.`,
          `HLA ${tier?.tierName || ''} 包含替代癌症相关权益（${alt || '—'}），并提供更强的癌症门诊支持。`
        ),
        highlightIds: ['annual'],
        warnInsurerId: '',
        warnMessage: ''
      };
    }

    if (scenario === 'wellness') {
      const wallet = getFeatureValue(recommended.plan, ['health wallet', 'no-claim', '钱包', '无理赔']);
      return {
        why: t(
          `AIA Health Wallet: ${wallet}. Unique in this comparison for wellness & prevention.`,
          `AIA Health Wallet：${wallet}。在本对比中属于更偏向健康管理/预防的方案。`
        ),
        highlightIds: [],
        warnInsurerId: '',
        warnMessage: ''
      };
    }

    return { why: '', highlightIds: [] as string[], warnInsurerId: '', warnMessage: '' };
  }, [getBenefitValue, getFeatureValue, hasCompanyCover, hla, recommended, scenario, t]);

  const reviewCols: ReviewCol[] = useMemo(() => {
    return selection.map((s) => {
      const tier = getSelectedTier(s);
      return {
        insurerId: s.insurer.id,
        shortName: insurerLabel(s.insurer),
        planName: displayPlanName(s.plan.name, s.insurer),
        tier,
        deductible: s.plan.deductible,
        plan: s.plan
      };
    });
  }, [getSelectedTier, selection]);

  const renderMvpCompareTable = (cols: ReviewCol[], recInsurerId: string, highlightIds: string[], warnInsurerId: string) => {
    const annualVals = cols.map((c) => c.tier?.annualLimit ?? null);
    const rbVals = cols.map((c) => c.tier?.roomBoardDailyLimit ?? null);
    const preVals = cols.map((c) => c.tier?.coverage?.preHospitalizationDays ?? null);
    const postVals = cols.map((c) => c.tier?.coverage?.postHospitalizationDays ?? null);
    const icuVals = cols.map((c) => c.tier?.coverage?.icuMaxDays ?? null);
    const dedVals = cols.map((c) => c.deductible.amount ?? null);

    const annualBest = getBestMask(annualVals, true);
    const rbBest = getBestMask(rbVals, true);
    const preBest = getBestMask(preVals, true);
    const postBest = getBestMask(postVals, true);
    const icuBest = getBestMask(icuVals, true);
    const dedBest = getBestMask(dedVals, false);

    const thOpacity = (id: string) => (recInsurerId && id !== recInsurerId ? 'opacity-30' : 'opacity-100');
    const tdOpacity = (id: string) => (recInsurerId && id !== recInsurerId ? 'opacity-30' : 'opacity-100');

    const isHl = (id: string) => highlightIds.includes(id);

    const outpatientRows = [
      { id: 'cancer_tx', label: t('Cancer tx', '癌症治疗') },
      { id: 'kidney_dialysis', label: t('Kidney dialysis', '肾透析') },
      { id: 'emergency_accidental', label: t('Emergency accidental', '意外门诊') },
      { id: 'dengue', label: t('Dengue', '骨痛热症/登革热') },
      { id: 'physiotherapy', label: t('Physiotherapy', '物理治疗') },
      { id: 'imaging', label: t('Imaging (MRI/PET)', '影像检查（MRI/PET）') }
    ];

    const otherRows = [
      { id: 'home_nursing', label: t('Home nursing', '居家护理') },
      { id: 'lodger', label: t('Lodger', '陪护住宿') },
      { id: 'iol', label: t('IOL', '人工晶体') },
      { id: 'tcm', label: t('TCM', '中医/脊骨') },
      { id: 'organ_transplant', label: t('Organ transplant', '器官移植') },
      { id: 'overseas', label: t('Overseas', '海外保障') },
      { id: 'alt_cancer', label: t('Alt. cancer tx', '替代癌症治疗') },
      { id: 'second_opinion', label: t('2nd opinion', '第二意见') },
      { id: 'ambulance', label: t('Ambulance', '救护车/撤离') },
      { id: 'maternity', label: t('Maternity comp.', '妊娠并发症') },
      { id: 'medical_appliances', label: t('Medical appliances', '医疗器材') },
      { id: 'health_wallet', label: t('Health Wallet', '健康钱包') },
      { id: 'wellness', label: t('Wellness', '健康管理') },
      { id: 'mental_health', label: t('Mental health', '心理健康') },
      { id: 'recovery_care', label: t('Recovery care', '复元护理') }
    ];

    const rows = [
      {
        id: 'annual',
        label: t('Annual limit', '年度限额'),
        best: annualBest,
        accent: 'info' as const,
        value: (c: ReviewCol) => formatMoney(c.tier?.annualLimit ?? null)
      },
      {
        id: 'lifetime',
        label: t('Lifetime limit', '终身限额'),
        best: cols.map(() => false),
        accent: undefined,
        value: (c: ReviewCol) => (c.tier?.lifetimeLimit === null ? t('Unlimited', '无限额') : formatMoney(c.tier?.lifetimeLimit ?? null))
      },
      {
        id: 'rb',
        label: t('R&B / day', '病房津贴/天'),
        best: rbBest,
        accent: 'info' as const,
        value: (c: ReviewCol) => (c.tier?.roomBoardDailyLimit ? `RM ${c.tier.roomBoardDailyLimit.toLocaleString()}` : '—')
      },
      {
        id: 'pre',
        label: t('Pre-hosp', '住院前'),
        best: preBest,
        accent: 'info' as const,
        value: (c: ReviewCol) => formatDays(c.tier?.coverage?.preHospitalizationDays ?? null)
      },
      {
        id: 'post',
        label: t('Post-hosp', '出院后'),
        best: postBest,
        accent: 'info' as const,
        value: (c: ReviewCol) => {
          const d = c.tier?.coverage?.postHospitalizationDays ?? null;
          const note = extractPiece([c.tier?.coverage?.outpatientDetails, c.tier?.coverage?.panelHospitalNotes], ['post-hosp', 'post hosp', '出院后']);
          if (note) return note;
          return formatDays(d);
        }
      },
      {
        id: 'icu',
        label: t('ICU max', 'ICU 最多'),
        best: icuBest,
        accent: 'info' as const,
        value: (c: ReviewCol) => formatDays(c.tier?.coverage?.icuMaxDays ?? null)
      },
      {
        id: 'ded',
        label: t('Deductible', '免赔额'),
        best: dedBest,
        accent: undefined,
        value: (c: ReviewCol) => getDeductibleDisplay(c.deductible)
      },
      {
        id: 'coins',
        label: t('Co-insurance', '共同保险'),
        best: cols.map(() => false),
        accent: undefined,
        value: () => t('None', '无')
      },
      {
        id: 'maxSelfPay',
        label: t('Max self-pay', '最高自付'),
        best: dedBest,
        accent: 'warning' as const,
        value: (c: ReviewCol) => (c.deductible.amount ? `RM ${c.deductible.amount.toLocaleString()}` : '—')
      }
    ];

    return (
      <div className="overflow-x-auto border border-slate-100 rounded-2xl">
        <table className="w-full min-w-[720px] border-collapse">
          <colgroup>
            <col className="w-[32%]" />
            {cols.map((c) => (
              <col key={c.insurerId} className="w-[23%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-white">
              <th className="p-3 text-left text-xs font-semibold text-slate-500"></th>
              {cols.map((c) => (
                <th key={c.insurerId} className={`p-3 text-center ${thOpacity(c.insurerId)}`}>
                  {recInsurerId === c.insurerId && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 mb-1">
                      {t('✓ Recommended', '✓ 推荐')}
                    </div>
                  )}
                  {warnInsurerId === c.insurerId && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 mb-1">
                      {t('⚠ High deductible', '⚠ 高免赔')}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-slate-900">{c.shortName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.tier?.tierName || c.planName}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-slate-50">
              <td colSpan={cols.length + 1} className="p-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {t('Core benefits', '核心保障')}
              </td>
            </tr>

            {rows.map((row) => {
              const hl = isHl(row.id);
              const rowBg = !hl && row.accent === 'warning' ? 'bg-amber-50/40' : '';
              return (
                <tr key={row.id} className={rowBg}>
                  <td className={`p-3 border-b border-slate-100 text-xs ${hl ? 'bg-xin-blue/5 text-slate-900 font-semibold' : 'text-slate-600'}`}>
                    {row.label}
                  </td>
                  {cols.map((c, i) => {
                    const best = (row.best || [])[i];
                    const cellBg = hl || best ? 'bg-xin-blue/5' : '';
                    const accent =
                      row.accent === 'info' ? 'text-xin-blue' : row.accent === 'warning' ? 'text-amber-800' : 'text-slate-800';
                    const weight = recInsurerId === c.insurerId && hl ? 'font-bold' : best && !hl ? 'font-medium' : 'font-normal';
                    return (
                      <td key={c.insurerId} className={`p-3 border-b border-slate-100 text-center text-xs ${tdOpacity(c.insurerId)} ${cellBg} ${accent} ${weight}`}>
                        <span className="inline-flex items-center justify-center gap-1">
                          <span>{row.value(c)}</span>
                          {best && !hl && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr className="bg-slate-50">
              <td colSpan={cols.length + 1} className="p-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setOpenBenefits((s) => ({ ...s, outpatient: !s.outpatient }))}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                >
                  {openBenefits.outpatient ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {t('Outpatient benefits', '门诊保障')}
                </button>
              </td>
            </tr>

            {openBenefits.outpatient &&
              outpatientRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 border-b border-slate-100 text-xs text-slate-600">{r.label}</td>
                  {cols.map((c) => (
                    <td key={c.insurerId} className={`p-3 border-b border-slate-100 text-center text-xs text-slate-800 ${tdOpacity(c.insurerId)}`}>
                      {getBenefitValue(c, r.id)}
                    </td>
                  ))}
                </tr>
              ))}

            <tr className="bg-slate-50">
              <td colSpan={cols.length + 1} className="p-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setOpenBenefits((s) => ({ ...s, other: !s.other }))}
                  className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                >
                  {openBenefits.other ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {t('Other benefits', '其他福利')}
                </button>
              </td>
            </tr>

            {openBenefits.other &&
              otherRows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 border-b border-slate-100 text-xs text-slate-600">{r.label}</td>
                  {cols.map((c) => (
                    <td key={c.insurerId} className={`p-3 border-b border-slate-100 text-center text-xs text-slate-800 ${tdOpacity(c.insurerId)}`}>
                      {getBenefitValue(c, r.id)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-xin-blue" />
          <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('Insurance Comparison', '保单对比')}</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {t('Medical-only MVP. Select plan and riders, then compare side-by-side.', 'Medical 版本：选择方案与 Riders，再进行对比。')}
        </p>
      </div>

      {isLoading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-500">
          {t('Loading...', '加载中...')}
        </div>
      )}

      {!isLoading && loadError && (
        <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm p-5 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {!isLoading && !loadError && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5 max-w-3xl mx-auto">
            <div className="flex items-center justify-center">
              <div className={`flex flex-col items-center ${step >= 1 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 1 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                <span className="text-sm font-medium">{t('Select', '选择')}</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded ${step >= 2 ? 'bg-xin-blue' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 2 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 2 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                <span className="text-sm font-medium">{t('Review', '确认')}</span>
              </div>
              <div className={`flex-1 h-1 mx-4 rounded ${step >= 3 ? 'bg-xin-blue' : 'bg-slate-200'}`}></div>
              <div className={`flex flex-col items-center ${step >= 3 ? 'text-xin-blue' : 'text-slate-400'}`}>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-semibold mb-2 ${step >= 3 ? 'bg-xin-blue text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                <span className="text-sm font-medium">{t('Compare', '对比')}</span>
              </div>
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <div className="text-sm font-semibold text-xin-blue mb-2">
                    {t(`Insurers (min ${MIN_INSURERS})`, `保险公司（至少 ${MIN_INSURERS} 家）`)}
                  </div>
                  <div className="space-y-2">
                    {insurers.map((i) => (
                      <label
                        key={i.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer ${
                          selectedInsurerIds.includes(i.id) ? 'border-xin-gold/50 bg-xin-gold/10' : 'border-slate-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedInsurerIds.includes(i.id)}
                            onChange={() => toggleInsurer(i.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">{insurerLabel(i)}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-sm font-semibold text-xin-blue mb-2">{t('Plans & Riders', '方案与 Riders')}</div>
                  {selectedInsurers.length === 0 ? (
                    <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500">
                      {t('Select insurers first.', '请先选择保险公司。')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedInsurers.map((insurer) => {
                        const plans = insurer.plans;
                        const selectedPlanId = selectedPlanIdsByInsurer[insurer.id] || '';
                        const selectedPlan = plans.find((p) => p.id === selectedPlanId);
                        const ridersSelected = selectedRidersByInsurer[insurer.id] || [];

                        return (
                          <div key={insurer.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-100">
                              <div className="font-semibold text-slate-900">{insurerLabel(insurer)}</div>
                              <div className="text-xs text-slate-500">{t('Pick a plan and optional riders', '选择方案与可选 Riders')}</div>
                            </div>

                            <div className="p-4 space-y-4">
                              <div>
                                <div className="text-sm font-medium text-slate-700 mb-1">{t('Plan', '方案')}</div>
                                <select
                                  value={selectedPlanId}
                                  onChange={(e) => onPickPlan(insurer.id, e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-xl focus:ring-xin-gold focus:border-xin-gold text-sm bg-white"
                                >
                                  <option value="">{t('-- Select a plan --', '-- 选择方案 --')}</option>
                                  {plans.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.defaultTier?.tierName
                                        ? `${displayPlanName(p.name, insurer)} (${p.defaultTier.tierName})`
                                        : displayPlanName(p.name, insurer)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="text-sm font-medium text-slate-700 mb-2">{t('Riders', 'Riders')}</div>
                                {!selectedPlan ? (
                                  <div className="text-xs text-slate-500">{t('Select a plan to view riders.', '请选择方案以查看 Riders。')}</div>
                                ) : selectedPlan.riders.length === 0 ? (
                                  <div className="text-xs text-slate-500">{t('No riders for this plan.', '该方案没有 Riders。')}</div>
                                ) : (
                                  <div className="space-y-2">
                                    {selectedPlan.riders.map((r) => (
                                      <label
                                        key={r.id}
                                        className={`flex items-start justify-between p-3 rounded-xl border cursor-pointer ${
                                          ridersSelected.includes(r.id) ? 'border-xin-gold/40 bg-xin-gold/10' : 'border-slate-100 bg-white'
                                        }`}
                                      >
                                        <div className="flex items-start gap-3">
                                          <input
                                            type="checkbox"
                                            checked={ridersSelected.includes(r.id)}
                                            onChange={() => toggleRider(insurer.id, r.id)}
                                            disabled={r.isRequired}
                                            className="h-4 w-4 mt-0.5"
                                          />
                                          <div className="min-w-0">
                                            <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                                            {r.description && <div className="text-xs text-slate-600 mt-0.5">{r.description}</div>}
                                          </div>
                                        </div>
                                        {r.isRequired && (
                                          <div className="text-[10px] font-semibold text-xin-blue whitespace-nowrap ml-4 bg-xin-gold/20 px-2 py-0.5 rounded">
                                            {t('Required', '必选')}
                                          </div>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {selectedInsurerIds.length < MIN_INSURERS ? (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertCircle size={16} />
                      {t(`Need ${MIN_INSURERS - selectedInsurerIds.length} more insurer(s)`, `还需要 ${MIN_INSURERS - selectedInsurerIds.length} 家`)}
                    </span>
                  ) : (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <CheckCircle size={16} />
                      {t('Ready', '可以继续')}
                    </span>
                  )}
                </div>
                <button
                  onClick={gotoReview}
                  disabled={!canContinue}
                  className={`px-4 py-2 rounded-xl font-medium text-white transition-colors ${
                    !canContinue ? 'bg-slate-300 cursor-not-allowed' : 'bg-xin-blue hover:opacity-90'
                  }`}
                >
                  {t('Continue', '继续')}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-xin-blue">{t('Advisor Review', '顾问 Review')}</div>
                  <div className="text-xs text-slate-500">
                    {t('Select scenario to generate recommendation and review key differences.', '选择情景自动推荐，并快速核对核心差异。')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={backToSelect} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50">
                    {t('Back', '返回')}
                  </button>
                  <button onClick={gotoCompare} className="px-3 py-2 rounded-xl bg-xin-blue text-white text-sm hover:opacity-90">
                    {t('Continue', '继续')}
                  </button>
                </div>
              </div>

              {selection
                .filter((s) => (s.plan.tiers || []).length > 1)
                .map((s) => {
                  const tiers = [...(s.plan.tiers || [])].sort(
                    (a, b) => (a.roomBoardDailyLimit ?? 0) - (b.roomBoardDailyLimit ?? 0)
                  );
                  const activeTierId = selectedTierIdsByInsurer[s.insurer.id] || '';
                  return (
                    <div key={s.insurer.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">{t('Tier:', 'Tier：')}</span>
                      <span className="text-xs font-semibold text-slate-700">{s.insurer.shortName || s.insurer.name}</span>
                      {tiers.map((tier) => (
                        <button
                          key={tier.id}
                          onClick={() => setSelectedTierIdsByInsurer((prev) => ({ ...prev, [s.insurer.id]: tier.id }))}
                          className={`px-3 py-1 rounded-full text-xs border transition ${
                            activeTierId === tier.id
                              ? 'bg-xin-gold/20 border-xin-gold/40 text-xin-blue'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {tier.tierName}
                        </button>
                      ))}
                    </div>
                  );
                })}

              <button
                type="button"
                onClick={() => setHasCompanyCover((v) => !v)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition"
              >
                <div className={`w-9 h-5 rounded-full relative transition ${hasCompanyCover ? 'bg-xin-blue' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition ${hasCompanyCover ? 'left-4' : 'left-0.5'}`} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900">
                    {t('Client has company medical insurance', '客户有公司医疗保障')}
                  </div>
                  <div className="text-xs text-slate-500">
                    {hasCompanyCover
                      ? t('High deductible options viable', '高免赔额方案可行')
                      : t('High deductible not recommended', '高免赔额不建议')}
                  </div>
                </div>
              </button>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("Client's priority", '客户优先项')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'comfort',
                      icon: Building2,
                      label: t('Hospital comfort', '病房舒适'),
                      sub: t('Private ward, R&B priority', '私立病房，重视 R&B')
                    },
                    {
                      id: 'recovery',
                      icon: HeartPulse,
                      label: t('Serious illness', '重疾/康复'),
                      sub: t('Cancer, stroke, long rehab', '癌症/中风/长期复健')
                    },
                    {
                      id: 'selfpay',
                      icon: Wallet,
                      label: t('Minimise self-pay', '降低自付'),
                      sub: t('No company insurance', '没有公司医疗保障')
                    },
                    {
                      id: 'cancer',
                      icon: Target,
                      label: t('Cancer coverage', '癌症保障'),
                      sub: t('Alt treatment, outpatient', '替代治疗/门诊')
                    },
                    {
                      id: 'wellness',
                      icon: Leaf,
                      label: t('Wellness & prevention', '健康管理'),
                      sub: t('Screening, mental health', '体检/心理健康')
                    }
                  ].map((s) => {
                    const on = scenario === (s.id as any);
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setScenario((prev) => (prev === (s.id as any) ? null : (s.id as any)))}
                        className={`text-left p-4 rounded-2xl border transition ${
                          on ? 'border-xin-blue/40 bg-xin-blue/5' : 'border-slate-100 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`${on ? 'text-xin-blue' : 'text-slate-500'}`} size={18} />
                          <div className={`text-sm font-semibold ${on ? 'text-xin-blue' : 'text-slate-900'}`}>{s.label}</div>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {recommended && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs font-semibold text-emerald-800 mb-1">
                    {t('Recommended', '推荐')}:{' '}
                    {(recommended.insurer.shortName || recommended.insurer.name) + ' ' + (recommended.tier?.tierName || recommended.plan.defaultTier?.tierName || '')}
                  </div>
                  <div className="text-sm text-slate-700 leading-relaxed">{scenarioOutput.why}</div>
                  {scenarioOutput.warnMessage && (
                    <div className="text-xs text-amber-800 font-semibold mt-2">{`⚠ ${scenarioOutput.warnMessage}`}</div>
                  )}
                </div>
              )}

              {renderMvpCompareTable(reviewCols, recommended?.insurer.id || '', scenarioOutput.highlightIds, scenarioOutput.warnInsurerId)}

              <div className="text-[10px] text-slate-500">{t('● = best in row', '● = 行内最佳')}</div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-xin-blue">{t('Comparison', '对比')}</div>
                  <div className="text-xs text-slate-500">{t('Side-by-side medical coverage + riders/clauses.', '医疗保障 + Riders/条款 对比。')}</div>
                </div>
                <button onClick={backToReview} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-white">
                  {t('Back', '返回')}
                </button>
              </div>

              <div className="p-6 space-y-6">
                {hla && (hla.plan.tiers || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">{t('HLA tier:', 'HLA Tier：')}</span>
                    {['200', '300', '500']
                      .map((code) => {
                        const tier = (hla.plan.tiers || []).find((x) => (x.tierName || '').includes(code));
                        return tier ? { code, tier } : null;
                      })
                      .filter(Boolean)
                      .map((x) => {
                        const v = x as { code: string; tier: Tier };
                        const active = (selectedTierIdsByInsurer[hla.insurer.id] || '') === v.tier.id;
                        return (
                          <button
                            key={v.tier.id}
                            type="button"
                            onClick={() => setSelectedTierIdsByInsurer((prev) => ({ ...prev, [hla.insurer.id]: v.tier.id }))}
                            className={`px-3 py-1 rounded-full text-xs border transition ${
                              active ? 'bg-xin-blue/5 border-xin-blue/40 text-xin-blue' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {v.tier.tierName}
                          </button>
                        );
                      })}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setHasCompanyCover((v) => !v)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition"
                >
                  <div className={`w-9 h-5 rounded-full relative transition ${hasCompanyCover ? 'bg-xin-blue' : 'bg-slate-300'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition ${hasCompanyCover ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-900">{t('Client has company medical insurance', '客户有公司医疗保障')}</div>
                    <div className="text-xs text-slate-500">
                      {hasCompanyCover
                        ? t('Higher deductible options are viable', '高免赔额方案可行')
                        : t('High deductible not recommended — client bears full excess', '高免赔额不建议 — 客户需自行承担免赔额')}
                    </div>
                  </div>
                </button>

                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("Client's priority", '客户优先项')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'comfort', icon: Building2, label: t('Hospital comfort', '病房舒适'), sub: t('Private ward, good R&B', '私立病房，重视 R&B') },
                      { id: 'recovery', icon: HeartPulse, label: t('Serious illness recovery', '重疾/康复'), sub: t('Cancer, stroke, long rehab', '癌症/中风/长期复健') },
                      { id: 'selfpay', icon: Wallet, label: t('Minimise self-pay', '降低自付'), sub: t('Client has no company insurance', '没有公司医疗保障') },
                      { id: 'cancer', icon: Target, label: t('Cancer-focused', '癌症优先'), sub: t('Outpatient chemo + alt treatment', '门诊化疗 + 替代治疗') },
                      { id: 'wellness', icon: Leaf, label: t('Wellness & prevention', '健康管理'), sub: t('Screening, mental health', '体检/心理健康') }
                    ].map((s) => {
                      const on = scenario === (s.id as any);
                      const Icon = s.icon;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setScenario((prev) => (prev === (s.id as any) ? null : (s.id as any)))}
                          className={`text-left p-4 rounded-2xl border transition ${
                            on ? 'border-xin-blue/40 bg-xin-blue/5' : 'border-slate-100 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`${on ? 'text-xin-blue' : 'text-slate-500'}`} size={18} />
                            <div className={`text-sm font-semibold ${on ? 'text-xin-blue' : 'text-slate-900'}`}>{s.label}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {recommended && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-semibold text-emerald-800 mb-1">{t('Recommended →', '推荐 →')} {insurerLabel(recommended.insurer)} {recommended.tier?.tierName || recommended.plan.defaultTier?.tierName || ''}</div>
                    <div className="text-sm text-slate-700 leading-relaxed">{scenarioOutput.why}</div>
                    {scenarioOutput.warnMessage && (
                      <div className="text-xs text-amber-800 font-semibold mt-2">{`⚠ ${scenarioOutput.warnMessage}`}</div>
                    )}
                  </div>
                )}

                {renderMvpCompareTable(reviewCols, recommended?.insurer.id || '', scenarioOutput.highlightIds, scenarioOutput.warnInsurerId)}
                <div className="text-[10px] text-slate-500">{t('● = best in row', '● = 行内最佳')}</div>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="p-4 border-b border-r border-slate-100 bg-white w-1/4">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('Features', '项目')}</span>
                        </th>
                        {selection.map((s) => (
                          <th key={s.insurer.id} className="p-4 border-b border-slate-100 bg-white w-1/4">
                          <div className="font-semibold text-slate-900">{insurerLabel(s.insurer)}</div>
                          <div className="text-xs text-slate-500 mt-1">{displayPlanName(s.plan.name, s.insurer)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                      <tr className="bg-slate-50/60">
                        <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                          {t('Selling Points', '卖点')}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Selling Points', '卖点')}</td>
                        {selection.map((s) => (
                          <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                            {s.plan.features.filter((f) => f.isSellingPoint).length === 0 ? (
                              <span className="text-slate-400 text-xs italic">-</span>
                            ) : (
                              <ul className="space-y-2">
                                {s.plan.features
                                  .filter((f) => f.isSellingPoint)
                                  .map((f, i) => (
                                    <li key={i} className="text-xs border border-slate-100 rounded-xl p-2 bg-white">
                                      <div className="font-semibold text-slate-900">{f.name}</div>
                                      {f.description && <div className="text-slate-600 mt-0.5">{f.description}</div>}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </td>
                        ))}
                      </tr>

                      <tr className="bg-slate-50/60">
                        <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                          {t('Riders & Clauses', 'Riders 与条款')}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Selected Riders', '已选 Riders')}</td>
                        {selection.map((s) => (
                          <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                            {s.riders.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">-</span>
                            ) : (
                              <ul className="space-y-2">
                                {s.riders.map((r) => (
                                  <li key={r.id} className="text-xs border border-slate-100 rounded-xl p-2 bg-white">
                                    <div className="font-semibold text-slate-900">
                                      {r.name}
                                      {r.isRequired && (
                                        <span className="ml-2 text-[10px] bg-xin-gold/20 text-xin-blue px-1.5 py-0.5 rounded">
                                          {t('Required', '必选')}
                                        </span>
                                      )}
                                    </div>
                                    {r.clauses.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {r.clauses.map((c, idx) => (
                                          <div key={idx} className="text-[11px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-2">
                                            <div className="font-semibold">{c.advisorAlert}</div>
                                            <div className="text-slate-500">
                                              {c.clauseType}
                                              {c.headlineValue ? ` · ${c.headlineValue}` : ''}
                                              {c.effectiveLimit ? ` · ${c.effectiveLimit}` : ''}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        ))}
                      </tr>

                      <tr className="bg-slate-50/60">
                        <td colSpan={selection.length + 1} className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-r border-slate-100">
                          {t('Exclusions', '除外条款')}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 border-r border-slate-100 font-medium text-slate-700">{t('Key Exclusions', '关键除外')}</td>
                        {selection.map((s) => (
                          <td key={s.insurer.id} className="p-4 text-slate-700 align-top">
                            {s.plan.exclusions.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">-</span>
                            ) : (
                              <ul className="list-disc pl-4 space-y-1 text-xs">
                                {s.plan.exclusions.map((ex, i) => (
                                  <li key={i}>{ex}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InsuranceComparison;

