import React from 'react';
import { KYCData, KYCIncomeData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Wallet, HelpCircle } from 'lucide-react';
import { DebouncedNumberInput } from '../FormInputs';

interface IncomeStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const currentMonth = new Date().getMonth().toString();
const currentYear = new Date().getFullYear().toString();
const MONTHS = [
    { value: '0', en: 'January', zh: '1月' },
    { value: '1', en: 'February', zh: '2月' },
    { value: '2', en: 'March', zh: '3月' },
    { value: '3', en: 'April', zh: '4月' },
    { value: '4', en: 'May', zh: '5月' },
    { value: '5', en: 'June', zh: '6月' },
    { value: '6', en: 'July', zh: '7月' },
    { value: '7', en: 'August', zh: '8月' },
    { value: '8', en: 'September', zh: '9月' },
    { value: '9', en: 'October', zh: '10月' },
    { value: '10', en: 'November', zh: '11月' },
    { value: '11', en: 'December', zh: '12月' }
];
const YEARS = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - 5 + i).toString());

// Tooltip helper component
const Tooltip = ({ text }: { text: string }) => (
    <div className="relative group flex items-center ml-2">
        <HelpCircle size={16} className="text-gray-400 hover:text-xin-blue cursor-pointer" />
        <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-10 text-center font-medium leading-relaxed scale-95 group-hover:scale-100">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
    </div>
);

const IncomeStep: React.FC<IncomeStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const isZh = language === 'zh';
    const labelClasses = "flex items-center text-sm font-semibold text-gray-700 font-sans";
    const selectClasses = "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm cursor-pointer";

    const incomeData = formData.income || {
        salary: '', salaryMonth: currentMonth, salaryYear: currentYear,
        bonus: '', bonusMonth: currentMonth, bonusYear: currentYear,
        directorFee: '', directorFeeMonth: currentMonth, directorFeeYear: currentYear,
        commission: '', commissionMonth: currentMonth, commissionYear: currentYear,
        dividendCompany: '', dividendCompanyMonth: currentMonth, dividendCompanyYear: currentYear,
        dividendInvestment: '', dividendInvestmentMonth: currentMonth, dividendInvestmentYear: currentYear,
        rentalIncome: '', rentalIncomeMonth: currentMonth, rentalIncomeYear: currentYear,
    };

    const updateIncome = (data: Partial<KYCIncomeData>) => {
        updateData({ income: { ...incomeData, ...data } });
    };

    const fields = [
        { key: 'salary', label: '1. Salary', tooltip: 'Enter your fixed, recurring monthly base pay. Do not include one-time bonuses or variable commissions here.' },
        { key: 'bonus', label: '2. Bonus / One-off Incentives', tooltip: 'Include annual bonuses, performance rewards, 13th-month salary, or any one-time cash gifts received this month.' },
        { key: 'directorFee', label: '3. Director / Advisory / Professional Fees', tooltip: 'Fees received for serving on a board of directors, providing formal advisory roles, or specialized consulting services.' },
        { key: 'commission', label: '4. Commission / Referral Fee', tooltip: 'Variable income earned from sales, successful business introductions, or lead referrals.' },
        { key: 'dividendCompany', label: '5. Dividend from Own Company', tooltip: 'Profit distributions or interim dividends declared and paid to you from your own private limited company (Sdn Bhd).' },
        { key: 'dividendInvestment', label: '6. Investment Dividends / Interest', tooltip: 'Passive income earned from public listed stocks, unit trusts, fixed deposits, or digital assets.' },
        { key: 'rentalIncome', label: '7. Rental Income', tooltip: 'Total monthly rent received from residential, commercial properties, or sub-letting arrangements.' },
    ];

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            {/* Form Box */}
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12 relative overflow-visible">
                
                <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-5">
                    <div className="bg-slate-50 border border-xin-gold/20 p-2 rounded-md text-xin-blue">
                        <Wallet size={24} />
                    </div>
                    <h2 className="text-2xl font-serif text-gray-800">{t('income.title')}</h2>
                </div>

                <div className="mb-8 p-4 bg-xin-blue/5 border border-xin-blue/10 rounded-lg flex items-start gap-3">
                    <HelpCircle className="text-xin-blue shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-medium text-xin-dark">
                        {isZh 
                            ? '请点击“！”了解怎么填写，避免客户自己填写错误。' 
                            : 'Please click "!" to understand how to fill it out and avoid input errors.'}
                    </p>
                </div>
                
                <div className="space-y-8">
                    {fields.map((field) => (
                        <div key={field.key} className="bg-slate-50/50 p-5 rounded-lg border border-slate-100/80 hover:border-xin-blue/30 transition-colors">
                            <div className="mb-3 flex items-center">
                                <label className={labelClasses}>{field.label}</label>
                                <Tooltip text={field.tooltip} />
                            </div>
                            
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                    <span className="text-gray-500 font-medium">RM</span>
                                </div>
                                <DebouncedNumberInput 
                                    className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm transition-shadow"
                                    value={(incomeData as any)[field.key] || ''}
                                    onChange={(val) => updateIncome({ [field.key]: val })}
                                    placeholder="0"
                                />
                            </div>
                            
                            {/* Month/Year Selection */}
                            <div className="flex gap-3 mt-3">
                                <select
                                    className={selectClasses + ' flex-1'}
                                    value={(incomeData as any)[`${field.key}Month`] || currentMonth}
                                    onChange={(e) => updateIncome({ [`${field.key}Month`]: e.target.value })}
                                >
                                    {MONTHS.map(m => (
                                        <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>
                                    ))}
                                </select>
                                <select
                                    className={selectClasses + ' w-28'}
                                    value={(incomeData as any)[`${field.key}Year`] || currentYear}
                                    onChange={(e) => updateIncome({ [`${field.key}Year`]: e.target.value })}
                                >
                                    {YEARS.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center bg-white">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> {t('basic.back')}
                    </button>
                    <button 
                        onClick={onNext} 
                        className="px-8 py-2.5 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white font-medium rounded-md hover:from-xin-dark hover:to-xin-blue flex items-center gap-2 transition-colors shadow-sm"
                    >
                        {t('basic.continue')} <span>&gt;</span>
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default IncomeStep;
