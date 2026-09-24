import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { AlertTriangle, Info } from 'lucide-react';
import { defaultBasis, type PeriodRow } from '../../../supabase/functions/_shared/cashflow/periods';
import {
  annualizeItems, itemsFromMonthRows, type MonthRow, type StandingItem,
} from '../../../supabase/functions/_shared/cashflow/items';
import {
  planCashflow, type LiabilityRow, type PolicyRow,
} from '../../../supabase/functions/_shared/finance/derived';
import { fmt, fmt2, Loader } from './cashflow/shared';
import type { AssetOption } from './cashflow/shared';
import type { StandingItemRow } from './cashflow/standingItemRows';
import StandingItemsPanel from './cashflow/StandingItemsPanel';
import ActualsPanel from './cashflow/ActualsPanel';
import {
  buildStatutoryBreakdown, buildWaterfallRows, hasManualIncomeTaxItem,
  type StatutoryBreakdownKey, type WaterfallRowKey,
} from './cashflow/waterfall';

// CFP P2b — 现金流页. The plan (cashflow_items, "常设项目") is now the primary
// view: a standing item is defined once (amount + frequency + effective
// period) and a raise or a new expense either corrects it in place or opens a
// new version from the month it actually changed — it is never "recorded"
// into a specific month the way an actuals row is. See
// docs/superpowers/specs/2026-09-25-cfp-p2b-standing-items-design.md.
//
// A client with no items yet falls back to the OLD actuals-average algorithm
// (spec 决策 1) — the month-by-month actuals interface (ActualsPanel) still
// exists underneath, collapsed once a client has a plan, because
// cashflow_entries keeps recording what actually happened every month
// (LevelUp's optional client-entered actuals, spec §5.2).

interface ClientEpfInfo {
  has_epf: boolean | null;
  date_of_birth: string | null;
  tax_residency: string | null;
}

