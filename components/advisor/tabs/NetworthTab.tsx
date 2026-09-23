import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X, Pencil } from 'lucide-react';
import {
  ASSET_CLASSES, ASSET_TYPES, LIABILITY_TYPES, assetTypeLabel, assetTypeMeta,
  liabilityTypeLabel, liquidityLevel,
} from '../../../supabase/functions/_shared/taxonomy/balance';
import { estimateLoan } from '../../../supabase/functions/_shared/finance/loans';
import { isActiveAt, itemMonthlyAmount, type StandingItem } from '../../../supabase/functions/_shared/cashflow/items';
import { AlertTriangle } from 'lucide-react';

// Exported so pdf/cfpReport/labels/__tests__/enums.test.ts can assert the
// report has a display label for every type this UI can create.
export const ASSET_OPTS: [string, string][] = ASSET_TYPES.filter(a => a.offered).map(a => [a.code, a.label_en]);
export const LIAB_OPTS: [string, string][] = LIABILITY_TYPES.map(l => [l.code, l.label_en]);

const PURPOSES: Array<[string, string, string]> = [
  ['', 'Default', '按类型默认'],
  ['personal_use', 'Personal use', '自用'],
  ['income_producing', 'Income-producing', '生财'],
  ['investment', 'Investment', '投资'],
];

// 计息方式 — empty lets the D1 estimator (_shared/finance/loans.ts) fall back
// to the liability_type's default (spec 2026-09-24-cfp-p2a decision 2).
const RATE_TYPES: Array<[string, string, string]> = [
  ['', 'Default by type', '按类型默认'],
  ['reducing', 'Reducing balance', '等额本息'],
  ['flat', 'Flat rate', '平息'],
  ['revolving', 'Revolving credit', '循环信用'],
  ['interest_only', 'Interest only', '只付利息'],
];

