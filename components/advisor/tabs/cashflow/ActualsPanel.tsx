import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X, Pencil, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import {
  isTransferCode, monthlyBreakdown, recordedYears, yearToDateTotals,
  type PeriodRow,
} from '../../../../supabase/functions/_shared/cashflow/periods';
import { categoryLabel, wealthEffectOf } from '../../../../supabase/functions/_shared/taxonomy/cashflow';
import {
  deriveLoanItems, derivePremiumItems, isSuperseded,
  type DerivedItem, type LiabilityRow, type PolicyRow, type PlanCashflowResult,
} from '../../../../supabase/functions/_shared/finance/derived';
import { CategorySelect, ENTRY_FREQ, Fr, MONTH_LABELS, Modal, fmt, inp, monthName, toPeriodMonth } from './shared';

// A cashflow entry records ONE MONTH'S actual figure for one category, so this
// section is organised by month. The totals shown here are ACTUALS — what the
// client earned and spent — not the annualised plan the StandingItemsPanel
// above shows. The two are different numbers on purpose and are never mixed:
// see _shared/cashflow/periods.ts, and the basis picker on the CFP tab.
//
// P2b decision: this is otherwise the SAME month-by-month interface as
// before P2b (moved here, into a collapsible section, from CashflowTab.tsx),
// with one addition — a "this month: plan vs actual" line.

const monthOfRow = (e: { period_month?: string | null }) =>
  Number(String(e.period_month ?? '').slice(5, 7)) || 0;

interface Props {
  clientId: string;
  entries: any[];
  liabilities: LiabilityRow[];
  policies: PolicyRow[];
  plan: PlanCashflowResult;
  language: string;
  t: (en: string, zh: string) => string;
  defaultOpen: boolean;
  onReload: () => void;
  onSaved: () => void;
}

