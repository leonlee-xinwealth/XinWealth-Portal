import React, { useMemo, useState } from 'react';
import { Plus, Pencil, CalendarClock, Ban, Trash2, AlertTriangle, History } from 'lucide-react';
import { supabase } from '../../../../lib/supabaseClient';
import {
  endItem, itemMonthlyAmount, reviseItem,
  type StandingItem,
} from '../../../../supabase/functions/_shared/cashflow/items';
import { isTransferCode } from '../../../../supabase/functions/_shared/cashflow/periods';
import { categoryLabel, wealthEffectOf } from '../../../../supabase/functions/_shared/taxonomy/cashflow';
import type { DerivedItem, LiabilityRow, PolicyRow, PlanCashflowResult } from '../../../../supabase/functions/_shared/finance/derived';
import { isItemEnded, monthLabel, visibleStandingItems, type StandingItemRow } from './standingItemRows';
import {
  AssetSelect, CategorySelect, Fr, Modal, fmt, freqLabel, inp, currentMonthInput,
  ITEM_FREQUENCIES, type AssetOption,
} from './shared';

type Direction = 'inflow' | 'outflow';

interface Props {
  clientId: string;
  items: StandingItemRow[];
  plan: PlanCashflowResult;
  oneOffItems: StandingItem[];
  assets: AssetOption[];
  liabilities: LiabilityRow[];
  policies: PolicyRow[];
  language: string;
  t: (en: string, zh: string) => string;
  onReload: () => void;
  onSaved: () => void;
}

const emptyAddForm = () => ({
  category: '', amount: '', frequency: 'monthly', month: currentMonthInput(), name: '', linked_asset_id: '',
});