export default function NetworthTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const lang: 'zh' | 'en' = language === 'zh' ? 'zh' : 'en';
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [items, setItems] = useState<StandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'asset'|'liability'|null>(null);
  const [aForm, setAForm] = useState({ asset_type:'', name:'', institution:'', current_value:'', cost_value:'', ownership_type:'sole', purpose:'', ownership_pct:'100' });
  const [lForm, setLForm] = useState({ liability_type:'', name:'', lender:'', outstanding_balance:'', monthly_payment:'', interest_rate:'', start_date:'', end_date:'', remaining_months:'', rate_type:'' });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<{ table: 'assets'|'liabilities'; id: string } | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [ok, setOk] = useState(false);

  async function load() {
    const [{ data: a }, { data: l }, { data: it }] = await Promise.all([
      supabase.from('assets').select('*').eq('client_id', clientId).order('asset_type'),
      supabase.from('liabilities').select('*').eq('client_id', clientId).order('liability_type'),
      supabase.from('cashflow_items').select('*').eq('client_id', clientId),
    ]);
    setAssets(a || []); setLiabilities(l || []); setItems((it || []) as StandingItem[]); setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  // Spec 2026-09-25-cfp-p2b decision 7: an asset's row surfaces the net monthly
  // cashflow its links imply — standing items pointed at it (rent, dividends,
  // its own upkeep) minus the estimated installment of any liability financing
  // it (the loan payment isn't "spending against the asset" in isolation, but
  // netting it here is what tells an advisor at a glance whether this asset is
  // cash-flow positive). Returns null (hidden) when nothing links to it.
  function linkedCashflowForAsset(assetId: string): number | null {
    const now = new Date();
    const linkedItems = items.filter(i => i.linked_asset_id === assetId && isActiveAt(i, now));
    const linkedLiabilities = liabilities.filter(l => l.linked_asset_id === assetId);
    if (linkedItems.length === 0 && linkedLiabilities.length === 0) return null;
    let net = 0;
    for (const it of linkedItems) {
      const monthly = itemMonthlyAmount(it);
      net += it.direction === 'inflow' ? monthly : -monthly;
    }
    for (const l of linkedLiabilities) {
      net -= estimateLoan(l as any).monthly_payment;
    }
    return net;
  }

  async function addAsset() {
    if (!aForm.name || !aForm.current_value) return;
    setSaving(true);
    const type = aForm.asset_type || 'other';
    await supabase.from('assets').insert({
      client_id: clientId, asset_type: type, name: aForm.name, institution: aForm.institution || null,
      current_value: parseFloat(aForm.current_value), cost_value: aForm.cost_value ? parseFloat(aForm.cost_value) : null,
      ownership_type: aForm.ownership_type,
      liquidity: liquidityLevel(type),
      purpose: aForm.purpose || assetTypeMeta(type)?.default_purpose || null,
      ownership_pct: parseFloat(aForm.ownership_pct) || 100,
    });
    setSaving(false); setModal(null); setAForm({ asset_type:'', name:'', institution:'', current_value:'', cost_value:'', ownership_type:'sole', purpose:'', ownership_pct:'100' }); load();
  }
  async function addLiability() {
    if (!lForm.name || !lForm.outstanding_balance) return;
    setSaving(true);
    await supabase.from('liabilities').insert({ client_id: clientId, liability_type: lForm.liability_type||'other', name: lForm.name, lender: lForm.lender||null, outstanding_balance: parseFloat(lForm.outstanding_balance), monthly_payment: lForm.monthly_payment?parseFloat(lForm.monthly_payment):null, interest_rate: lForm.interest_rate?parseFloat(lForm.interest_rate):null, start_date: lForm.start_date||null, end_date: lForm.end_date||null, remaining_months: lForm.remaining_months?parseInt(lForm.remaining_months,10):null, rate_type: lForm.rate_type||null });
    setSaving(false); setModal(null); setLForm({ liability_type:'', name:'', lender:'', outstanding_balance:'', monthly_payment:'', interest_rate:'', start_date:'', end_date:'', remaining_months:'', rate_type:'' }); load();
  }
  async function del(table: string, id: string) {
    if (!confirm(t('Delete?','确定删除？'))) return;
    await supabase.from(table).delete().eq('id', id); load();
  }

  function startEditAsset(a: any) {
    setEditing({ table: 'assets', id: a.id });
    setEditForm({ asset_type: a.asset_type, name: a.name, institution: a.institution||'', current_value: String(a.current_value), cost_value: a.cost_value!=null?String(a.cost_value):'', ownership_type: a.ownership_type||'sole', purpose: a.purpose || '', ownership_pct: String(a.ownership_pct ?? 100) });
  }
  function startEditLiability(l: any) {
    setEditing({ table: 'liabilities', id: l.id });
    setEditForm({ liability_type: l.liability_type, name: l.name, lender: l.lender||'', outstanding_balance: String(l.outstanding_balance), monthly_payment: l.monthly_payment!=null?String(l.monthly_payment):'', interest_rate: l.interest_rate!=null?String(l.interest_rate):'', start_date: l.start_date||'', end_date: l.end_date||'', remaining_months: l.remaining_months!=null?String(l.remaining_months):'', rate_type: l.rate_type||'' });
  }
  function cancelEdit() {
    setEditing(null); setEditForm({});
  }
  async function saveEdit() {
    if (!editing) return;
    const amountField = editing.table === 'assets' ? editForm.current_value : editForm.outstanding_balance;
    if (!editForm.name || !amountField) return;
    setSavingEdit(true);
    const payload = editing.table === 'assets'
      ? {
          asset_type: editForm.asset_type || 'other', name: editForm.name, institution: editForm.institution || null,
          current_value: parseFloat(editForm.current_value), cost_value: editForm.cost_value ? parseFloat(editForm.cost_value) : null,
          ownership_type: editForm.ownership_type,
          liquidity: liquidityLevel(editForm.asset_type || 'other'),
          purpose: editForm.purpose || assetTypeMeta(editForm.asset_type)?.default_purpose || null,
          ownership_pct: parseFloat(editForm.ownership_pct) || 100,
          needs_review: false, review_reason: null,
        }
      : { liability_type: editForm.liability_type||'other', name: editForm.name, lender: editForm.lender||null, outstanding_balance: parseFloat(editForm.outstanding_balance), monthly_payment: editForm.monthly_payment?parseFloat(editForm.monthly_payment):null, interest_rate: editForm.interest_rate?parseFloat(editForm.interest_rate):null, start_date: editForm.start_date||null, end_date: editForm.end_date||null, remaining_months: editForm.remaining_months?parseInt(editForm.remaining_months,10):null, rate_type: editForm.rate_type||null };
    await supabase.from(editing.table).update(payload).eq('id', editing.id);
    setSavingEdit(false); setEditing(null);
    setOk(true); setTimeout(() => setOk(false), 3000);
    load();
  }

  const totalA = assets.reduce((s,a) => s+a.current_value, 0);
  const totalL = liabilities.reduce((s,l) => s+l.outstanding_balance, 0);
  const nw = totalA - totalL;

  if (loading) return <Loader />;

  return (
    <div>
      {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm mb-4">✓ {t('Saved successfully.','保存成功。')}</div>}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{label:t('Total Assets','总资产'),val:totalA,c:'text-emerald-600',bg:'bg-emerald-50'},{label:t('Total Liabilities','总负债'),val:totalL,c:'text-red-500',bg:'bg-red-50'},{label:t('Net Worth','净资产'),val:nw,c:nw>=0?'text-xin-blue':'text-red-500',bg:nw>=0?'bg-blue-50':'bg-red-50'}].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <div className="text-xs text-slate-500 font-medium mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.c}`}>RM {fmt(s.val)}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <NwTable title={t('Assets','资产')} color="text-emerald-600" addLabel={t('Add Asset','添加资产')} onAdd={() => setModal('asset')}>
          {assets.map(a => {
            if (editing?.table==='assets' && editing.id===a.id) {
              return <AssetEditRow key={a.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saving={savingEdit} t={t} lang={lang} />;
            }
            // Net monthly cashflow linked to this asset (spec 2026-09-25-cfp-p2b
            // decision 7) — hidden entirely when nothing links to the asset.
            const linked = linkedCashflowForAsset(a.id);
            return (
              <Item
                key={a.id}
                title={a.name}
                sub={assetTypeLabel(a.asset_type, lang) + (a.institution ? ` · ${a.institution}` : '') + (Number(a.ownership_pct ?? 100) < 100 ? ` · ${Number(a.ownership_pct)}%` : '')}
                flag={a.needs_review ? (a.review_reason || t('Needs review','待确认')) : null}
                value={fmt(a.current_value)}
                color="text-emerald-600"
                onEdit={() => startEditAsset(a)}
                onDel={() => del('assets',a.id)}
                extra={linked != null ? (
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    {t('Linked cashflow','关联现金流')}{' '}
                    <span className={`font-semibold ${linked >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {linked >= 0 ? '+' : '−'}RM {fmt(Math.abs(linked))}{t('/mo','/月')}
                    </span>
                  </div>
                ) : null}
              />
            );
          })}
          {assets.length > 0 && <Total label={t('Total','合计')} value={fmt(totalA)} color="text-emerald-600" />}
        </NwTable>
        <NwTable title={t('Liabilities','负债')} color="text-red-500" addLabel={t('Add Liability','添加负债')} onAdd={() => setModal('liability')}>
          {liabilities.map(l => {
            if (editing?.table==='liabilities' && editing.id===l.id) {
              return <LiabilityEditRow key={l.id} form={editForm} setForm={setEditForm} onSave={saveEdit} onCancel={cancelEdit} saving={savingEdit} t={t} lang={lang} />;
            }
            // The estimated monthly payment (D1 estimator, spec 2026-09-24-cfp-p2a
            // decision 2) is what actually drives the client's cash flow and DSR —
            // shown here read-only so an advisor can sanity-check it against what
            // the client reported without having to open the Cashflow tab.
            const est = estimateLoan(l as any);
            return (
              <Item
                key={l.id}
                title={l.name}
                sub={liabilityTypeLabel(l.liability_type, lang)+(l.lender?` · ${l.lender}`:'')}
                value={fmt(l.outstanding_balance)}
                color="text-red-500"
                onEdit={() => startEditLiability(l)}
                onDel={() => del('liabilities',l.id)}
                extra={est.monthly_payment > 0 ? (
                  <div className="mt-0.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 flex-wrap">
                      {t(`RM ${fmt(est.monthly_payment)}/mo`, `RM ${fmt(est.monthly_payment)}/月`)}
                      {est.estimated.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{t('Estimated','估算')}</span>}
                    </span>
                    {est.warnings.map((w, i) => (
                      <div key={i} className="text-[11px] text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} className="shrink-0" />{w}
                      </div>
                    ))}
                  </div>
                ) : null}
              />
            );
          })}
          {liabilities.length > 0 && <Total label={t('Total','合计')} value={fmt(totalL)} color="text-red-500" />}
        </NwTable>
      </div>

      {modal === 'asset' && (
        <Modal title={t('Add Asset','添加资产')} onClose={() => setModal(null)}>
          <Fr label={t('Asset Type','资产类型')}><AssetTypeSel value={aForm.asset_type} onChange={v => setAForm(p => ({...p,asset_type:v}))} lang={lang} allowEmpty /></Fr>
          <Fr label={`${t('Name','名称')} *`}><Inp value={aForm.name} onChange={v => setAForm(p => ({...p,name:v}))} placeholder="e.g. Maybank Savings" /></Fr>
          <Fr label={t('Institution','机构')}><Inp value={aForm.institution} onChange={v => setAForm(p => ({...p,institution:v}))} /></Fr>
          <Fr label={`${t('Current Value','当前价值')} (RM) *`}><Inp type="number" value={aForm.current_value} onChange={v => setAForm(p => ({...p,current_value:v}))} placeholder="0.00" /></Fr>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Purpose','持有目的')}><Sel value={aForm.purpose} onChange={v => setAForm(p => ({...p,purpose:v}))} opts={PURPOSES.map(([v, en, zh]) => [v, lang === 'zh' ? zh : en] as [string, string])} /></Fr>
            <Fr label={t('Ownership %','持有比例 %')}><Inp type="number" value={aForm.ownership_pct} onChange={v => setAForm(p => ({...p,ownership_pct:v}))} placeholder="100" /></Fr>
          </div>
          <BtnRow onSave={addAsset} onCancel={() => setModal(null)} saving={saving} t={t} />
        </Modal>
      )}
      {modal === 'liability' && (
        <Modal title={t('Add Liability','添加负债')} onClose={() => setModal(null)}>
          <Fr label={t('Liability Type','负债类型')}><LiabilityTypeSel value={lForm.liability_type} onChange={v => setLForm(p => ({...p,liability_type:v}))} lang={lang} allowEmpty /></Fr>
          <Fr label={`${t('Name','名称')} *`}><Inp value={lForm.name} onChange={v => setLForm(p => ({...p,name:v}))} placeholder="e.g. Maybank Home Loan" /></Fr>
          <Fr label={t('Lender','贷款机构')}><Inp value={lForm.lender} onChange={v => setLForm(p => ({...p,lender:v}))} /></Fr>
          <Fr label={`${t('Outstanding Balance','未偿还余额')} (RM) *`}><Inp type="number" value={lForm.outstanding_balance} onChange={v => setLForm(p => ({...p,outstanding_balance:v}))} placeholder="0.00" /></Fr>
          <Fr label={t('Monthly Payment','每月还款')+' (RM)'}><Inp type="number" value={lForm.monthly_payment} onChange={v => setLForm(p => ({...p,monthly_payment:v}))} placeholder="0.00" /></Fr>
          <Fr label={t('Interest Rate','利率')+' (%)'}><Inp type="number" value={lForm.interest_rate} onChange={v => setLForm(p => ({...p,interest_rate:v}))} placeholder="4.5" /></Fr>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Remaining term (months)','剩余期数（月）')}><Inp type="number" value={lForm.remaining_months} onChange={v => setLForm(p => ({...p,remaining_months:v}))} placeholder="e.g. 240" /></Fr>
            <Fr label={t('Amortisation','计息方式')}><Sel value={lForm.rate_type} onChange={v => setLForm(p => ({...p,rate_type:v}))} opts={RATE_TYPES.map(([v, en, zh]) => [v, lang === 'zh' ? zh : en] as [string, string])} /></Fr>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Fr label={t('Start Date','开始日期')}><Inp type="date" value={lForm.start_date} onChange={v => setLForm(p => ({...p,start_date:v}))} /></Fr>
            <Fr label={t('End Date','到期日期')}><Inp type="date" value={lForm.end_date} onChange={v => setLForm(p => ({...p,end_date:v}))} /></Fr>
          </div>
          <BtnRow onSave={addLiability} onCancel={() => setModal(null)} saving={saving} t={t} />
        </Modal>
      )}
    </div>
  );
}

