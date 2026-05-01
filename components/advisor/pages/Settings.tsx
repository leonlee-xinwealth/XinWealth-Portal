import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';

export default function Settings() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [advisor, setAdvisor] = useState<any>(null);
  const [form, setForm] = useState({ display_name:'', phone:'', agency_name:'', license_far:'', license_cmsrl:'' });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('advisors').select('*').eq('user_id', user.id).single();
      if (data) { setAdvisor(data); setForm({ display_name: data.display_name||'', phone: data.phone||'', agency_name: data.agency_name||'', license_far: data.license_far||'', license_cmsrl: data.license_cmsrl||'' }); }
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    await supabase.from('advisors').update(form).eq('id', advisor.id);
    setSaving(false); setOk(true); setTimeout(() => setOk(false), 3000);
  }

  const F = ({ label, k }: { label: string; k: keyof typeof form }) => (
    <div className="mb-4">
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-xin-gold focus:bg-white transition-colors" />
    </div>
  );

  return (
    <div className="max-w-lg">
      <h1 className="font-serif text-2xl font-bold text-xin-blue mb-6">{t('Settings','设置')}</h1>

      {advisor && (
        <div className="bg-xin-blue/5 rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-xin-blue text-white font-bold text-lg flex items-center justify-center shrink-0">
            {advisor.display_name?.charAt(0)}
          </div>
          <div>
            <div className="font-semibold text-xin-blue">{advisor.display_name}</div>
            <div className="text-xs text-slate-500">{advisor.email} · <span className="font-semibold text-xin-gold">{advisor.rank}</span></div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <F label={t('Display Name','显示名称')} k="display_name" />
        <F label={t('Phone','电话')} k="phone" />
        <F label={t('Agency Name','代理机构')} k="agency_name" />
        <F label="FAR License No." k="license_far" />
        <F label="CMSRL License No." k="license_cmsrl" />

        {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm mb-4">✓ {t('Saved successfully.','保存成功。')}</div>}

        <button onClick={save} disabled={saving}
          className="px-6 py-3 bg-xin-blue text-white font-semibold rounded-xl hover:bg-xin-blueLight transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? '...' : t('Save Changes','保存')}
        </button>
      </div>
    </div>
  );
}