export default function CashflowTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  const [entries, setEntries] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [items, setItems] = useState<StandingItemRow[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [client, setClient] = useState<ClientEpfInfo>({ has_epf: false, date_of_birth: null, tax_residency: null });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ok, setOk] = useState(false);

  const today = useMemo(() => new Date(), []);

  async function load() {
    const [{ data: e }, { data: l }, { data: p }, { data: it }, { data: cl }, { data: as }] = await Promise.all([
      supabase.from('cashflow_entries').select('*')
        .eq('client_id', clientId).order('direction').order('category'),
      supabase.from('liabilities')
        .select('id, name, liability_type, outstanding_balance, interest_rate, monthly_payment, remaining_months, rate_type, original_principal, end_date')
        .eq('client_id', clientId),
      supabase.from('insurance_policies')
        .select('id, policy_type, plan_name, provider, premium, premium_frequency, end_date')
        .eq('client_id', clientId),
      supabase.from('cashflow_items').select('*').eq('client_id', clientId),
      supabase.from('clients').select('has_epf, date_of_birth, tax_residency').eq('id', clientId).maybeSingle(),
      supabase.from('assets').select('id, name, asset_type').eq('client_id', clientId).order('asset_type'),
    ]);
    setEntries(e || []);
    setLiabilities((l || []) as LiabilityRow[]);
    setPolicies((p || []) as PolicyRow[]);
    setItems((it || []) as StandingItemRow[]);
    setClient((cl || { has_epf: false, date_of_birth: null, tax_residency: null }) as ClientEpfInfo);
    setAssets((as || []) as AssetOption[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  function flashSaved() {
    setOk(true);
    setTimeout(() => setOk(false), 3000);
  }

  // 决策 1: with any items, the plan is read from them; a client with none
  // falls back to the actuals-average algorithm — planCashflow itself decides
  // which, based on whether `items` is non-empty.
  const plan = useMemo(() => planCashflow({
    rows: entries as PeriodRow[],
    liabilities,
    policies,
    basis: defaultBasis(entries as PeriodRow[]),
    today,
    items,
    client: { has_epf: client.has_epf, date_of_birth: client.date_of_birth, tax_residency: client.tax_residency },
  }), [entries, liabilities, policies, items, client, today]);

  // planCashflow pre-filters to items active "now" before handing them to
  // annualizeItems, which narrows its one_off window (asOf ±11/12 months) to
  // only one-offs landing in the CURRENT month — see the note in the final
  // report. Calling annualizeItems directly on the full (unfiltered) item
  // list here sidesteps that and gets the window the spec actually asks for.
  const oneOffItems: StandingItem[] = useMemo(
    () => annualizeItems(items, today).one_off_items,
    [items, today],
  );

  // P2b followup — the cash-flow summary waterfall (总收入 → 税与法定扣款 →
  // 实得收入 → 开销 → 可储蓄金额 → 定期储蓄/投资 → 净现金流). Every row's
  // figure comes straight off `plan`'s own fields (buildWaterfallRows does no
  // re-derivation), so they add up exactly. `manualIncomeTax` picks the
  // 所得税 vs 所得税（估算）label the same way planCashflow itself decided
  // whether to add the automatic estimate.
  const waterfallRows = useMemo(() => buildWaterfallRows(plan), [plan]);
  const statutoryBreakdown = useMemo(() => buildStatutoryBreakdown(plan), [plan]);
  const manualIncomeTax = useMemo(() => hasManualIncomeTaxItem(items, today), [items, today]);

  async function toggleHasEpf(checked: boolean) {
    const prev = client;
    setClient((c) => ({ ...c, has_epf: checked }));
    const { error } = await supabase.from('clients').update({ has_epf: checked }).eq('id', clientId);
    if (error) setClient(prev);
  }

  async function generateFromActuals() {
    setGenerating(true);
    const basis = defaultBasis(entries as PeriodRow[]);
    const migrated = itemsFromMonthRows(entries as MonthRow[], basis);
    if (migrated.length > 0) {
      const rows = migrated.map(({ source_ids, divisor, ...rest }) => ({
        ...rest,
        client_id: clientId,
        // This is an advisor-triggered action from the live UI, not the P2b
        // Task E one-time backfill (which stamps source:'migrated') — flag it
        // as an ordinary advisor entry so it reads and behaves like one.
        source: 'advisor',
      }));
      await supabase.from('cashflow_items').insert(rows);
    }
    setGenerating(false);
    flashSaved();
    load();
  }

  if (loading) return <Loader />;

  function waterfallLabel(key: WaterfallRowKey): string {
    switch (key) {
      case 'gross_income': return t('Total income', '总收入');
      case 'tax_and_statutory': return t('Tax & statutory deductions', '税与法定扣款');
      case 'take_home': return t('Take-home income', '实得收入');
      case 'living': return t('Living costs, installments & premiums', '开销');
      case 'savable': return t('Savable amount', '可储蓄金额');
      case 'planned_savings': return t('Planned savings / investing', '定期储蓄/投资');
      case 'net_cash_flow': return t('Net cash flow', '净现金流');
    }
  }

  function statutoryLabel(key: StatutoryBreakdownKey): string {
    switch (key) {
      case 'epf_employee': return t('EPF (employee)', 'EPF 雇员');
      case 'socso_eis': return t('SOCSO/EIS', 'SOCSO/EIS');
      case 'income_tax': return manualIncomeTax ? t('Income tax', '所得税') : t('Income tax (estimated)', '所得税（估算）');
    }
  }

  return (
    <div>
      {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm mb-4">✓ {t('Saved successfully.', '保存成功。')}</div>}

      <label className="flex items-center gap-2 text-sm text-slate-600 mb-4 cursor-pointer select-none">
        <input type="checkbox" checked={!!client.has_epf} onChange={(e) => toggleHasEpf(e.target.checked)} />
        {t('Employed, EPF/SOCSO deductions apply (auto-calculates EPF, SOCSO, EIS)', '受雇，有 EPF/SOCSO 扣款（自动计算 EPF、SOCSO、EIS）')}
      </label>

      {items.length === 0 && entries.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            {t('This client has no standing items yet — the plan is temporarily using monthly actuals.', '此客户还没有常设项目，计划暂用按月实际数。')}
          </div>
          <button onClick={generateFromActuals} disabled={generating} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
            {generating ? '...' : t('Generate standing items from actuals', '从实际数生成常设项目')}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 mb-2">
        {waterfallRows.map((row) => {
          const isHeadline = row.kind === 'headline';
          const isSubtotal = row.kind === 'subtotal';
          const isDeduction = row.kind === 'deduction';
          const amountColor = isHeadline
            ? (row.amount < 0 ? 'text-red-500' : 'text-xin-blue')
            : isDeduction ? 'text-red-500' : row.kind === 'total' ? 'text-emerald-600' : 'text-slate-700';
          return (
            <div key={row.key}>
              <div
                className={`flex items-center justify-between gap-3 py-2 ${isSubtotal ? 'border-t border-slate-100' : ''} ${isHeadline ? 'border-t-2 border-slate-200 mt-1 pt-3' : ''}`}
              >
                <span className={`flex items-center gap-1.5 ${isHeadline ? 'text-sm font-bold text-slate-700' : isSubtotal ? 'text-sm font-semibold text-slate-600' : 'text-xs text-slate-500'}`}>
                  {isDeduction && <span className="text-slate-300">−</span>}
                  {(isSubtotal || isHeadline) && <span className="text-slate-300">=</span>}
                  {waterfallLabel(row.key)}
                </span>
                <span className={`${isHeadline ? 'text-2xl font-extrabold' : isSubtotal ? 'text-base font-bold' : 'text-sm font-semibold'} ${amountColor}`}>
                  RM {fmt2(row.amount)}
                </span>
              </div>
              {row.key === 'tax_and_statutory' && statutoryBreakdown.length > 0 && (
                <div className="pl-4 pb-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
                  {statutoryBreakdown.map((b) => (
                    <span key={b.key}>{statutoryLabel(b.key)} RM {fmt2(b.amount)}</span>
                  ))}
                </div>
              )}
              {row.key === 'living' && (
                <div className="pl-4 pb-1.5 text-[11px] text-slate-400">
                  {t('Living costs + loan installments + insurance premiums', '生活开销 + 月供 + 保费')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {plan.monthly_employer_epf > 0 && (
        <div className="text-xs text-slate-500 mb-4 flex items-center gap-1.5">
          <Info size={12} className="shrink-0" />
          {t(
            `Employer EPF RM ${fmt(plan.monthly_employer_epf)}/month (goes straight into EPF, not counted in income totals)`,
            `雇主 EPF RM ${fmt(plan.monthly_employer_epf)}/月（直接进入 EPF，不计入收入合计）`,
          )}
        </div>
      )}

      <StandingItemsPanel
        clientId={clientId}
        items={items}
        plan={plan}
        oneOffItems={oneOffItems}
        assets={assets}
        liabilities={liabilities}
        policies={policies}
        language={language}
        t={t}
        onReload={load}
        onSaved={flashSaved}
      />

      <ActualsPanel
        clientId={clientId}
        entries={entries}
        liabilities={liabilities}
        policies={policies}
        plan={plan}
        language={language}
        t={t}
        defaultOpen={items.length === 0}
        onReload={load}
        onSaved={flashSaved}
      />
    </div>
  );
}
