import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { isMissingTableError } from '../assets/degrade';
import { groupValuationsByAsset } from '../assets/allocation';
import {
  approveReview, rejectReview, type ReviewPayload, type ReviewRow,
} from '../review/approveReview';
import { buildPrefilledPayload } from '../review/reviewPayload';

type Tab = 'activity' | 'profile' | 'review' | 'cashflow' | 'networth' | 'insurance' | 'portfolio' | 'monitor' | 'cfp' | 'formkit';

const maskSensitive = (value?: string | null, visiblePrefix = 10) => {
  if (!value) return '—';
  const raw = String(value);
  if (raw.length <= 4) return '****';
  return `${raw.slice(0, Math.min(visiblePrefix, raw.length - 4))}****`;
};

export default function ReviewTab({ client, clientId, onNavigateTab }: { client: any; clientId: string; onNavigateTab: (tab: Tab) => void }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [cashflow, setCashflow] = useState<any[]>([]);
  // Standing items (P2b 常设项目/计划) — their own needs_review rows join the
  // same 待分类队列 as cashflow_entries, clearly labelled so an advisor knows
  // which table a "confirm" will write back to.
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>('pending_reviews');
  const [resolveDrafts, setResolveDrafts] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // P4 复检/快照 — reviews, insurance policies (needed by computeSnapshot),
  // health_snapshots (to find the "previous" snapshot to reconcile against)
  // and asset_valuations (reconcile's per-asset market-change history).
  // `reviews` may not exist yet in every environment (P4 migration) — degrade
  // to an empty queue with a small notice rather than crashing the tab.
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsUnavailable, setReviewsUnavailable] = useState(false);
  const [policies, setPolicies] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // 顾问代填季度复检
  const [showQuarterlyForm, setShowQuarterlyForm] = useState(false);
  const [quarterlyPeriodEnd, setQuarterlyPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [quarterlyAssetValues, setQuarterlyAssetValues] = useState<Record<string, string>>({});
  const [quarterlyLiabValues, setQuarterlyLiabValues] = useState<Record<string, { balance: string; rate: string; payment: string }>>({});
  const [quarterlyNotes, setQuarterlyNotes] = useState('');
  const [creatingQuarterly, setCreatingQuarterly] = useState(false);

  // 年度全面复检
  const [showAnnualChecklist, setShowAnnualChecklist] = useState(false);
  const [annualChecks, setAnnualChecks] = useState({ items: false, policies: false, goals: false });
  const [creatingAnnual, setCreatingAnnual] = useState(false);

  async function load() {
    const [{ data: a }, { data: l }, { data: e }, { data: i }, { data: c }, { data: p }, { data: hs }] = await Promise.all([
      supabase.from('assets').select('*').eq('client_id', clientId).order('asset_type'),
      supabase.from('liabilities').select('*').eq('client_id', clientId).order('liability_type'),
      supabase.from('cashflow_entries').select('*').eq('client_id', clientId).order('direction').order('category'),
      supabase.from('cashflow_items').select('*').eq('client_id', clientId).order('direction').order('category'),
      supabase.from('cashflow_categories').select('*').order('sort_order'),
      supabase.from('insurance_policies').select('*').eq('client_id', clientId),
      supabase.from('health_snapshots').select('*').eq('client_id', clientId).order('snapshot_date'),
    ]);
    setAssets(a || []); setLiabilities(l || []); setCashflow(e || []); setItems(i || []); setCategories(c || []);
    setPolicies(p || []); setSnapshots(hs || []);

    try {
      const { data: rv, error } = await supabase.from('reviews').select('*').eq('client_id', clientId).order('period_end', { ascending: false });
      if (error) throw error;
      setReviews(rv || []);
      setReviewsUnavailable(false);
    } catch (e) {
      setReviews([]);
      setReviewsUnavailable(isMissingTableError(e as any));
    }

    try {
      const { data: v, error } = await supabase.from('asset_valuations').select('*').eq('client_id', clientId);
      if (error) throw error;
      setValuations(v || []);
    } catch {
      setValuations([]);
    }

    setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  const pendingReviews = reviews.filter(r => r.status === 'submitted');

  /** the most recent health_snapshot strictly before `periodEnd` — what a
   *  just-approved review's snapshot should reconcile against (决策 2 step 6). */
  function previousSnapshotFor(periodEnd: string): { snapshot_date: string; net_worth: number } | null {
    const prior = snapshots.filter((s: any) => s.snapshot_date < periodEnd);
    if (prior.length === 0) return null;
    const latest = prior[prior.length - 1]; // snapshots is loaded ordered by snapshot_date asc
    return { snapshot_date: latest.snapshot_date, net_worth: Number(latest.net_worth) || 0 };
  }

  async function handleApprove(review: any) {
    setApprovingId(review.id);
    setActionErrors(prev => ({ ...prev, [review.id]: '' }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const result = await approveReview(supabase as any, {
        review: {
          id: review.id,
          client_id: review.client_id,
          kind: review.kind,
          period_end: review.period_end,
          status: review.status,
          payload: (review.payload || {}) as ReviewPayload,
        } as ReviewRow,
        assets: assets.map(a => ({ id: a.id, asset_type: a.asset_type, current_value: a.current_value, ownership_pct: a.ownership_pct })),
        liabilities: liabilities.map(l => ({
          id: l.id, liability_type: l.liability_type, name: l.name,
          outstanding_balance: l.outstanding_balance, interest_rate: l.interest_rate,
          monthly_payment: l.monthly_payment, remaining_months: l.remaining_months,
          rate_type: l.rate_type, original_principal: l.original_principal, end_date: l.end_date,
        })),
        items,
        policies,
        client: { has_epf: client?.has_epf, date_of_birth: client?.date_of_birth },
        previousSnapshot: previousSnapshotFor(review.period_end),
        valuationsByAsset: Object.fromEntries(groupValuationsByAsset(valuations as any)),
        approvedBy: user?.id || '',
      });
      if (!result.ok) {
        setActionErrors(prev => ({ ...prev, [review.id]: result.error || t('Approval failed', '批准失败') }));
      } else {
        await load();
      }
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(review: any) {
    setRejectingId(review.id);
    setActionErrors(prev => ({ ...prev, [review.id]: '' }));
    try {
      const note = reviewNotes[review.id] ?? review.advisor_note ?? null;
      const result = await rejectReview(supabase as any, { reviewId: review.id, note });
      if (!result.ok) {
        setActionErrors(prev => ({ ...prev, [review.id]: result.error || t('Reject failed', '退回失败') }));
      } else {
        await load();
      }
    } finally {
      setRejectingId(null);
    }
  }

  function openQuarterlyForm() {
    const av: Record<string, string> = {};
    assets.forEach(a => { av[a.id] = String(a.current_value ?? 0); });
    const lv: Record<string, { balance: string; rate: string; payment: string }> = {};
    liabilities.forEach(l => {
      lv[l.id] = {
        balance: String(l.outstanding_balance ?? 0),
        rate: l.interest_rate == null ? '' : String(l.interest_rate),
        payment: l.monthly_payment == null ? '' : String(l.monthly_payment),
      };
    });
    setQuarterlyAssetValues(av);
    setQuarterlyLiabValues(lv);
    setQuarterlyNotes('');
    setQuarterlyPeriodEnd(new Date().toISOString().slice(0, 10));
    setShowQuarterlyForm(true);
  }

  async function submitQuarterlyReview() {
    setCreatingQuarterly(true);
    try {
      const payload: ReviewPayload = {
        assets: assets.map(a => ({
          asset_id: a.id,
          prev_value: a.current_value ?? 0,
          value: parseFloat(quarterlyAssetValues[a.id] ?? String(a.current_value ?? 0)) || 0,
        })),
        liabilities: liabilities.map(l => {
          const v = quarterlyLiabValues[l.id] ?? { balance: String(l.outstanding_balance ?? 0), rate: '', payment: '' };
          return {
            liability_id: l.id,
            prev_balance: l.outstanding_balance ?? 0,
            balance: parseFloat(v.balance) || 0,
            prev_rate: l.interest_rate ?? null,
            interest_rate: v.rate === '' ? null : parseFloat(v.rate),
            monthly_payment: v.payment === '' ? null : parseFloat(v.payment),
          };
        }),
        notes: quarterlyNotes || null,
      };
      await supabase.from('reviews').insert({
        client_id: clientId,
        kind: 'quarterly',
        period_end: quarterlyPeriodEnd,
        status: 'submitted',
        submitted_by: 'advisor',
        submitted_at: new Date().toISOString(),
        payload,
      });
      setShowQuarterlyForm(false);
      await load();
    } finally {
      setCreatingQuarterly(false);
    }
  }

  async function submitAnnualReview() {
    setCreatingAnnual(true);
    try {
      const payload = buildPrefilledPayload(
        assets.map(a => ({ id: a.id, asset_type: a.asset_type, current_value: a.current_value, ownership_pct: a.ownership_pct })),
        liabilities.map(l => ({
          id: l.id, liability_type: l.liability_type, name: l.name,
          outstanding_balance: l.outstanding_balance, interest_rate: l.interest_rate, monthly_payment: l.monthly_payment,
        })),
        t('Annual review: standing items, policies and goals/assumptions confirmed with the client.', '年度全面复检：已与客户确认常设项目、保单效力及目标与假设。'),
      );
      const periodEnd = new Date().toISOString().slice(0, 10);
      await supabase.from('reviews').insert({
        client_id: clientId,
        kind: 'annual',
        period_end: periodEnd,
        status: 'submitted',
        submitted_by: 'advisor',
        submitted_at: new Date().toISOString(),
        payload,
      });
      setShowAnnualChecklist(false);
      setAnnualChecks({ items: false, policies: false, goals: false });
      await load();
      onNavigateTab('cfp');
    } finally {
      setCreatingAnnual(false);
    }
  }

  const catLabel = (code: string) => { const c = categories.find(x => x.code === code); if (!c) return code; return language === 'zh' && c.label_zh ? c.label_zh : c.label; };

  const pendingEntries = cashflow.filter(e => e.needs_review);
  const pendingItems = items.filter(i => i.needs_review);
  const pendingCount = pendingEntries.length + pendingItems.length;

  // Resolving = picking the right category and saving; clears needs_review on
  // whichever table the row actually lives in (决策 4 in the P2b design: an
  // item's review is settled on cashflow_items, never on cashflow_entries).
  async function resolvePending(row: any, table: 'cashflow_entries' | 'cashflow_items') {
    const category = resolveDrafts[row.id] ?? row.category;
    if (!category) return;
    setResolvingId(row.id);
    await supabase.from(table).update({ category, needs_review: false, review_reason: null }).eq('id', row.id);
    setResolvingId(null);
    setResolveDrafts(prev => {
      if (!(row.id in prev)) return prev;
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    load();
  }
  const monthly = (e: any) => { const m: any = {monthly:1,quarterly:1/3,semi_annual:1/6,annual:1/12,one_off:0}; return e.amount * (m[e.frequency]??1); };
  const inflows = cashflow.filter(e => e.direction === 'inflow');
  const outflows = cashflow.filter(e => e.direction === 'outflow');
  const totalIn = inflows.reduce((s,e) => s+monthly(e), 0);
  const totalOut = outflows.reduce((s,e) => s+monthly(e), 0);
  const totalA = assets.reduce((s,a) => s+a.current_value, 0);
  const totalL = liabilities.reduce((s,l) => s+l.outstanding_balance, 0);

  const fullAddress = [client.correspondence_address, client.correspondence_city, client.correspondence_state, client.correspondence_postal_code].filter(Boolean).join(', ');

  if (loading) return <Loader />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 mb-2">
        {t('Go through each section with the client and confirm everything is correct. Use the links to jump to a tab and fix anything wrong.', '请与客户逐项核对以下资料是否正确。如有错误，可点击链接跳转到对应页面修改。')}
      </p>

      {reviewsUnavailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-700">
          {t('Review features are pending a database upgrade.', '复检功能待数据库升级后启用。')}
        </div>
      )}

      <Section id="pending_reviews" open={openSection} setOpen={setOpenSection} icon="📝" title={t('Pending Reviews','待审核复检')} count={pendingReviews.length} t={t}>
        {pendingReviews.length === 0 ? (
          <div className="py-6 text-center text-emerald-500 text-sm">✓ {t('No reviews awaiting approval.','没有待审核的复检。')}</div>
        ) : (
          pendingReviews.map(review => (
            <PendingReviewCard
              key={review.id}
              review={review}
              assets={assets}
              liabilities={liabilities}
              language={language}
              t={t}
              note={reviewNotes[review.id] ?? review.advisor_note ?? ''}
              onNoteChange={(v: string) => setReviewNotes(prev => ({ ...prev, [review.id]: v }))}
              onApprove={() => handleApprove(review)}
              onReject={() => handleReject(review)}
              approving={approvingId === review.id}
              rejecting={rejectingId === review.id}
              error={actionErrors[review.id]}
            />
          ))
        )}
      </Section>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-sm text-xin-blue flex items-center gap-2"><span>🗓️</span>{t('Advisor-Filled Quarterly Review','顾问代填季度复检')}</h3>
          {!showQuarterlyForm && (
            <button onClick={openQuarterlyForm} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-xin-blue text-white">
              {t('+ New','+ 新建')}
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">
          {t('Prefills current asset/liability figures — edit anything that changed, then submit for your own approval.', '预填当前资产/负债数据，修改有变化的部分后提交，随后可在上方审核批准。')}
        </p>
        {showQuarterlyForm && (
          <QuarterlyReviewForm
            assets={assets}
            liabilities={liabilities}
            periodEnd={quarterlyPeriodEnd}
            onPeriodEndChange={setQuarterlyPeriodEnd}
            assetValues={quarterlyAssetValues}
            onAssetValueChange={(id: string, v: string) => setQuarterlyAssetValues(prev => ({ ...prev, [id]: v }))}
            liabValues={quarterlyLiabValues}
            onLiabValueChange={(id: string, field: 'balance' | 'rate' | 'payment', v: string) =>
              setQuarterlyLiabValues(prev => ({ ...prev, [id]: { ...(prev[id] ?? { balance: '', rate: '', payment: '' }), [field]: v } }))}
            notes={quarterlyNotes}
            onNotesChange={setQuarterlyNotes}
            onCancel={() => setShowQuarterlyForm(false)}
            onSubmit={submitQuarterlyReview}
            submitting={creatingQuarterly}
            t={t}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-sm text-xin-blue flex items-center gap-2 mb-1"><span>📅</span>{t('Annual Full Review','年度全面复检')}</h3>
        <p className="text-xs text-slate-400 mb-3">
          {t('Go through the checklist with the client, then generate the CFP report.', '与客户逐项核对，然后进入 CFP 报告。')}
        </p>
        <label className="flex items-start gap-2.5 py-2 border-b border-slate-50 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={annualChecks.items} onChange={e => setAnnualChecks(p => ({ ...p, items: e.target.checked }))} />
          <span className="flex-1 text-sm text-xin-blue">
            {t('Standing items (income/expenses) confirmed or edited', '常设项目（收支）已确认或修改')}
            <button type="button" onClick={() => onNavigateTab('cashflow')} className="ml-2 text-xs font-semibold text-xin-gold hover:underline">{t('Open Cash Flow →','前往收支 →')}</button>
          </span>
        </label>
        <label className="flex items-start gap-2.5 py-2 border-b border-slate-50 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={annualChecks.policies} onChange={e => setAnnualChecks(p => ({ ...p, policies: e.target.checked }))} />
          <div className="flex-1">
            <span className="text-sm text-xin-blue">
              {t('Policies still in force?', '保单是否仍然有效？')}
              <button type="button" onClick={() => onNavigateTab('insurance')} className="ml-2 text-xs font-semibold text-xin-gold hover:underline">{t('Open Insurance →','前往保险 →')}</button>
            </span>
            {policies.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {policies.map((p: any) => (
                  <span key={p.id} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${p.status === 'in_force' || !p.status ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {p.plan_name || p.policy_type} {p.status && p.status !== 'in_force' ? `(${p.status})` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex items-start gap-2.5 py-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={annualChecks.goals} onChange={e => setAnnualChecks(p => ({ ...p, goals: e.target.checked }))} />
          <span className="text-sm text-xin-blue">{t('Goals and assumptions discussed with the client', '目标与假设已与客户讨论')}</span>
        </label>
        <button
          onClick={submitAnnualReview}
          disabled={!annualChecks.items || !annualChecks.policies || !annualChecks.goals || creatingAnnual}
          className="mt-4 w-full text-xs font-semibold px-4 py-2.5 rounded-xl bg-xin-blue text-white disabled:opacity-40"
        >
          {creatingAnnual ? t('Submitting…','提交中…') : t('Submit annual review → go to CFP report','提交年度复检 → 前往 CFP 报告')}
        </button>
      </div>

      <Section id="review_queue" open={openSection} setOpen={setOpenSection} icon="🏷️" title={t('Needs Review','待分类队列')} count={pendingCount} onEdit={() => onNavigateTab('cashflow')} t={t}>
        {pendingCount === 0 ? (
          <div className="py-6 text-center text-emerald-500 text-sm">✓ {t('Nothing pending classification.','没有待分类的项目。')}</div>
        ) : (
          <>
            {pendingItems.map(row => (
              <PendingRow
                key={`item-${row.id}`}
                row={row}
                badge={t('Standing item','常设项目')}
                categories={categories}
                language={language}
                t={t}
                resolving={resolvingId === row.id}
                draftValue={resolveDrafts[row.id]}
                onDraftChange={(v: string) => setResolveDrafts(p => ({ ...p, [row.id]: v }))}
                onResolve={() => resolvePending(row, 'cashflow_items')}
              />
            ))}
            {pendingEntries.map(row => (
              <PendingRow
                key={`entry-${row.id}`}
                row={row}
                badge={null}
                categories={categories}
                language={language}
                t={t}
                resolving={resolvingId === row.id}
                draftValue={resolveDrafts[row.id]}
                onDraftChange={(v: string) => setResolveDrafts(p => ({ ...p, [row.id]: v }))}
                onResolve={() => resolvePending(row, 'cashflow_entries')}
              />
            ))}
          </>
        )}
      </Section>

      <Section id="profile" open={openSection} setOpen={setOpenSection} icon="👤" title={t('Profile','个人资料')} onEdit={() => onNavigateTab('profile')} t={t}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={t('Personal','个人资料')}>
            <Row label={t('Salutation','称谓')}>{client.salutation || '—'}</Row>
            <Row label={t('Full Name','全名')}>{client.full_name || '—'}</Row>
            <Row label="NRIC">{maskSensitive(client.nric)}</Row>
            <Row label={t('Date of Birth','出生日期')}>{client.date_of_birth || '—'}</Row>
            <Row label={t('Gender','性别')}>{client.gender || '—'}</Row>
            <Row label={t('Nationality','国籍')}>{client.nationality || '—'}</Row>
            <Row label={t('Marital Status','婚姻状况')}>{client.marital_status || '—'}</Row>
            <Row label={t('Dependants','受赡养人')}>{String(client.number_of_dependants ?? 0)}</Row>
          </Card>
          <Card title={t('Contact & Address','联系与地址')}>
            <Row label={t('Phone','电话')}>{client.phone || '—'}</Row>
            <Row label={t('Email','邮箱')}>{client.email || '—'}</Row>
            <Row label={t('Address','地址')}>{fullAddress || '—'}</Row>
          </Card>
          <Card title={t('Employment','就业')}>
            <Row label={t('Status','状态')}>{client.employment_status || '—'}</Row>
            <Row label={t('Occupation','职业')}>{client.occupation || '—'}</Row>
            <Row label={t('Employer','雇主')}>{client.employer_name || '—'}</Row>
          </Card>
          <Card title={t('Financial Profile','财务资料')}>
            <Row label={t('Risk Profile','风险评级')}>{client.risk_profile || '—'}</Row>
            <Row label={t('Retirement Age','退休年龄')}>{String(client.retirement_age ?? '—')}</Row>
            <Row label="EPF No.">{client.epf_account_number || '—'}</Row>
            <Row label={t('Bank Account No.','银行账号')}>{maskSensitive(client.bank_account_number)}</Row>
          </Card>
        </div>
      </Section>

      <Section id="income" open={openSection} setOpen={setOpenSection} icon="💰" title={t('Income','收入')} count={inflows.length} onEdit={() => onNavigateTab('cashflow')} t={t}>
        {inflows.length === 0 ? <Empty t={t} /> : (
          <>
            {inflows.map(e => (
              <ReviewRow key={e.id} title={catLabel(e.category)} sub={`RM ${fmt(e.amount)} · ${e.frequency}${e.source_note ? ` · ${e.source_note}` : ''}`} value={`${fmt(monthly(e))}/mo`} color="text-emerald-600" />
            ))}
            <Total label={t('Total / month','月合计')} value={fmt(totalIn)} color="text-emerald-600" />
          </>
        )}
      </Section>

      <Section id="expenses" open={openSection} setOpen={setOpenSection} icon="💸" title={t('Expenses','支出')} count={outflows.length} onEdit={() => onNavigateTab('cashflow')} t={t}>
        {outflows.length === 0 ? <Empty t={t} /> : (
          <>
            {outflows.map(e => (
              <ReviewRow key={e.id} title={catLabel(e.category)} sub={`RM ${fmt(e.amount)} · ${e.frequency}${e.source_note ? ` · ${e.source_note}` : ''}`} value={`${fmt(monthly(e))}/mo`} color="text-red-500" />
            ))}
            <Total label={t('Total / month','月合计')} value={fmt(totalOut)} color="text-red-500" />
          </>
        )}
      </Section>

      <Section id="assets" open={openSection} setOpen={setOpenSection} icon="📈" title={t('Assets','资产')} count={assets.length} onEdit={() => onNavigateTab('networth')} t={t}>
        {assets.length === 0 ? <Empty t={t} /> : (
          <>
            {assets.map(a => (
              <ReviewRow key={a.id} title={a.name} sub={a.asset_type + (a.institution ? ` · ${a.institution}` : '')} value={`RM ${fmt(a.current_value)}`} color="text-emerald-600" />
            ))}
            <Total label={t('Total','合计')} value={fmt(totalA)} color="text-emerald-600" />
          </>
        )}
      </Section>

      <Section id="liabilities" open={openSection} setOpen={setOpenSection} icon="📉" title={t('Liabilities','负债')} count={liabilities.length} onEdit={() => onNavigateTab('networth')} t={t}>
        {liabilities.length === 0 ? <Empty t={t} /> : (
          <>
            {liabilities.map(l => (
              <ReviewRow key={l.id} title={l.name} sub={l.liability_type + (l.lender ? ` · ${l.lender}` : '') + (l.monthly_payment ? ` · RM${fmt(l.monthly_payment)}/mo` : '')} value={`RM ${fmt(l.outstanding_balance)}`} color="text-red-500" />
            ))}
            <Total label={t('Total','合计')} value={fmt(totalL)} color="text-red-500" />
          </>
        )}
      </Section>
    </div>
  );
}

const Section = ({ id, open, setOpen, icon, title, count, onEdit, t, children }: any) => {
  const isOpen = open === id;
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(isOpen ? null : id)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 font-semibold text-sm text-xin-blue">
          <span>{icon}</span>{title}
          {typeof count === 'number' && <span className="text-xs font-normal text-slate-400">({count})</span>}
        </span>
        {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5">
          {onEdit && (
            <div className="flex justify-end mb-3">
              <button onClick={onEdit} className="text-xs font-semibold text-xin-blue hover:text-xin-gold">
                {t('Go to tab to edit →','前往页面编辑 →')}
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
};
const Card = ({ title, children }: any) => (
  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 border-b border-slate-200 pb-2">{title}</h4>
    {children}
  </div>
);
const Row = ({ label, children }: any) => (
  <div className="flex items-center py-1.5 border-b border-slate-100 last:border-0 gap-2">
    <span className="w-32 shrink-0 text-xs text-slate-400 font-medium">{label}</span>
    <span className="flex-1 text-sm text-xin-blue">{children}</span>
  </div>
);
const ReviewRow = ({ title, sub, value, color }: any) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
    <div><div className="text-sm font-medium text-xin-blue">{title}</div><div className="text-xs text-slate-400">{sub}</div></div>
    <span className={`text-sm font-semibold ${color}`}>{value}</span>
  </div>
);
// One row of the 待分类队列 (Needs Review queue): a category picker plus a
// confirm button. `badge` marks rows sourced from cashflow_items (常设项目)
// so the advisor knows resolving it writes cashflow_items, not cashflow_entries.
const PendingRow = ({ row, badge, categories, language, t, resolving, draftValue, onDraftChange, onResolve }: any) => {
  const opts = categories.filter((c: any) => c.direction === row.direction);
  const label = row.name || row.source_note || (row.direction === 'inflow' ? t('Income','收入') : t('Expense','支出'));
  return (
    <div className="flex items-center justify-between gap-2 py-2.5 border-b border-slate-50 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{label}</span>
          {badge && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 shrink-0">{badge}</span>}
        </div>
        <div className="text-xs text-amber-600 truncate">{row.review_reason || t('Needs review','待分类')}</div>
      </div>
      <select
        value={draftValue ?? row.category}
        onChange={e => onDraftChange(e.target.value)}
        className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shrink-0 max-w-[9rem]"
      >
        {opts.map((c: any) => (
          <option key={c.code} value={c.code}>{language === 'zh' && c.label_zh ? c.label_zh : c.label}</option>
        ))}
      </select>
      <button
        onClick={onResolve}
        disabled={resolving}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-xin-blue text-white disabled:opacity-50 shrink-0"
      >
        {resolving ? '...' : t('Confirm','确认')}
      </button>
    </div>
  );
};
const Total = ({ label, value, color }: any) => (
  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
    <span className="text-xs font-semibold text-slate-500">{label}</span>
    <span className={`text-sm font-bold ${color}`}>RM {value}</span>
  </div>
);
const Empty = ({ t }: any) => <div className="py-6 text-center text-slate-300 text-sm">{t('No data submitted','未提交资料')}</div>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// One submitted review awaiting approval: a before/after table for assets
// and liabilities (决策 6), the advisor's note, and 批准/退回.
const PendingReviewCard = ({
  review, assets, liabilities, language, t, note, onNoteChange, onApprove, onReject, approving, rejecting, error,
}: any) => {
  const assetById = new Map(assets.map((a: any) => [a.id, a]));
  const liabById = new Map(liabilities.map((l: any) => [l.id, l]));
  const payloadAssets = review.payload?.assets || [];
  const payloadLiabilities = review.payload?.liabilities || [];
  const busy = approving || rejecting;

  return (
    <div className="border border-slate-100 rounded-xl p-4 mb-3 last:mb-0">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            {review.kind === 'annual' ? t('Annual','年度') : t('Quarterly','季度')}
          </span>
          <span className="text-sm font-semibold text-xin-blue">{t('Period ending','截止')} {review.period_end}</span>
          <span className="text-xs text-slate-400">
            {review.submitted_by === 'advisor' ? t('filled by advisor', '顾问代填') : t('submitted by client', '客户提交')}
          </span>
        </div>
      </div>

      {payloadAssets.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-400 mb-1.5">{t('Assets', '资产')}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="font-medium pb-1">{t('Asset', '资产')}</th>
                <th className="font-medium pb-1 text-right">{t('Before', '之前')}</th>
                <th className="font-medium pb-1 text-right">{t('Now', '现在')}</th>
                <th className="font-medium pb-1 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {payloadAssets.map((pa: any) => {
                const a: any = assetById.get(pa.asset_id);
                const delta = (Number(pa.value) || 0) - (Number(pa.prev_value) || 0);
                return (
                  <tr key={pa.asset_id} className="border-t border-slate-50">
                    <td className="py-1.5 text-xin-blue">{a?.name || pa.asset_id}</td>
                    <td className="py-1.5 text-right text-slate-500">{fmt(Number(pa.prev_value) || 0)}</td>
                    <td className="py-1.5 text-right font-semibold text-xin-blue">{fmt(Number(pa.value) || 0)}</td>
                    <td className={`py-1.5 text-right font-semibold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {delta > 0 ? '+' : ''}{fmt(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payloadLiabilities.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-slate-400 mb-1.5">{t('Liabilities', '负债')}</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="font-medium pb-1">{t('Liability', '负债')}</th>
                <th className="font-medium pb-1 text-right">{t('Balance', '余额')}</th>
                <th className="font-medium pb-1 text-right">{t('Rate', '利率')}</th>
                <th className="font-medium pb-1 text-right">{t('Monthly', '月供')}</th>
              </tr>
            </thead>
            <tbody>
              {payloadLiabilities.map((pl: any) => {
                const l: any = liabById.get(pl.liability_id);
                return (
                  <tr key={pl.liability_id} className="border-t border-slate-50">
                    <td className="py-1.5 text-xin-blue">{l?.name || pl.liability_id}</td>
                    <td className="py-1.5 text-right">
                      <span className="text-slate-500">{fmt(Number(pl.prev_balance) || 0)}</span>
                      <span className="text-slate-300 mx-1">→</span>
                      <span className="font-semibold text-xin-blue">{fmt(Number(pl.balance) || 0)}</span>
                    </td>
                    <td className="py-1.5 text-right text-slate-500">
                      {pl.prev_rate ?? '—'}{pl.prev_rate != null ? '%' : ''}
                      <span className="text-slate-300 mx-1">→</span>
                      {pl.interest_rate ?? '—'}{pl.interest_rate != null ? '%' : ''}
                    </td>
                    <td className="py-1.5 text-right text-slate-500">{pl.monthly_payment != null ? `RM ${fmt(pl.monthly_payment)}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {review.payload?.notes && (
        <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 mb-3">{review.payload.notes}</div>
      )}

      <textarea
        value={note}
        onChange={e => onNoteChange(e.target.value)}
        placeholder={t('Advisor note (optional, saved when you reject)', '顾问备注（可选，退回时会保存）')}
        rows={2}
        className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg mb-2 resize-none"
      />

      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onReject}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 disabled:opacity-50"
        >
          {rejecting ? '...' : t('Reject', '退回')}
        </button>
        <button
          onClick={onApprove}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
        >
          {approving ? '...' : t('Approve', '批准')}
        </button>
      </div>
    </div>
  );
};

// 顾问代填季度复检's editable prefill table.
const QuarterlyReviewForm = ({
  assets, liabilities, periodEnd, onPeriodEndChange, assetValues, onAssetValueChange,
  liabValues, onLiabValueChange, notes, onNotesChange, onCancel, onSubmit, submitting, t,
}: any) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-slate-500">{t('Period ending', '截止日期')}</label>
      <input
        type="date"
        value={periodEnd}
        onChange={e => onPeriodEndChange(e.target.value)}
        className="text-xs px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
      />
    </div>

    {assets.length > 0 && (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-medium pb-1">{t('Asset', '资产')}</th>
            <th className="font-medium pb-1">{t('Current value', '当前值')}</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a: any) => (
            <tr key={a.id} className="border-t border-slate-50">
              <td className="py-1.5 text-xin-blue">{a.name}</td>
              <td className="py-1.5">
                <input
                  type="number"
                  value={assetValues[a.id] ?? ''}
                  onChange={e => onAssetValueChange(a.id, e.target.value)}
                  className="w-28 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}

    {liabilities.length > 0 && (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 text-left">
            <th className="font-medium pb-1">{t('Liability', '负债')}</th>
            <th className="font-medium pb-1">{t('Balance', '余额')}</th>
            <th className="font-medium pb-1">{t('Rate %', '利率 %')}</th>
            <th className="font-medium pb-1">{t('Monthly', '月供')}</th>
          </tr>
        </thead>
        <tbody>
          {liabilities.map((l: any) => {
            const v = liabValues[l.id] ?? { balance: '', rate: '', payment: '' };
            return (
              <tr key={l.id} className="border-t border-slate-50">
                <td className="py-1.5 text-xin-blue">{l.name}</td>
                <td className="py-1.5"><input type="number" value={v.balance} onChange={e => onLiabValueChange(l.id, 'balance', e.target.value)} className="w-24 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg" /></td>
                <td className="py-1.5"><input type="number" value={v.rate} onChange={e => onLiabValueChange(l.id, 'rate', e.target.value)} className="w-16 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg" /></td>
                <td className="py-1.5"><input type="number" value={v.payment} onChange={e => onLiabValueChange(l.id, 'payment', e.target.value)} className="w-20 text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}

    <textarea
      value={notes}
      onChange={e => onNotesChange(e.target.value)}
      placeholder={t('Notes (optional)', '备注（可选）')}
      rows={2}
      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg resize-none"
    />

    <div className="flex gap-2 justify-end">
      <button onClick={onCancel} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500">
        {t('Cancel', '取消')}
      </button>
      <button onClick={onSubmit} disabled={submitting} className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-xin-blue text-white disabled:opacity-50">
        {submitting ? t('Submitting…', '提交中…') : t('Submit for approval', '提交待审核')}
      </button>
    </div>
  </div>
);
