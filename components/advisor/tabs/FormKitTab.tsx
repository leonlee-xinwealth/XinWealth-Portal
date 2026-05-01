import React, { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Copy, Check, Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface Props { client: any; advisor?: any; }

// ── Helper ───────────────────────────────────────────────────────
function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(key: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }
  return { copied, copy };
}

// ── Main Component ───────────────────────────────────────────────
export default function FormKitTab({ client }: Props) {
  const { language } = useLanguage();
  const t = (en: string, zh: string) => language === 'zh' ? zh : en;
  const { copied, copy } = useClipboard();
  const [openSection, setOpenSection] = useState<string | null>('prs');
  const [emailType, setEmailType] = useState('motor');
  const [showEmail, setShowEmail] = useState(false);

  const age = client.date_of_birth
    ? Math.floor((Date.now() - new Date(client.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null;

  const fullAddress = [client.correspondence_address, client.correspondence_city, client.correspondence_state, client.correspondence_postal_code].filter(Boolean).join(', ');

  // ── Missing fields check ─────────────────────────────────────
  const missingForPRS = [
    !client.full_name && 'Full Name',
    !client.nric && 'NRIC',
    !client.date_of_birth && 'Date of Birth',
    !client.race && 'Race',
    !client.tin_number && 'TIN',
    !client.correspondence_address && 'Address',
    !client.epf_account_number && 'EPF Account',
    !client.bank_name && 'Bank Name',
    !client.bank_account_number && 'Bank Account No.',
    !client.source_of_funds && 'Source of Funds',
  ].filter(Boolean) as string[];

  const missingForPMF = [
    !client.full_name && 'Full Name',
    !client.nric && 'NRIC',
    !client.date_of_birth && 'Date of Birth',
    !client.race && 'Race',
    !client.tin_number && 'TIN',
    !client.risk_profile && 'Risk Profile',
    !client.correspondence_address && 'Address',
    !client.bank_name && 'Bank Name',
    !client.bank_account_number && 'Bank Account No.',
    !client.source_of_funds && 'Source of Funds',
  ].filter(Boolean) as string[];

  // ── Email templates ──────────────────────────────────────────
  const emailTemplates: Record<string, { subject: string; body: string }> = {
    motor: {
      subject: `Motor Insurance Quotation – ${client.full_name}`,
      body: `Hi,

Please provide a motor insurance quotation for my client:

Name: ${client.full_name || '—'}
NRIC: ${client.nric || '—'}
Date of Birth: ${client.date_of_birth || '—'}
Contact: ${client.phone || '—'}
Email: ${client.email || '—'}

Please advise on the best available plan.

Thank you.`,
    },
    home: {
      subject: `Home/Property Insurance Quotation – ${client.full_name}`,
      body: `Hi,

Please provide a home insurance quotation for my client:

Name: ${client.full_name || '—'}
NRIC: ${client.nric || '—'}
Date of Birth: ${client.date_of_birth || '—'}
Contact: ${client.phone || '—'}
Email: ${client.email || '—'}
Property Address: ${fullAddress || '—'}

Please advise on the best available plan.

Thank you.`,
    },
    medical: {
      subject: `Medical/Health Insurance Quotation – ${client.full_name}`,
      body: `Hi,

Please provide a medical insurance quotation for my client:

Name: ${client.full_name || '—'}
NRIC: ${client.nric || '—'}
Date of Birth: ${client.date_of_birth || '—'}
Age: ${age || '—'}
Gender: ${client.gender || '—'}
Occupation: ${client.occupation || '—'}
Contact: ${client.phone || '—'}
Email: ${client.email || '—'}

Please advise on the best available plan.

Thank you.`,
    },
    travel: {
      subject: `Travel Insurance – ${client.full_name}`,
      body: `Hi,

Please provide a travel insurance quotation for my client:

Name: ${client.full_name || '—'}
NRIC/Passport: ${client.nric || '—'}
Date of Birth: ${client.date_of_birth || '—'}
Contact: ${client.phone || '—'}
Email: ${client.email || '—'}

[Please provide travel destination, dates, and number of travellers]

Thank you.`,
    },
  };

  const toggle = (key: string) => setOpenSection(prev => prev === key ? null : key);

  // ── Sections ─────────────────────────────────────────────────
  const sections = [
    {
      key: 'prs',
      title: t('PRS Application', 'PRS 申请表'),
      emoji: '🏦',
      missing: missingForPRS,
      fields: [
        { label: 'Full Name', value: client.full_name },
        { label: 'NRIC No.', value: client.nric },
        { label: 'Date of Birth', value: client.date_of_birth },
        { label: 'Age', value: age?.toString() },
        { label: 'Gender', value: client.gender },
        { label: 'Race', value: client.race },
        { label: 'Nationality', value: client.nationality },
        { label: 'Marital Status', value: client.marital_status },
        { label: 'Religion', value: null, note: t('Fill manually', '手动填写') },
        { label: 'Mobile No.', value: client.phone },
        { label: 'Email', value: client.email },
        { label: 'Correspondence Address', value: fullAddress },
        { label: 'Postcode', value: client.correspondence_postal_code },
        { label: 'City', value: client.correspondence_city },
        { label: 'State', value: client.correspondence_state },
        { label: 'Occupation', value: client.occupation },
        { label: 'Employer / Company', value: client.employer_name },
        { label: 'Source of Funds', value: client.source_of_funds },
        { label: 'Tax Residency', value: client.tax_residency },
        { label: 'TIN', value: client.tin_number },
        { label: 'EPF Account No.', value: client.epf_account_number },
        { label: 'PPA Account No.', value: client.ppa_account_number },
        { label: 'Bank Name', value: client.bank_name },
        { label: 'Bank Account No.', value: client.bank_account_number },
        { label: 'PEP Declaration', value: client.pep_status ? 'Yes' : 'No' },
      ],
    },
    {
      key: 'pmf',
      title: t('Private Mandate Fund', 'Private Mandate Fund'),
      emoji: '📊',
      missing: missingForPMF,
      fields: [
        { label: 'Full Name', value: client.full_name },
        { label: 'NRIC No.', value: client.nric },
        { label: 'Date of Birth', value: client.date_of_birth },
        { label: 'Age', value: age?.toString() },
        { label: 'Gender', value: client.gender },
        { label: 'Race', value: client.race },
        { label: 'Nationality', value: client.nationality },
        { label: 'Marital Status', value: client.marital_status },
        { label: 'Mobile No.', value: client.phone },
        { label: 'Email', value: client.email },
        { label: 'Correspondence Address', value: fullAddress },
        { label: 'Occupation', value: client.occupation },
        { label: 'Employer / Company', value: client.employer_name },
        { label: 'Source of Funds', value: client.source_of_funds },
        { label: 'Tax Residency', value: client.tax_residency },
        { label: 'TIN', value: client.tin_number },
        { label: 'Risk Profile', value: client.risk_profile },
        { label: 'Investment Objective', value: null, note: t('Fill with client', '与客户确认') },
        { label: 'Investment Horizon', value: null, note: t('Fill with client', '与客户确认') },
        { label: 'Bank Name', value: client.bank_name },
        { label: 'Bank Account No.', value: client.bank_account_number },
        { label: 'PEP Declaration', value: client.pep_status ? 'Yes' : 'No' },
      ],
    },
    {
      key: 'life',
      title: t('Life Insurance (iPad App Reference)', '寿险（iPad App 参考）'),
      emoji: '🛡️',
      missing: [],
      fields: [
        { label: 'Full Name', value: client.full_name },
        { label: 'NRIC No.', value: client.nric },
        { label: 'Date of Birth', value: client.date_of_birth },
        { label: 'Age', value: age?.toString() },
        { label: 'Gender', value: client.gender },
        { label: 'Nationality', value: client.nationality },
        { label: 'Smoker Status', value: null, note: t('Ask client', '询问客户') },
        { label: 'Mobile No.', value: client.phone },
        { label: 'Email', value: client.email },
        { label: 'Correspondence Address', value: fullAddress },
        { label: 'Occupation', value: client.occupation },
        { label: 'Employer / Company', value: client.employer_name },
        { label: 'Annual Income', value: null, note: t('Refer to Cash Flow tab', '参考收支页面') },
        { label: 'EPF Account No.', value: client.epf_account_number },
        { label: 'Marital Status', value: client.marital_status },
        { label: 'No. of Dependants', value: client.number_of_dependants?.toString() },
        { label: 'Source of Funds', value: client.source_of_funds },
        { label: 'PEP Declaration', value: client.pep_status ? 'Yes' : 'No' },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-xin-blue/5 border border-xin-blue/10 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h3 className="font-semibold text-xin-blue text-sm">{t('Form Kit', '表格资料')}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'Reference panel for filling forms. Click any field to copy. Fields with notes need manual input.',
                '填表时的快速参考。点击字段即可复制。有备注的字段需要手动填写。'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Accordion sections for PRS / PMF / Life */}
      {sections.map(section => (
        <div key={section.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <button
            onClick={() => toggle(section.key)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{section.emoji}</span>
              <span className="font-semibold text-xin-blue text-sm">{section.title}</span>
              {section.missing.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {section.missing.length} {t('missing', '缺少')}
                </span>
              )}
            </div>
            {openSection === section.key ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>

          {openSection === section.key && (
            <div className="border-t border-slate-100">
              {/* Missing fields warning */}
              {section.missing.length > 0 && (
                <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
                  <span className="text-amber-500 text-sm">⚠️</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">{t('Missing fields:', '缺少字段：')}</p>
                    <div className="flex flex-wrap gap-1">
                      {section.missing.map(m => (
                        <span key={m} className="bg-amber-100 text-amber-700 text-[10px] font-medium px-2 py-0.5 rounded-md">{m}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1.5">→ {t('Update in Profile tab', '在资料页面补充')}</p>
                  </div>
                </div>
              )}

              {/* Fields */}
              <div className="divide-y divide-slate-50">
                {section.fields.map(field => (
                  <div key={field.label} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs text-slate-400 w-40 shrink-0">{field.label}</span>
                      {field.value ? (
                        <span className="text-sm font-medium text-xin-blue truncate">{field.value}</span>
                      ) : field.note ? (
                        <span className="text-xs text-slate-300 italic">{field.note}</span>
                      ) : (
                        <span className="text-xs text-red-300 italic">{t('Not filled', '未填写')}</span>
                      )}
                    </div>
                    {field.value && (
                      <button
                        onClick={() => copy(`${section.key}-${field.label}`, field.value!)}
                        className={`ml-2 shrink-0 p-1.5 rounded-lg transition-all ${
                          copied === `${section.key}-${field.label}`
                            ? 'text-emerald-500 bg-emerald-50'
                            : 'text-slate-300 hover:text-xin-gold hover:bg-xin-gold/10 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {copied === `${section.key}-${field.label}` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* General Insurance Email Generator */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowEmail(!showEmail)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📧</span>
            <span className="font-semibold text-xin-blue text-sm">{t('General Insurance Email', '一般保险邮件')}</span>
            <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              {t('Auto-generate', '自动生成')}
            </span>
          </div>
          {showEmail ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showEmail && (
          <div className="border-t border-slate-100 p-5">
            {/* Type selector */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {[
                { key: 'motor', label: t('🚗 Motor', '🚗 汽车') },
                { key: 'home', label: t('🏠 Home', '🏠 房屋') },
                { key: 'medical', label: t('🏥 Medical', '🏥 医疗') },
                { key: 'travel', label: t('✈️ Travel', '✈️ 旅游') },
              ].map(type => (
                <button
                  key={type.key}
                  onClick={() => setEmailType(type.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    emailType === type.key
                      ? 'bg-xin-blue text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>

            {/* Subject */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">{t('Subject', '主题')}</label>
                <button
                  onClick={() => copy('email-subject', emailTemplates[emailType].subject)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                    copied === 'email-subject' ? 'text-emerald-600 bg-emerald-50' : 'text-xin-gold hover:bg-xin-gold/10'
                  }`}
                >
                  {copied === 'email-subject' ? <Check size={11} /> : <Copy size={11} />}
                  {t('Copy', '复制')}
                </button>
              </div>
              <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-xin-blue border border-slate-200">
                {emailTemplates[emailType].subject}
              </div>
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">{t('Email Body', '邮件内容')}</label>
                <button
                  onClick={() => copy('email-body', emailTemplates[emailType].body)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all ${
                    copied === 'email-body' ? 'text-emerald-600 bg-emerald-50' : 'text-xin-gold hover:bg-xin-gold/10'
                  }`}
                >
                  {copied === 'email-body' ? <Check size={11} /> : <Copy size={11} />}
                  {copied === 'email-body' ? t('Copied!', '已复制！') : t('Copy All', '复制全部')}
                </button>
              </div>
              <pre className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-700 border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {emailTemplates[emailType].body}
              </pre>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              💡 {t('Copy the email body → paste into your email client → fill in remaining details.', '复制邮件内容 → 粘贴到邮件客户端 → 补充剩余信息。')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
