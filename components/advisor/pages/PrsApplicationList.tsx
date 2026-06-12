// components/advisor/pages/PrsApplicationList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabaseClient';
import { useLanguage } from '../../../context/LanguageContext';
import { Plus, FileText } from 'lucide-react';
import { initialPrsFormData, type PrsApplication } from '../../../types/prs';

const STATUS_BADGES: Record<string, { en: string; zh: string; cls: string }> = {
  draft:           { en: 'Draft',           zh: '草稿',      cls: 'bg-slate-100 text-slate-600' },
  awaiting_client: { en: 'Awaiting Client', zh: '待客户填写', cls: 'bg-blue-50 text-blue-700' },
  submitted:       { en: 'To Review',       zh: '待审核',    cls: 'bg-amber-50 text-amber-700' },
  completed:       { en: 'Completed',       zh: '已完成',    cls: 'bg-emerald-50 text-emerald-700' },
  cancelled:       { en: 'Cancelled',       zh: '已取消',    cls: 'bg-rose-50 text-rose-600' },
};

export default function PrsApplicationList() {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const navigate = useNavigate();
  const [apps, setApps] = useState<PrsApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('prs_applications')
      .select('*, clients(full_name)')
      .order('updated_at', { ascending: false });
    setApps((data ?? []).map((r: any) => ({ ...r, client_full_name: r.clients?.full_name })));
    setLoading(false);
  }

  async function createNew() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: adv } = await supabase.from('advisors').select('id').eq('user_id', user.id).single();
    if (!adv) return;
    const { data, error } = await supabase
      .from('prs_applications')
      .insert({ advisor_id: adv.id, form_data: initialPrsFormData })
      .select()
      .single();
    if (!error && data) navigate(`/advisor/prs/${data.id}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue">{t('PRS Applications', 'PRS 开户申请')}</h1>
        <button onClick={createNew}
          className="flex items-center gap-1.5 bg-xin-blue text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-xin-blueLight transition-colors">
          <Plus size={15} /> {t('New Application', '新建申请')}
        </button>
      </div>

      {loading ? (
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-xin-blue mx-auto mt-16" />
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 text-sm">
          <FileText size={32} className="mx-auto mb-3 text-slate-300" />
          {t('No applications yet. Create one, or start from a client page.', '还没有申请。点击新建，或从客户详情页发起。')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {apps.map(app => {
            const b = STATUS_BADGES[app.status] ?? STATUS_BADGES.draft;
            return (
              <button key={app.id} onClick={() => navigate(`/advisor/prs/${app.id}`)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-xin-blue truncate">
                    {app.client_full_name || (app.form_data as any)?.full_name || t('(New client)', '（新客户）')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('Updated', '更新于')} {new Date(app.updated_at).toLocaleString(language === 'zh' ? 'zh-MY' : 'en-MY')}
                  </p>
                </div>
                <span className={`${b.cls} text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ml-3`}>
                  {language === 'zh' ? b.zh : b.en}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