const NwTable = ({ title, color, addLabel, onAdd, children }: any) => (
  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-50">
      <span className={`font-semibold text-sm ${color}`}>{title}</span>
      <button onClick={onAdd} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 ${color}`}><Plus size={12} />{addLabel}</button>
    </div>
    {React.Children.count(children) === 0 ? <div className="p-8 text-center text-slate-300 text-sm">—</div> : children}
  </div>
);
const Item = ({ title, sub, value, color, onEdit, onDel, flag, extra }: any) => (
  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
    <div className="min-w-0">
      <div className="text-sm font-medium text-xin-blue flex items-center gap-1.5">
        {title}
        {flag && <span title={flag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">待确认</span>}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
      {extra}
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className={`text-sm font-semibold ${color}`}>RM {value}</span>
      <button onClick={onEdit} className="text-slate-300 hover:text-xin-blue"><Pencil size={14} /></button>
      <button onClick={onDel} className="text-slate-300 hover:text-red-400"><X size={14} /></button>
    </div>
  </div>
);
const AssetEditRow = ({ form, setForm, onSave, onCancel, saving, t, lang }: any) => {
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <div className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/60">
      <Fr label={t('Asset Type','资产类型')}><AssetTypeSel value={form.asset_type} onChange={v => set('asset_type',v)} lang={lang} /></Fr>
      <Fr label={`${t('Name','名称')} *`}><Inp value={form.name} onChange={v => set('name',v)} /></Fr>
      <Fr label={t('Institution','机构')}><Inp value={form.institution} onChange={v => set('institution',v)} /></Fr>
      <Fr label={`${t('Current Value','当前价值')} (RM) *`}><Inp type="number" value={form.current_value} onChange={v => set('current_value',v)} /></Fr>
      <div className="grid grid-cols-2 gap-3">
        <Fr label={t('Purpose','持有目的')}><Sel value={form.purpose} onChange={v => set('purpose',v)} opts={PURPOSES.map(([v, en, zh]) => [v, lang === 'zh' ? zh : en] as [string, string])} /></Fr>
        <Fr label={t('Ownership %','持有比例 %')}><Inp type="number" value={form.ownership_pct} onChange={v => set('ownership_pct',v)} placeholder="100" /></Fr>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-xin-blue text-white font-semibold rounded-lg text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button>
        <button onClick={onCancel} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm">{t('Cancel','取消')}</button>
      </div>
    </div>
  );
};
const LiabilityEditRow = ({ form, setForm, onSave, onCancel, saving, t, lang }: any) => {
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <div className="px-5 py-3 border-b border-slate-50 last:border-0 bg-slate-50/60">
      <Fr label={t('Liability Type','负债类型')}><LiabilityTypeSel value={form.liability_type} onChange={v => set('liability_type',v)} lang={lang} /></Fr>
      <Fr label={`${t('Name','名称')} *`}><Inp value={form.name} onChange={v => set('name',v)} /></Fr>
      <Fr label={t('Lender','贷款机构')}><Inp value={form.lender} onChange={v => set('lender',v)} /></Fr>
      <Fr label={`${t('Outstanding Balance','未偿还余额')} (RM) *`}><Inp type="number" value={form.outstanding_balance} onChange={v => set('outstanding_balance',v)} /></Fr>
      <Fr label={t('Monthly Payment','每月还款')+' (RM)'}><Inp type="number" value={form.monthly_payment} onChange={v => set('monthly_payment',v)} /></Fr>
      <Fr label={t('Interest Rate','利率')+' (%)'}><Inp type="number" value={form.interest_rate} onChange={v => set('interest_rate',v)} /></Fr>
      <div className="grid grid-cols-2 gap-3">
        <Fr label={t('Remaining term (months)','剩余期数（月）')}><Inp type="number" value={form.remaining_months} onChange={v => set('remaining_months',v)} placeholder="e.g. 240" /></Fr>
        <Fr label={t('Amortisation','计息方式')}><Sel value={form.rate_type} onChange={v => set('rate_type',v)} opts={RATE_TYPES.map(([v, en, zh]) => [v, lang === 'zh' ? zh : en] as [string, string])} /></Fr>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Fr label={t('Start Date','开始日期')}><Inp type="date" value={form.start_date} onChange={v => set('start_date',v)} /></Fr>
        <Fr label={t('End Date','到期日期')}><Inp type="date" value={form.end_date} onChange={v => set('end_date',v)} /></Fr>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-xin-blue text-white font-semibold rounded-lg text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button>
        <button onClick={onCancel} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm">{t('Cancel','取消')}</button>
      </div>
    </div>
  );
};
const Total = ({ label, value, color }: any) => <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100"><span className="text-xs font-semibold text-slate-500">{label}</span><span className={`text-sm font-bold ${color}`}>RM {value}</span></div>;
const Modal = ({ title, onClose, children }: any) => <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-xl"><div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-xin-blue">{title}</h3><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={18} /></button></div>{children}</div></div>;
const Fr = ({ label, children }: any) => <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>{children}</div>;
const Inp = ({ value, onChange, type='text', placeholder }: { value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) => <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />;
const Sel = ({ value, onChange, opts }: { value: string; onChange: (value: string) => void; opts: Array<[string, string]> }) => <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">{opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>;
const BtnRow = ({ onSave, onCancel, saving, t }: any) => <div className="flex gap-2 mt-2"><button onClick={onSave} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button><button onClick={onCancel} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel','取消')}</button></div>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits:0, maximumFractionDigits:0 });

const SEL_CLS = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white';

// Grouped by class A–D. The legacy `property` type is only listed while it is
// the current value, so an unconfirmed row can be opened and re-filed.
const AssetTypeSel = ({ value, onChange, lang, allowEmpty }: { value: string; onChange: (v: string) => void; lang: 'zh' | 'en'; allowEmpty?: boolean }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>
    {allowEmpty && <option value="">—</option>}
    {ASSET_CLASSES.map(k => (
      <optgroup key={k.id} label={`${k.id} · ${lang === 'zh' ? k.label_zh : k.label_en}`}>
        {ASSET_TYPES.filter(a => a.class === k.id && (a.offered || a.code === value)).map(a => (
          <option key={a.code} value={a.code}>{lang === 'zh' ? a.label_zh : a.label_en}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

const LiabilityTypeSel = ({ value, onChange, lang, allowEmpty }: { value: string; onChange: (v: string) => void; lang: 'zh' | 'en'; allowEmpty?: boolean }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className={SEL_CLS}>
    {allowEmpty && <option value="">—</option>}
    {(['short', 'long'] as const).map(term => (
      <optgroup key={term} label={term === 'short' ? (lang === 'zh' ? '短期负债' : 'Short-term') : (lang === 'zh' ? '长期负债' : 'Long-term')}>
        {LIABILITY_TYPES.filter(l => l.term === term).map(l => (
          <option key={l.code} value={l.code}>{lang === 'zh' ? l.label_zh : l.label_en}</option>
        ))}
      </optgroup>
    ))}
  </select>
);