export default function ActualsPanel({ clientId, entries, liabilities, policies, plan, language, t, defaultOpen, onReload, onSaved }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [modal, setModal] = useState<'inflow' | 'outflow' | null>(null);
  const [form, setForm] = useState({
    category: '', amount: '', frequency: 'monthly', is_recurring: true, source_note: '',
    month: new Date().getMonth() + 1,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [viewMonth, setViewMonth] = useState<number | 'all'>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const setEdit = (k: string, v: any) => setEditForm((p: any) => ({ ...p, [k]: v }));

  async function handleAdd() {
    if (!form.category || !form.amount) return;
    setSaving(true);
    await supabase.from('cashflow_entries').insert({
      client_id: clientId, direction: modal, category: form.category,
      amount: parseFloat(form.amount), frequency: form.frequency,
      is_recurring: form.is_recurring, source_note: form.source_note || null,
      period_month: toPeriodMonth(year, form.month),
    });
    setSaving(false); setModal(null);
    setForm({ category: '', amount: '', frequency: 'monthly', is_recurring: true, source_note: '', month: new Date().getMonth() + 1 });
    onSaved();
    onReload();
  }
  async function handleDelete(id: string) {
    if (!confirm(t('Delete this entry?', '确定删除？'))) return;
    await supabase.from('cashflow_entries').delete().eq('id', id);
    onSaved();
    onReload();
  }

  function startEdit(entry: any) {
    setEditingId(entry.id);
    setEditForm({
      category: entry.category,
      amount: String(entry.amount),
      frequency: entry.frequency,
      is_recurring: entry.is_recurring,
      source_note: entry.source_note || '',
      month: monthOfRow(entry) || new Date().getMonth() + 1,
    });
  }
  function cancelEdit() { setEditingId(null); setEditForm({}); }
  async function saveEdit(entry: any) {
    if (!editForm.category || !editForm.amount) return;
    setSavingEdit(true);
    await supabase.from('cashflow_entries').update({
      category: editForm.category,
      amount: parseFloat(editForm.amount),
      frequency: editForm.frequency,
      is_recurring: editForm.is_recurring,
      source_note: editForm.source_note || null,
      needs_review: false,
      review_reason: null,
      period_month: toPeriodMonth(
        Number(String(entry.period_month ?? '').slice(0, 4)) || year,
        editForm.month,
      ),
    }).eq('id', entry.id);
    setSavingEdit(false);
    setEditingId(null);
    onSaved();
    onReload();
  }

  // Installments (from liabilities) and premiums (from active policies),
  // computed at read time — not a manual row, never stored. Spec decisions 1/3.
  const derivedItems: DerivedItem[] = useMemo(
    () => [...deriveLoanItems(liabilities), ...derivePremiumItems(policies)],
    [liabilities, policies],
  );
  const derivedMonthlyExpense = useMemo(
    () => derivedItems.filter((d) => !isTransferCode(d.category)).reduce((s, d) => s + d.monthly_amount, 0),
    [derivedItems],
  );
  const supersededIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of entries) {
      if (e.direction === 'outflow' && isSuperseded(e, liabilities, policies)) ids.add(e.id);
    }
    return ids;
  }, [entries, liabilities, policies]);
  const totalledEntries = useMemo(
    () => entries.filter((e) => !supersededIds.has(e.id)),
    [entries, supersededIds],
  );

  const years = useMemo(() => {
    const found = recordedYears(totalledEntries as PeriodRow[]);
    return found.includes(now.getFullYear()) ? found : [now.getFullYear(), ...found];
  }, [totalledEntries]);

  useEffect(() => {
    if (years.length && !years.includes(year)) setYear(years[0]);
  }, [years]);

  const breakdown = useMemo(
    () => monthlyBreakdown(totalledEntries as PeriodRow[], year),
    [totalledEntries, year],
  );
  const ytd = useMemo(
    () => yearToDateTotals(totalledEntries as PeriodRow[], year),
    [totalledEntries, year],
  );

  const visible = entries.filter((e) => {
    if (Number(String(e.period_month ?? '').slice(0, 4)) !== year) return false;
    return viewMonth === 'all' || monthOfRow(e) === viewMonth;
  });
  const inflows = visible.filter((e) => e.direction === 'inflow');
  const outflows = visible.filter((e) => e.direction === 'outflow');

  const totalIn = viewMonth === 'all'
    ? ytd.income
    : (breakdown.find((m) => m.month === viewMonth)?.income ?? 0);
  const totalOut = viewMonth === 'all'
    ? ytd.expenses + derivedMonthlyExpense * Math.max(1, breakdown.length)
    : (breakdown.find((m) => m.month === viewMonth)?.expenses ?? 0) + derivedMonthlyExpense;
  const net = totalIn - totalOut;

  const monthNm = (m: number) => monthName(m, language);
  const rangeLabel = viewMonth === 'all'
    ? t(`${year} total`, `${year} 年累计`)
    : `${year} · ${monthNm(viewMonth)}`;

  // This month's plan vs actual — only meaningful for a single month, since
  // the plan itself is a monthly run-rate, not a year total.
  const monthActualExpense = viewMonth === 'all' ? null : (breakdown.find((m) => m.month === viewMonth)?.expenses ?? 0);
  const planMonthlyExpense = plan.totals.monthly_expenses;
  const planDiff = monthActualExpense == null ? null : monthActualExpense - planMonthlyExpense;

  const thinMonths = breakdown.length > 1
    ? breakdown.filter((m) => m.entries === 1 && breakdown.some((o) => o.entries >= 3))
    : [];
  const catLabel = (code: string) => categoryLabel(code, language === 'zh' ? 'zh' : 'en');

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors"
      >
        <span className="font-semibold text-sm text-xin-blue flex items-center gap-1.5">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t('Actual records (by month)', '实际记录（按月）')}
        </span>
        <span className="text-[11px] text-slate-400">{t(`${entries.length} entries recorded`, `已记录 ${entries.length} 笔`)}</span>
      </button>
      {open && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <select
              value={year}
              onChange={(e) => { setYear(Number(e.target.value)); setViewMonth('all'); }}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-xin-blue focus:outline-none focus:border-xin-gold"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => setViewMonth('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMonth === 'all' ? 'bg-xin-blue text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t('Full year', '全年')}
              </button>
              {MONTH_LABELS.map((_, i) => {
                const m = i + 1;
                const has = breakdown.find((b) => b.month === m);
                return (
                  <button
                    key={m}
                    onClick={() => setViewMonth(m)}
                    title={has ? t(`${has.entries} entries`, `${has.entries} 笔记录`) : t('no data', '无记录')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      viewMonth === m
                        ? 'bg-xin-blue text-white'
                        : has
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-white text-slate-300 border border-slate-100'
                    }`}
                  >
                    {monthNm(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: t('Income', '收入'), val: totalIn, c: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: t('Expenses', '支出'), val: totalOut, c: 'text-red-500', bg: 'bg-red-50' },
              { label: t('Net', '净现金流'), val: net, c: net >= 0 ? 'text-xin-blue' : 'text-red-500', bg: net >= 0 ? 'bg-blue-50' : 'bg-red-50' },
            ].map((card) => (
              <div key={card.label} className={`${card.bg} rounded-2xl p-4`}>
                <div className="text-xs text-slate-500 font-medium mb-1">{card.label} · {rangeLabel}</div>
                <div className={`text-2xl font-bold ${card.c}`}>RM {fmt(card.val)}</div>
              </div>
            ))}
          </div>

          {planDiff != null && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 mb-4 text-xs text-slate-600">
              {t(
                `This month — plan RM ${fmt(planMonthlyExpense)} · actual RM ${fmt(monthActualExpense as number)} · `,
                `本月计划 RM ${fmt(planMonthlyExpense)} · 实际 RM ${fmt(monthActualExpense as number)} · `,
              )}
              <span className={planDiff > 0 ? 'text-red-500 font-semibold' : planDiff < 0 ? 'text-emerald-600 font-semibold' : ''}>
                {t(`difference RM ${planDiff >= 0 ? '+' : ''}${fmt(planDiff)}`, `差额 RM ${planDiff >= 0 ? '+' : ''}${fmt(planDiff)}`)}
              </span>
            </div>
          )}

          {viewMonth === 'all' && breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-4 overflow-hidden">
              <div className="px-5 py-2.5 border-b border-slate-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  {t(`Month by month · ${year}`, `${year} 年分月记录`)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {t(`${breakdown.length} of 12 months recorded`, `12 个月中已记录 ${breakdown.length} 个`)}
                </span>
              </div>
              {breakdown.map((m) => (
                <button
                  key={m.month}
                  onClick={() => setViewMonth(m.month)}
                  className="w-full flex items-center gap-3 px-5 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  <span className="w-12 text-xs font-semibold text-xin-blue">{monthNm(m.month)}</span>
                  <span className="text-xs text-emerald-600 w-28">+RM {fmt(m.income)}</span>
                  <span className="text-xs text-red-500 w-28">−RM {fmt(m.expenses)}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {t(`${m.entries} entries`, `${m.entries} 笔`)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {thinMonths.length > 0 && viewMonth === 'all' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
              <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                {t(
                  `${thinMonths.map((m) => monthNm(m.month)).join(', ')} holds a single entry while other months hold several. If that month is only half entered, any plan averaged across it will understate this client.`,
                  `${thinMonths.map((m) => monthNm(m.month)).join('、')}只有一笔记录，其他月份有好几笔。如果这个月只录了一半，任何把它平均进去的规划都会低估这位客户。`,
                )}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <EntryTable title={t('Income', '收入')} color="text-emerald-600" borderColor="border-emerald-200" entries={inflows} direction="inflow" catLabel={catLabel} monthName={monthNm} showMonth={viewMonth === 'all'} onAdd={() => setModal('inflow')} onDelete={handleDelete} addLabel={t('Add Income', '添加收入')}
              editingId={editingId} editForm={editForm} setEdit={setEdit} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit} t={t} language={language} />
            <EntryTable title={t('Expenses', '支出')} color="text-red-500" borderColor="border-red-200" entries={outflows} direction="outflow" catLabel={catLabel} monthName={monthNm} showMonth={viewMonth === 'all'} onAdd={() => setModal('outflow')} onDelete={handleDelete} addLabel={t('Add Expense', '添加支出')}
              editingId={editingId} editForm={editForm} setEdit={setEdit} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit} t={t} language={language}
              derivedItems={derivedItems} supersededIds={supersededIds} extraTotal={viewMonth === 'all' ? derivedMonthlyExpense * Math.max(1, breakdown.length) : derivedMonthlyExpense} />
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            {t(
              'Installments and premiums marked "Auto" are read from the Net worth and Insurance tabs, not entered here.',
              '标记「自动」的月供和保费来自「净资产」和「保险」标签页，无需在此重复录入。',
            )}
          </div>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'inflow' ? t('Add Income', '添加收入') : t('Add Expense', '添加支出')} onClose={() => setModal(null)}>
          <Fr label={t('Category', '类别')}>
            <CategorySelect direction={modal} value={form.category} onChange={(v) => set('category', v)} language={language} allowEmpty />
          </Fr>
          <Fr label={t('Amount (MYR)', '金额 (MYR)')}><input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inp} placeholder="0.00" /></Fr>
          <Fr label={t('Frequency', '频率')}>
            <select value={form.frequency} onChange={(e) => set('frequency', e.target.value)} className={inp}>
              {ENTRY_FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Fr>
          <Fr label={t('Belongs to month', '归属月份')}>
            <select value={form.month} onChange={(e) => set('month', Number(e.target.value))} className={inp}>
              {MONTH_LABELS.map((_, i) => (
                <option key={i + 1} value={i + 1}>{monthNm(i + 1)}</option>
              ))}
            </select>
          </Fr>
          <Fr label={t('Note', '备注')}><input value={form.source_note} onChange={(e) => set('source_note', e.target.value)} className={inp} /></Fr>
          <div className="flex items-center gap-2 mb-4"><input type="checkbox" checked={form.is_recurring} onChange={(e) => set('is_recurring', e.target.checked)} /><label className="text-sm text-slate-600">{t('Recurring', '定期')}</label></div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving ? '...' : t('Save', '保存')}</button>
            <button onClick={() => setModal(null)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EntryTable({ title, color, borderColor, entries, direction, catLabel, monthName, showMonth, onAdd, onDelete, addLabel, editingId, editForm, setEdit, onEdit, onCancelEdit, onSaveEdit, savingEdit, t, language, derivedItems, supersededIds, extraTotal }: any) {
  const isTransfer = (e: any) => wealthEffectOf(e.category, e.direction) === 'transfer';
  const isSupersededRow = (e: any) => !!supersededIds?.has(e.id);
  const total = entries.filter((e: any) => !isTransfer(e) && !isSupersededRow(e)).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0) + Number(extraTotal ?? 0);
  const transferTotal = entries.filter(isTransfer).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
  const hasDerived = (derivedItems?.length ?? 0) > 0;
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} overflow-hidden shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        <button onClick={onAdd} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${color}`}><Plus size={12} />{addLabel}</button>
      </div>
      {entries.length === 0 && !hasDerived ? <div className="p-8 text-center text-slate-300 text-sm">—</div> : (
        <>
          {entries.map((e: any) => (
            editingId === e.id ? (
              <div key={e.id} className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/60">
                <Fr label={t('Category', '类别')}>
                  <CategorySelect direction={direction} value={editForm.category} onChange={(v: string) => setEdit('category', v)} language={language} />
                </Fr>
                <Fr label={t('Amount (MYR)', '金额 (MYR)')}><input type="number" value={editForm.amount} onChange={(ev) => setEdit('amount', ev.target.value)} className={inp} placeholder="0.00" /></Fr>
                <Fr label={t('Frequency', '频率')}>
                  <select value={editForm.frequency} onChange={(ev) => setEdit('frequency', ev.target.value)} className={inp}>
                    {ENTRY_FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Fr>
                <Fr label={t('Belongs to month', '归属月份')}>
                  <select value={editForm.month} onChange={(ev) => setEdit('month', Number(ev.target.value))} className={inp}>
                    {MONTH_LABELS.map((_, i) => (
                      <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>
                    ))}
                  </select>
                </Fr>
                <Fr label={t('Note', '备注')}><input value={editForm.source_note} onChange={(ev) => setEdit('source_note', ev.target.value)} className={inp} /></Fr>
                <div className="flex items-center gap-2 mb-3"><input type="checkbox" checked={editForm.is_recurring} onChange={(ev) => setEdit('is_recurring', ev.target.checked)} /><label className="text-sm text-slate-600">{t('Recurring', '定期')}</label></div>
                <div className="flex gap-2">
                  <button onClick={() => onSaveEdit(e)} disabled={savingEdit} className="px-4 py-2 bg-xin-blue text-white font-semibold rounded-lg text-sm disabled:opacity-50">{savingEdit ? '...' : t('Save', '保存')}</button>
                  <button onClick={onCancelEdit} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm">{t('Cancel', '取消')}</button>
                </div>
              </div>
            ) : (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(e.category)}
                    {isTransfer(e) && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{t('Transfer', '资产转移')}</span>}
                    {isSupersededRow(e) && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t('Replaced by liability/policy', '已由负债/保单取代')}</span>}
                    {e.needs_review && <span title={e.review_reason || ''} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{t('Needs review', '待分类')}</span>}
                  </div>
                  <div className="text-xs text-slate-400">
                    {showMonth ? `${monthName(Number(String(e.period_month ?? '').slice(5, 7)))} · ` : ''}
                    {e.frequency !== 'monthly' ? `${e.frequency} · ` : ''}
                    {e.source_note || t('no note', '无备注')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${color}`}>RM {fmt(Number(e.amount ?? 0))}</span>
                  <button onClick={() => onEdit(e)} className="text-slate-300 hover:text-xin-blue transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => onDelete(e.id)} className="text-slate-300 hover:text-red-400 transition-colors"><X size={14} /></button>
                </div>
              </div>
            )
          ))}
          {(derivedItems ?? []).map((d: DerivedItem) => (
            <div key={d.key} className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(d.category)}
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t('Auto', '自动')}</span>
                    {d.estimated.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{t('Estimated', '估算')}</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{d.source_name}</div>
                  {d.source_type === 'liability' && (
                    <div className="text-[11px] text-slate-400">
                      {t(
                        `Principal RM ${fmt(d.principal_monthly)} · Interest RM ${fmt(d.interest_monthly)}`,
                        `本金 RM ${fmt(d.principal_monthly)} · 利息 RM ${fmt(d.interest_monthly)}`,
                      )}
                    </div>
                  )}
                </div>
                <span className={`text-sm font-semibold shrink-0 ${color}`}>RM {fmt(d.monthly_amount)}</span>
              </div>
              {d.warnings.map((w: string, i: number) => (
                <div key={i} className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                  <AlertTriangle size={11} className="shrink-0" />{w}
                </div>
              ))}
            </div>
          ))}
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500">{t('Total', '合计')}</span>
            <span className={`text-sm font-bold ${color}`}>RM {fmt(total)}</span>
          </div>
          {transferTotal > 0 && (
            <div className="flex items-center justify-between px-5 py-2 bg-slate-50 text-xs text-slate-500">
              <span>{t('Transfers (not in total)', '资产转移（不计入合计）')}</span>
              <span>RM {fmt(transferTotal)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
