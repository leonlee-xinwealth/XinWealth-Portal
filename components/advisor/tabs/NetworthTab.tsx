import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, X } from 'lucide-react';

const ASSET_OPTS: [string,string][] = [['savings','Savings'],['fixed_deposit','Fixed Deposit'],['money_market','Money Market'],['epf_account_1','EPF Acc 1'],['epf_account_2','EPF Acc 2'],['epf_account_3','EPF Acc 3'],['unit_trust','Unit Trust'],['stock','Stock'],['bond','Bond'],['etf','ETF'],['property','Property'],['vehicle','Vehicle'],['business','Business'],['other','Other']];
const LIAB_OPTS: [string,string][] = [['mortgage','Mortgage'],['car_loan','Car Loan'],['personal_loan','Personal Loan'],['study_loan','Study Loan'],['renovation_loan','Renovation Loan'],['credit_card','Credit Card'],['business_loan','Business Loan'],['other','Other']];

export default function NetworthTab({ clientId }: { clientId: string }) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [assets, setAssets] = useState<any[]>([]);
  const [liabilities, setLiabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'asset'|'liability'|null>(null);
  const [aForm, setAForm] = useState({ asset_type:'', name:'', institution:'', current_value:'', cost_value:'', ownership_type:'sole', liquidity:'medium' });
  const [lForm, setLForm] = useState({ liability_type:'', name:'', lender:'', outstanding_balance:'', monthly_payment:'', interest_rate:'', start_date:'', end_date:'' });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from('assets').select('*').eq('client_id', clientId).order('asset_type'),
      supabase.from('liabilities').select('*').eq('client_id', clientId).order('liability_type'),
    ]);
    setAssets(a || []); setLiabilities(l || []); setLoading(false);
  }
  useEffect(() => { load(); }, [clientId]);

  async function addAsset() {
    if (!aForm.name || !aForm.current_value) return;
    setSaving(true);
    await supabase.from('assets').insert({ client_id: clientId, asset_type: aForm.asset_type||'other', name: aForm.name, institution: aForm.institution||null, current_value: parseFloat(aForm.current_value), cost_value: aForm.cost_value?parseFloat(aForm.cost_value):null, ownership_type: aForm.ownership_type, liquidity: aForm.liquidity });
    setSaving(false); setModal(null); setAForm({ asset_type:'', name:'', institution:'', current_value:'', cost_value:'', ownership_type:'sole', liquidity:'medium' }); load();
  }
  async function addLiability() {
    if (!lForm.name || !lForm.outstanding_balance) return;
    setSaving(true);
    await supabase.from('liabilities').insert({ client_id: clientId, liability_type: lForm.liability_type||'other', name: lForm.name, lender: lForm.lender||null, outstanding_balance: parseFloat(lForm.outstanding_balance), monthly_payment: lForm.monthly_payment?parseFloat(lForm.monthly_payment):null, interest_rate: lForm.interest_rate?parseFloat(lForm.interest_rate):null, start_date: lForm.start_date||null, end_date: lForm.end_date||null });
    setSaving(false); setModal(null); setLForm({ liability_type:'', name:'', lender:'', outstanding_balance:'', monthly_payment:'', interest_rate:'', start_date:'', end_date:'' }); load();
  }
  async function del(table: string, id: string) {
    if (!confirm(t('Delete?','确定删除？'))) return;
    await supabase.from(table).delete().eq('id', id); load();
  }

  const totalA = assets.reduce((s,a) => s+a.current_value, 0);
  const totalL = liabilities.reduce((s,l) => s+l.outstanding_balance, 0);
  const nw = totalA - totalL;
  const typeLabel = (type: string, opts: [string,string][]) => opts.find(([v]) => v===type)?.[1] || type;

  if (loading) return <Loader />;

  return (
    <div>
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
          {assets.map(a => <Item key={a.id} title={a.name} sub={typeLabel(a.asset_type,ASSET_OPTS)+(a.institution?` · ${a.institution}`:'')} value={fmt(a.current_value)} color="text-emerald-600" onDel={() => del('assets',a.id)} />)}
          {assets.length > 0 && <Total label={t('Total','合计')} value={fmt(totalA)} color="text-emerald-600" />}
        </NwTable>
        <NwTable title={t('Liabilities','负债')} color="text-red-500" addLabel={t('Add Liability','添加负债')} onAdd={() => setModal('liability')}>
          {liabilities.map(l => <Item key={l.id} title={l.name} sub={typeLabel(l.liability_type,LIAB_OPTS)+(l.lender?` · ${l.lender}`:'')+(l.monthly_payment?` · RM${fmt(l.monthly_payment)}/mo`:'')} value={fmt(l.outstanding_balance)} color="text-red-500" onDel={() => del('liabilities',l.id)} />)}
          {liabilities.length > 0 && <Total label={t('Total','合计')} value={fmt(totalL)} color="text-red-500" />}
        </NwTable>
      </div>

      {modal === 'asset' && (
        <Modal title={t('Add Asset','添加资产')} onClose={() => setModal(null)}>
          <Fr label={t('Asset Type','资产类型')}><Sel value={aForm.asset_type} onChange={v => setAForm(p => ({...p,asset_type:v}))} opts={[['','—'],...ASSET_OPTS]} /></Fr>
          <Fr label={`${t('Name','名称')} *`}><Inp value={aForm.name} onChange={v => setAForm(p => ({...p,name:v}))} placeholder="e.g. Maybank Savings" /></Fr>
          <Fr label={t('Institution','机构')}><Inp value={aForm.institution} onChange={v => setAForm(p => ({...p,institution:v}))} /></Fr>
          <Fr label={`${t('Current Value','当前价值')} (RM) *`}><Inp type="number" value={aForm.current_value} onChange={v => setAForm(p => ({...p,current_value:v}))} placeholder="0.00" /></Fr>
          <BtnRow onSave={addAsset} onCancel={() => setModal(null)} saving={saving} t={t} />
        </Modal>
      )}
      {modal === 'liability' && (
        <Modal title={t('Add Liability','添加负债')} onClose={() => setModal(null)}>
          <Fr label={t('Liability Type','负债类型')}><Sel value={lForm.liability_type} onChange={v => setLForm(p => ({...p,liability_type:v}))} opts={[['','—'],...LIAB_OPTS]} /></Fr>
          <Fr label={`${t('Name','名称')} *`}><Inp value={lForm.name} onChange={v => setLForm(p => ({...p,name:v}))} placeholder="e.g. Maybank Home Loan" /></Fr>
          <Fr label={t('Lender','贷款机构')}><Inp value={lForm.lender} onChange={v => setLForm(p => ({...p,lender:v}))} /></Fr>
          <Fr label={`${t('Outstanding Balance','未偿还余额')} (RM) *`}><Inp type="number" value={lForm.outstanding_balance} onChange={v => setLForm(p => ({...p,outstanding_balance:v}))} placeholder="0.00" /></Fr>
          <Fr label={t('Monthly Payment','每月还款')+' (RM)'}><Inp type="number" value={lForm.monthly_payment} onChange={v => setLForm(p => ({...p,monthly_payment:v}))} placeholder="0.00" /></Fr>
          <Fr label={t('Interest Rate','利率')+' (%)'}><Inp type="number" value={lForm.interest_rate} onChange={v => setLForm(p => ({...p,interest_rate:v}))} placeholder="4.5" /></Fr>
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
const Item = ({ title, sub, value, color, onDel }: any) => (
  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0">
    <div><div className="text-sm font-medium text-xin-blue">{title}</div><div className="text-xs text-slate-400">{sub}</div></div>
    <div className="flex items-center gap-3"><span className={`text-sm font-semibold ${color}`}>RM {value}</span><button onClick={onDel} className="text-slate-300 hover:text-red-400"><X size={14} /></button></div>
  </div>
);
const Total = ({ label, value, color }: any) => <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100"><span className="text-xs font-semibold text-slate-500">{label}</span><span className={`text-sm font-bold ${color}`}>RM {value}</span></div>;
const Modal = ({ title, onClose, children }: any) => <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-xl"><div className="flex items-center justify-between mb-5"><h3 className="font-semibold text-xin-blue">{title}</h3><button onClick={onClose} className="text-slate-300 hover:text-slate-500"><X size={18} /></button></div>{children}</div></div>;
const Fr = ({ label, children }: any) => <div className="mb-3"><label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>{children}</div>;
const Inp = ({ value, onChange, type='text', placeholder }: any) => <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold" />;
const Sel = ({ value, onChange, opts }: any) => <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-xin-gold bg-white">{opts.map(([v,l]: any) => <option key={v} value={v}>{l}</option>)}</select>;
const BtnRow = ({ onSave, onCancel, saving, t }: any) => <div className="flex gap-2 mt-2"><button onClick={onSave} disabled={saving} className="px-5 py-2.5 bg-xin-blue text-white font-semibold rounded-xl text-sm disabled:opacity-50">{saving?'...':t('Save','保存')}</button><button onClick={onCancel} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm">{t('Cancel','取消')}</button></div>;
const Loader = () => <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-xin-blue" /></div>;
const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits:0, maximumFractionDigits:0 });
