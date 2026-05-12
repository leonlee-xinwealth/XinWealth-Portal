import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const toolUrl = import.meta.env.VITE_INSURANCE_COMPARISON_URL as string | undefined;

const InsuranceComparison: React.FC = () => {
  const { language } = useLanguage();

  const t = (en: string, zh: string) => (language === 'zh' ? zh : en);

  if (!toolUrl) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h1 className="font-serif text-2xl font-bold text-xin-blue mb-3">
          {t('Insurance Comparison Tool', '保单对比工具')}
        </h1>
        <p className="text-sm text-slate-600 mb-2">
          {t(
            'Tool URL is not configured yet.',
            '工具链接尚未配置。'
          )}
        </p>
        <p className="text-xs text-slate-500">
          {t(
            'Set VITE_INSURANCE_COMPARISON_URL in your environment, then redeploy.',
            '请在环境变量设置 VITE_INSURANCE_COMPARISON_URL 后重新部署。'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-xin-blue" />
          <h1 className="font-serif text-xl font-bold text-xin-blue">
            {t('Insurance Comparison Tool', '保单对比工具')}
          </h1>
        </div>
        <a
          href={toolUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-xin-blue text-white hover:opacity-90 transition"
        >
          <ExternalLink size={16} />
          {t('Open In New Tab', '新标签页打开')}
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <iframe
          src={toolUrl}
          title="Insurance Comparison Tool"
          className="w-full h-[calc(100vh-240px)] min-h-[700px]"
        />
      </div>
    </div>
  );
};

export default InsuranceComparison;

