import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Copy, Check } from 'lucide-react';

interface Props { client: any; }

export default function FormKitTab({ client }: Props) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const [copied, setCopied] = useState<string | null>(null);

  function copyField(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  // Calculate age
  const age = client.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  const sections = [
    {
      title: t('Personal Particulars', '个人资料'),
      titleZh: '个人资料',
      fields: [
        { label: t('Full Name', '全名'), key: 'full_name', value: client.full_name },
        { label: t('Salutation', '称谓'), key: 'salutation', value: client.salutation },
        { label: t('NRIC / Passport', '身份证'), key: 'nric', value: client.nric },
        { label: t('Date of Birth', '出生日期'), key: 'date_of_birth', value: client.date_of_birth },
        { label: t('Age', '年龄'), key: 'age', value: age ? `${age}` : null },
        { label: t('Gender', '性别'), key: 'gender', value: client.gender },
        { label: t('Nationality', '国籍'), key: 'nationality', value: client.nationality },
        { label: t('Residency', '居住地'), key: 'residency', value: client.residency },
        { label: t('Marital Status', '婚姻状况'), key: 'marital_status', value: client.marital_status },
        { label: t('No. of Dependants', '受赡养人数'), key: 'number_of_dependants', value: client.number_of_dependants != null ? String(client.number_of_dependants) : null },
      ]
    },
    {
      title: t('Contact Details', '联系方式'),
      titleZh: '联系方式',
      fields: [
        { label: t('Phone', '电话'), key: 'phone', value: client.phone },
        { label: t('Email', '电邮'), key: 'email', value: client.email },
        { label: t('Address', '地址'), key: 'address', value: client.correspondence_address },
        { label: t('City', '城市'), key: 'city', value: client.correspondence_city },
        { label: t('State', '州属'), key: 'state', value: client.correspondence_state },
        { label: t('Postcode', '邮编'), key: 'postcode', value: client.correspondence_postal_code },
      ]
    },
    {
      title: t('Employment & Income', '就业与收入'),
      titleZh: '就业与收入',
      fields: [
        { label: t('Employment Status', '就业状态'), key: 'employment_status', value: client.employment_status },
        { label: t('Occupation', '职业'), key: 'occupation', value: client.occupation },
        { label: t('Employer', '雇主'), key: 'employer_name', value: client.employer_name },
        { label: t('Tax Residency', '税务居民'), key: 'tax_residency', value: client.tax_residency },
      ]
    },
    {
      title: t('Investment Profile', '投资资料'),
      titleZh: '投资资料',
      fields: [
        { label: t('Risk Profile', '风险评级'), key: 'risk_profile', value: client.risk_profile },
        { label: t('Retirement Age', '退休年龄'), key: 'retirement_age', value: client.retirement_age != null ? String(client.retirement_age) : null },
        { label: t('EPF Account No.', 'EPF 账号'), key: 'epf_account_number', value: client.epf_account_number },
      ]
    },
  ];

  // Full address block for easy copy
  const fullAddress = [
    client.correspondence_address,
    client.correspondence_city,
    client.correspondence_state,
    client.correspondence_postal_code,
  ].filter(Boolean).join(', ');

  return (
    <div>
      {/* Header */}
      <div className="bg-xin-blue/5 border border-xin-blue/10 rounded-2xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-semibold text-xin-blue text-sm">
              {t('Form Kit', '表格资料')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'Quick reference for filling insurance, investment & compliance forms. Click any field to copy.',
                '填写保险、投资及合规表格时的快速参考。点击任意字段即可复制。'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Quick copy — full address block */}
      {fullAddress && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
              {t('Full Address (copy block)', '完整地址（一键复制）')}
            </span>
            <CopyBtn value={fullAddress} fieldKey="full_address" copied={copied} onCopy={copyField} />
          </div>
          <p className="text-sm text-xin-blue">{fullAddress}</p>
        </div>
      )}

      {/* Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map(section => (
          <div key={section.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{section.title}</span>
            </div>
            <div className="divide-y divide-slate-50">
              {section.fields.map(field => (
                field.value ? (
                  <div key={field.key} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="text-xs text-slate-400 w-28 shrink-0">{field.label}</span>
                      <span className="text-sm font-medium text-xin-blue truncate">{field.value}</span>
                    </div>
                    <CopyBtn value={field.value} fieldKey={field.key} copied={copied} onCopy={copyField} small />
                  </div>
                ) : (
                  <div key={field.key} className="flex items-center px-4 py-2.5">
                    <span className="text-xs text-slate-400 w-28 shrink-0">{field.label}</span>
                    <span className="text-xs text-slate-300 italic">{t('Not filled', '未填写')}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Missing fields alert */}
      {(() => {
        const missing = [
          !client.nric && t('NRIC', '身份证'),
          !client.date_of_birth && t('Date of Birth', '出生日期'),
          !client.phone && t('Phone', '电话'),
          !client.email && t('Email', '电邮'),
          !client.correspondence_address && t('Address', '地址'),
          !client.occupation && t('Occupation', '职业'),
          !client.risk_profile && t('Risk Profile', '风险评级'),
          !client.epf_account_number && 'EPF',
        ].filter(Boolean);

        if (missing.length === 0) return null;

        return (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-base">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">
                  {t('Missing information needed for forms:', '填表时缺少以下资料：')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(missing as string[]).map(m => (
                    <span key={m} className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-md">{m}</span>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  {t('→ Go to Profile tab to fill in the missing details.', '→ 前往资料页面补充缺少的信息。')}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CopyBtn({ value, fieldKey, copied, onCopy, small }: {
  value: string; fieldKey: string; copied: string | null;
  onCopy: (k: string, v: string) => void; small?: boolean;
}) {
  const isCopied = copied === fieldKey;
  return (
    <button
      onClick={() => onCopy(fieldKey, value)}
      className={`shrink-0 transition-all rounded-lg p-1.5 ${
        isCopied
          ? 'text-emerald-500 bg-emerald-50'
          : 'text-slate-300 hover:text-xin-gold hover:bg-xin-gold/10 opacity-0 group-hover:opacity-100'
      }`}
      title="Copy"
    >
      {isCopied ? <Check size={small ? 12 : 14} /> : <Copy size={small ? 12 : 14} />}
    </button>
  );
}