export default function StandingItemsPanel({
  clientId, items, plan, oneOffItems, assets, liabilities, policies, language, t, onReload, onSaved,
}: Props) {
  const lang: 'zh' | 'en' = language === 'zh' ? 'zh' : 'en';
  const catLabel = (code: string) => categoryLabel(code, lang);
  const [showHistory, setShowHistory] = useState(false);
  const today = useMemo(() => new Date(), []);

  const [addModal, setAddModal] = useState<Direction | null>(null);
  const [addForm, setAddForm] = useState(emptyAddForm());
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const [revising, setRevising] = useState<StandingItemRow | null>(null);
  const [reviseForm, setReviseForm] = useState<any>({});
  const [savingRevise, setSavingRevise] = useState(false);

  const [ending, setEnding] = useState<StandingItemRow | null>(null);
  const [endMonth, setEndMonth] = useState(currentMonthInput());
  const [savingEnd, setSavingEnd] = useState(false);

  // 决策 8: the same P2a dedupe rule applied to items — a manual item that
  // now duplicates a liability/policy installment is dropped from the plan's
  // totals (planCashflow already did that), but still shown here with a
  // chip so the advisor sees why the number moved.
  const supersededIds = useMemo(() => {
    const ids = new Set<string>();
    if (plan.source === 'items') {
      for (const s of plan.superseded as StandingItem[]) {
        if ((s as StandingItemRow).id) ids.add((s as StandingItemRow).id);
      }
    }
    return ids;
  }, [plan]);

  const inflowRows = useMemo(() => visibleStandingItems(items, 'inflow', today, showHistory), [items, today, showHistory]);
  const outflowRows = useMemo(() => visibleStandingItems(items, 'outflow', today, showHistory), [items, today, showHistory]);
  const derivedOutflow = plan.derived; // P2a installments/premiums + D2 statutory — always outflow

  function startAdd(direction: Direction) {
    setAddForm(emptyAddForm());
    setAddModal(direction);
  }

  async function handleAdd() {
    if (!addModal || !addForm.category || !addForm.amount) return;
    setSaving(true);
    const from = `${addForm.month}-01`;
    await supabase.from('cashflow_items').insert({
      client_id: clientId,
      direction: addModal,
      category: addForm.category,
      name: addForm.name || null,
      amount: parseFloat(addForm.amount),
      frequency: addForm.frequency,
      effective_from: from,
      effective_to: addForm.frequency === 'one_off' ? from : null,
      linked_asset_id: addForm.linked_asset_id || null,
      source: 'advisor',
    });
    setSaving(false);
    setAddModal(null);
    onSaved();
    onReload();
  }

  function startEdit(item: StandingItemRow) {
    setEditingId(item.id);
    setEditForm({
      category: item.category,
      amount: String(item.amount),
      frequency: item.frequency,
      name: item.name || '',
      linked_asset_id: item.linked_asset_id || '',
      month: monthLabel(item.effective_from) || currentMonthInput(),
    });
  }
  function cancelEdit() { setEditingId(null); setEditForm({}); }

  // 更正 — fixed in place. Passing the item's OWN effective_from as the
  // "from" month guarantees reviseItem returns { mode: 'correct' } (决策 3:
  // you cannot open a new version before or at an item's own start).
  async function saveEdit(item: StandingItemRow) {
    if (!editForm.category || !editForm.amount) return;
    setSavingEdit(true);
    const result = reviseItem(item, {
      category: editForm.category,
      amount: parseFloat(editForm.amount),
      frequency: editForm.frequency,
      name: editForm.name || null,
      linked_asset_id: editForm.linked_asset_id || null,
      effective_from: `${editForm.month}-01`,
      needs_review: false,
      review_reason: null,
    }, item.effective_from);
    if (result.mode === 'correct') {
      await supabase.from('cashflow_items').update(result.update).eq('id', item.id);
    }
    setSavingEdit(false);
    setEditingId(null);
    onSaved();
    onReload();
  }

  function startRevise(item: StandingItemRow) {
    setRevising(item);
    setReviseForm({
      category: item.category,
      amount: String(item.amount),
      frequency: item.frequency,
      name: item.name || '',
      linked_asset_id: item.linked_asset_id || '',
      month: currentMonthInput(),
    });
  }

  // 变更 — a real change from month M onward (决策 3). If M lands at or
  // before the item's own start, reviseItem falls back to a plain correction
  // (there is no "before" to preserve), which is intentional.
  async function saveRevise() {
    if (!revising || !reviseForm.category || !reviseForm.amount) return;
    setSavingRevise(true);
    const result = reviseItem(revising, {
      category: reviseForm.category,
      amount: parseFloat(reviseForm.amount),
      frequency: reviseForm.frequency,
      name: reviseForm.name || null,
      linked_asset_id: reviseForm.linked_asset_id || null,
      source: 'advisor',
      needs_review: false,
      review_reason: null,
    }, `${reviseForm.month}-01`);

    if (result.mode === 'version') {
      await supabase.from('cashflow_items').update({ effective_to: result.close.effective_to }).eq('id', result.close.id);
      const { source_ids, divisor, ...insert } = result.insert as any;
      await supabase.from('cashflow_items').insert(insert);
    } else {
      await supabase.from('cashflow_items').update(result.update).eq('id', revising.id);
    }
    setSavingRevise(false);
    setRevising(null);
    onSaved();
    onReload();
  }

  function startEnd(item: StandingItemRow) {
    setEnding(item);
    setEndMonth(currentMonthInput());
  }
  async function saveEnd() {
    if (!ending) return;
    setSavingEnd(true);
    const result = endItem(ending, `${endMonth}-01`);
    await supabase.from('cashflow_items').update({ effective_to: result.effective_to }).eq('id', result.id);
    setSavingEnd(false);
    setEnding(null);
    onSaved();
    onReload();
  }

  async function handleDelete(item: StandingItemRow) {
    if (!confirm(t('Delete this item? This is only for something entered by mistake — use "End" to close out something that genuinely stopped.', '确定删除？此操作仅适用于录错的项目——如果项目是真的结束了，请用「结束」。'))) return;
    await supabase.from('cashflow_items').delete().eq('id', item.id);
    onSaved();
    onReload();
  }

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-4">
        <ItemTable
          title={t('Income (plan)', '收入（计划）')} color="text-emerald-600" borderColor="border-emerald-200"
          direction="inflow" rows={inflowRows} derived={[]} total={plan.totals.monthly_income}
          today={today} showHistory={showHistory} catLabel={catLabel} lang={lang} t={t}
          assets={assets} supersededIds={supersededIds}
          editingId={editingId} editForm={editForm} setEditForm={setEditForm} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit}
          onRevise={startRevise} onEnd={startEnd} onDelete={handleDelete}
          onAdd={() => startAdd('inflow')} addLabel={t('Add income item', '添加收入项目')}
        />
        <ItemTable
          title={t('Expenses (plan)', '开销（计划）')} color="text-red-500" borderColor="border-red-200"
          direction="outflow" rows={outflowRows} derived={derivedOutflow} total={plan.totals.monthly_expenses}
          today={today} showHistory={showHistory} catLabel={catLabel} lang={lang} t={t}
          assets={assets} supersededIds={supersededIds}
          editingId={editingId} editForm={editForm} setEditForm={setEditForm} onEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} savingEdit={savingEdit}
          onRevise={startRevise} onEnd={startEnd} onDelete={handleDelete}
          onAdd={() => startAdd('outflow')} addLabel={t('Add expense item', '添加支出项目')}
        />
      </div>

      <div className="flex items-center justify-between mt-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
          <History size={12} />
          {t('Show ended items / history', '显示已结束/历史版本')}
        </label>
      </div>

      {oneOffItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mt-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-50">
            <span className="font-semibold text-sm text-slate-500">{t('One-off items (not in the monthly average)', '一次性项目（不计入月均）')}</span>
          </div>
          {oneOffItems.map((it) => {
            const row = it as StandingItemRow;
            const isTransfer = wealthEffectOf(row.category, row.direction) === 'transfer';
            const superseded = supersededIds.has(row.id);
            return (
              <div key={row.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(row.category)}
                    {row.name ? <span className="text-slate-400 font-normal">· {row.name}</span> : null}
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${row.direction === 'inflow' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {row.direction === 'inflow' ? t('Income', '收入') : t('Expense', '开销')}
                    </span>
                    {isTransfer && <Chip color="bg-blue-50 text-blue-600">{t('Transfer', '资产转移')}</Chip>}
                    {superseded && <Chip color="bg-slate-100 text-slate-500">{t('Replaced by liability/policy', '已由负债/保单取代')}</Chip>}
                    {row.needs_review && <Chip color="bg-amber-50 text-amber-700">{t('Needs review', '待分类')}</Chip>}
                  </div>
                  <div className="text-xs text-slate-400">{monthLabel(row.effective_from)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-slate-600">RM {fmt(Number(row.amount))}</span>
                  <RowActions t={t} onEdit={() => startEdit(row)} onEnd={undefined} onRevise={undefined} onDelete={() => handleDelete(row)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {addModal && (
        <Modal title={addModal === 'inflow' ? t('Add income item', '添加收入项目') : t('Add expense item', '添加支出项目')} onClose={() => setAddModal(null)}>
          <Fr label={t('Category', '类别')}>
            <CategorySelect direction={addModal} value={addForm.category} onChange={(v) => setAddForm((p) => ({ ...p, category: v }))} language={language} allowEmpty excludeAutoGenerated />
          </Fr>
          <Fr label={t('Amount (MYR)', '金额 (MYR)')}><input type="number" value={addForm.amount} onChange={(e) => setAddForm((p) => ({ ...p, amount: e.target.value }))} className={inp} placeholder="0.00" /></Fr>
          <Fr label={t('Frequency', '频率')}>
            <select value={addForm.frequency} onChange={(e) => setAddForm((p) => ({ ...p, frequency: e.target.value }))} className={inp}>
              {ITEM_FREQUENCIES.map(([v]) => <option key={v} value={v}>{freqLabel(v, lang)}</option>)}
            </select>
          </Fr>
          <Fr label={t('Effective from', '生效月')}>
            <input type="month" value={addForm.month} onChange={(e) => setAddForm((p) => ({ ...p, month: e.target.value }))} className={inp} />
          </Fr>
          <Fr label={t('Name (optional)', '名称（可选）')}><input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} className={inp} /></Fr>
          <Fr label={t('Linked asset (optional)', '关联资产（可选）')}>
            <AssetSelect assets={assets} value={addForm.linked_asset_id} onChange={(v) => setAddForm((p) => ({ ...p, linked_asset_id: v }))} language={language} />
          </Fr>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving ? '...' : t('Save', '保存')}</button>
            <button onClick={() => setAddModal(null)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
          </div>
        </Modal>
      )}

      {revising && (
        <Modal title={t('Change from a month', '从某月起变更')} onClose={() => setRevising(null)}>
          <Fr label={t('Category', '类别')}>
            <CategorySelect direction={revising.direction} value={reviseForm.category} onChange={(v) => setReviseForm((p: any) => ({ ...p, category: v }))} language={language} excludeAutoGenerated />
          </Fr>
          <Fr label={t('Amount (MYR)', '金额 (MYR)')}><input type="number" value={reviseForm.amount} onChange={(e) => setReviseForm((p: any) => ({ ...p, amount: e.target.value }))} className={inp} /></Fr>
          <Fr label={t('Frequency', '频率')}>
            <select value={reviseForm.frequency} onChange={(e) => setReviseForm((p: any) => ({ ...p, frequency: e.target.value }))} className={inp}>
              {ITEM_FREQUENCIES.map(([v]) => <option key={v} value={v}>{freqLabel(v, lang)}</option>)}
            </select>
          </Fr>
          <Fr label={t('Effective from', '从何月起')}>
            <input type="month" value={reviseForm.month} onChange={(e) => setReviseForm((p: any) => ({ ...p, month: e.target.value }))} className={inp} />
          </Fr>
          <Fr label={t('Name (optional)', '名称（可选）')}><input value={reviseForm.name} onChange={(e) => setReviseForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} /></Fr>
          <Fr label={t('Linked asset (optional)', '关联资产（可选）')}>
            <AssetSelect assets={assets} value={reviseForm.linked_asset_id} onChange={(v) => setReviseForm((p: any) => ({ ...p, linked_asset_id: v }))} language={language} />
          </Fr>
          <div className="text-[11px] text-slate-400 mb-3">
            {t('Choosing a month at or before this item\'s own start just corrects it in place.', '如果所选月份早于或等于该项目本身的起始月，则视为「更正」。')}
          </div>
          <div className="flex gap-2">
            <button onClick={saveRevise} disabled={savingRevise} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{savingRevise ? '...' : t('Save', '保存')}</button>
            <button onClick={() => setRevising(null)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
          </div>
        </Modal>
      )}

      {ending && (
        <Modal title={t('End this item', '结束此项目')} onClose={() => setEnding(null)}>
          <Fr label={t('Last month it applies', '最后生效的月份')}>
            <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className={inp} />
          </Fr>
          <div className="flex gap-2">
            <button onClick={saveEnd} disabled={savingEnd} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{savingEnd ? '...' : t('Confirm', '确认')}</button>
            <button onClick={() => setEnding(null)} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel', '取消')}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{children}</span>;
}

function RowActions({ t, onEdit, onRevise, onEnd, onDelete }: {
  t: (en: string, zh: string) => string;
  onEdit?: () => void; onRevise?: () => void; onEnd?: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onEdit && <button title={t('Correct', '更正')} onClick={onEdit} className="text-slate-300 hover:text-xin-blue transition-colors"><Pencil size={14} /></button>}
      {onRevise && <button title={t('Change from a month', '变更')} onClick={onRevise} className="text-slate-300 hover:text-xin-blue transition-colors"><CalendarClock size={14} /></button>}
      {onEnd && <button title={t('End', '结束')} onClick={onEnd} className="text-slate-300 hover:text-amber-500 transition-colors"><Ban size={14} /></button>}
      <button title={t('Delete', '删除')} onClick={onDelete} className="text-slate-300 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
    </div>
  );
}

function ItemTable({
  title, color, borderColor, direction, rows, derived, total, today, showHistory, catLabel, lang, t, assets, supersededIds,
  editingId, editForm, setEditForm, onEdit, onCancelEdit, onSaveEdit, savingEdit, onRevise, onEnd, onDelete, onAdd, addLabel,
}: {
  title: string; color: string; borderColor: string; direction: Direction;
  rows: StandingItemRow[]; derived: DerivedItem[]; total: number; today: Date; showHistory: boolean;
  catLabel: (code: string) => string; lang: 'zh' | 'en'; t: (en: string, zh: string) => string;
  assets: AssetOption[]; supersededIds: Set<string>;
  editingId: string | null; editForm: any; setEditForm: (f: any) => void;
  onEdit: (item: StandingItemRow) => void; onCancelEdit: () => void; onSaveEdit: (item: StandingItemRow) => void; savingEdit: boolean;
  onRevise: (item: StandingItemRow) => void; onEnd: (item: StandingItemRow) => void; onDelete: (item: StandingItemRow) => void;
  onAdd: () => void; addLabel: string;
}) {
  const assetName = (id: string | null | undefined) => assets.find((a) => a.id === id)?.name;
  let transferTotal = 0;
  for (const r of rows) {
    if (isItemEnded(r, today) || supersededIds.has(r.id)) continue;
    if (wealthEffectOf(r.category, r.direction) === 'transfer') transferTotal += itemMonthlyAmount(r);
  }
  for (const d of derived) {
    if (isTransferCode(d.category)) transferTotal += d.monthly_amount;
  }

  return (
    <div className={`bg-white rounded-2xl border ${borderColor} overflow-hidden shadow-sm`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
        <span className={`font-semibold text-sm ${color}`}>{title}</span>
        <button onClick={onAdd} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors ${color}`}><Plus size={12} />{addLabel}</button>
      </div>
      {rows.length === 0 && derived.length === 0 ? <div className="p-8 text-center text-slate-300 text-sm">—</div> : (
        <>
          {rows.map((item) => {
            const ended = isItemEnded(item, today);
            const isTransfer = wealthEffectOf(item.category, item.direction) === 'transfer';
            const superseded = supersededIds.has(item.id);
            const monthly = itemMonthlyAmount(item);
            const showMonthly = item.frequency !== 'monthly';

            if (editingId === item.id) {
              return (
                <div key={item.id} className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/60">
                  <Fr label={t('Category', '类别')}>
                    <CategorySelect direction={direction} value={editForm.category} onChange={(v) => setEditForm((p: any) => ({ ...p, category: v }))} language={lang} excludeAutoGenerated />
                  </Fr>
                  <Fr label={t('Amount (MYR)', '金额 (MYR)')}><input type="number" value={editForm.amount} onChange={(e) => setEditForm((p: any) => ({ ...p, amount: e.target.value }))} className={inp} /></Fr>
                  <Fr label={t('Frequency', '频率')}>
                    <select value={editForm.frequency} onChange={(e) => setEditForm((p: any) => ({ ...p, frequency: e.target.value }))} className={inp}>
                      {ITEM_FREQUENCIES.map(([v]) => <option key={v} value={v}>{freqLabel(v, lang)}</option>)}
                    </select>
                  </Fr>
                  <Fr label={t('Effective from', '生效月')}>
                    <input type="month" value={editForm.month} onChange={(e) => setEditForm((p: any) => ({ ...p, month: e.target.value }))} className={inp} />
                  </Fr>
                  <Fr label={t('Name (optional)', '名称（可选）')}><input value={editForm.name} onChange={(e) => setEditForm((p: any) => ({ ...p, name: e.target.value }))} className={inp} /></Fr>
                  <Fr label={t('Linked asset (optional)', '关联资产（可选）')}>
                    <AssetSelect assets={assets} value={editForm.linked_asset_id} onChange={(v) => setEditForm((p: any) => ({ ...p, linked_asset_id: v }))} language={lang} />
                  </Fr>
                  <div className="flex gap-2">
                    <button onClick={() => onSaveEdit(item)} disabled={savingEdit} className="px-4 py-2 bg-xin-blue text-white font-semibold rounded-lg text-sm disabled:opacity-50">{savingEdit ? '...' : t('Save', '保存')}</button>
                    <button onClick={onCancelEdit} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm">{t('Cancel', '取消')}</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className={`flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0 ${ended ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(item.category)}
                    {item.name ? <span className="text-slate-400 font-normal">· {item.name}</span> : null}
                    {isTransfer && <Chip color="bg-blue-50 text-blue-600">{t('Transfer', '资产转移')}</Chip>}
                    {superseded && <Chip color="bg-slate-100 text-slate-500">{t('Replaced by liability/policy', '已由负债/保单取代')}</Chip>}
                    {item.needs_review && <Chip color="bg-amber-50 text-amber-700">{t('Needs review', '待分类')}</Chip>}
                    {ended && <Chip color="bg-slate-100 text-slate-400">{t('Ended', '已结束')}</Chip>}
                    {assetName(item.linked_asset_id) && <Chip color="bg-indigo-50 text-indigo-600">{assetName(item.linked_asset_id)}</Chip>}
                  </div>
                  <div className="text-xs text-slate-400">
                    RM {fmt(Number(item.amount))} · {freqLabel(item.frequency, lang)}
                    {showMonthly ? ` · ${t('monthly equiv.', '月等值')} RM ${fmt(monthly)}` : ''}
                    {' · '}{t(`Since ${monthLabel(item.effective_from)}`, `自 ${monthLabel(item.effective_from)} 起`)}
                    {item.effective_to ? ` ${t(`until ${monthLabel(item.effective_to)}`, `至 ${monthLabel(item.effective_to)}`)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-semibold ${color}`}>RM {fmt(showMonthly ? monthly : Number(item.amount))}</span>
                  <RowActions t={t} onEdit={() => onEdit(item)} onRevise={() => onRevise(item)} onEnd={() => onEnd(item)} onDelete={() => onDelete(item)} />
                </div>
              </div>
            );
          })}
          {derived.map((d) => (
            <div key={d.key} className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5 flex-wrap">
                    {catLabel(d.category)}
                    <Chip color="bg-slate-100 text-slate-500">{t('Auto', '自动')}</Chip>
                    {d.estimated.length > 0 && <Chip color="bg-blue-50 text-blue-600">{t('Estimated', '估算')}</Chip>}
                    {isTransferCode(d.category) && <Chip color="bg-blue-50 text-blue-600">{t('Transfer', '资产转移')}</Chip>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{d.source_name}</div>
                  {d.source_type === 'liability' && (
                    <div className="text-[11px] text-slate-400">
                      {t(`Principal RM ${fmt(d.principal_monthly)} · Interest RM ${fmt(d.interest_monthly)}`, `本金 RM ${fmt(d.principal_monthly)} · 利息 RM ${fmt(d.interest_monthly)}`)}
                    </div>
                  )}
                </div>
                <span className={`text-sm font-semibold shrink-0 ${color}`}>RM {fmt(d.monthly_amount)}</span>
              </div>
              {d.warnings.map((w, i) => (
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
