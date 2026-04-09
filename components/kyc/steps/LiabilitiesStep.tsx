import React, { useState } from 'react';
import { KYCData, FinancialItem, KYCLiabilitiesData } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Home, Car, GraduationCap, Percent, HardHat, FolderPlus, Trash2, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { DebouncedTextInput, DebouncedNumberInput } from '../FormInputs';

interface LiabilitiesStepProps {
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

const LiabilitiesStep: React.FC<LiabilitiesStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const isZh = language === 'zh';
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    const selectClasses = "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm cursor-pointer";
    
    // Safety check just in case formData.liabilities is somehow missing
    const liabilitiesData = formData.liabilities || {
        studyLoans: [],
        personalLoans: [],
        renovationLoans: [],
        otherLoans: []
    };

    const updateLiabilities = (data: Partial<KYCLiabilitiesData>) => {
        updateData({ liabilities: { ...liabilitiesData, ...data } });
    };

    const addLoanItem = (collectionPath: keyof KYCLiabilitiesData) => {
        const newItems = [...liabilitiesData[collectionPath], { 
            id: Date.now().toString() + Math.random().toString(), 
            amount: '', 
            description: '',
            month: new Date().getMonth().toString(),
            year: new Date().getFullYear().toString()
        }];
        updateLiabilities({ [collectionPath]: newItems });
        setExpandedCard(collectionPath as string);
    };

    const removeLoanItem = (collectionPath: keyof KYCLiabilitiesData, idToRemove: string) => {
        const newItems = liabilitiesData[collectionPath].filter((item: FinancialItem) => item.id !== idToRemove);
        updateLiabilities({ [collectionPath]: newItems });
        if (newItems.length === 0) setExpandedCard(null);
    };

    const updateLoanItemField = (
        collectionPath: keyof KYCLiabilitiesData, 
        idToUpdate: string, 
        field: keyof FinancialItem, 
        value: any
    ) => {
        const newItems = liabilitiesData[collectionPath].map((item: FinancialItem) => {
            if (item.id !== idToUpdate) return item;
            
            const updatedItem = { ...item, [field]: value };
            
            // Sync 'amount' and 'outstandingBalance'
            if (field === 'amount') updatedItem.outstandingBalance = value;
            if (field === 'outstandingBalance') updatedItem.amount = value;

            if (updatedItem.isUnderLoan) {
                // Auto calculate loan end date if tenure or start date changes
                if (field === 'tenure' || field === 'loanCommencementMonth' || field === 'loanCommencementYear') {
                    const startY = parseInt(updatedItem.loanCommencementYear || new Date().getFullYear().toString());
                    const startM = parseInt(updatedItem.loanCommencementMonth || new Date().getMonth().toString());
                    const t = parseFloat(updatedItem.tenure || '0');
                    if (t > 0) {
                        let endM = startM + t * 12;
                        let endY = startY + Math.floor(endM / 12);
                        endM = endM % 12;
                        updatedItem.loanEndMonth = endM.toString();
                        updatedItem.loanEndYear = endY.toString();
                    } else {
                        updatedItem.loanEndMonth = '';
                        updatedItem.loanEndYear = '';
                    }
                }

                // Auto calculate monthly installment if loan inputs change
                const loanFields = ['outstandingBalance', 'amount', 'originalLoanAmount', 'interestRate', 'tenure', 'loanCommencementYear', 'loanCommencementMonth'];
                if (loanFields.includes(field as string)) {
                    const balance = parseFloat(updatedItem.outstandingBalance?.toString().replace(/,/g, '') || '0');
                    const rate = parseFloat(updatedItem.interestRate || '0');
                    const tenure = parseFloat(updatedItem.tenure || '0');
                    const startYear = parseInt(updatedItem.loanCommencementYear || new Date().getFullYear().toString());
                    const startMonth = parseInt(updatedItem.loanCommencementMonth || new Date().getMonth().toString());
                    
                    if (balance > 0 && rate > 0 && tenure > 0) {
                        const elapsedMonths = (new Date().getFullYear() - startYear) * 12 + (new Date().getMonth() - startMonth);
                        const totalMonths = tenure * 12;
                        const remainingMonths = totalMonths - elapsedMonths;
                        
                        if (remainingMonths > 0) {
                            let installment = 0;
                            // Use Flat Rate formula for all other liabilities (Study, Personal, Renovation, Others)
                            installment = (balance * (1 + (rate / 100) * tenure)) / remainingMonths;
                            updatedItem.monthlyInstallment = Math.round(installment).toString();
                        } else {
                            updatedItem.monthlyInstallment = '0';
                        }
                    } else if (field !== 'monthlyInstallment') {
                        // don't clear if user is editing monthlyInstallment directly
                    }
                }
            } else {
                updatedItem.monthlyInstallment = '';
                updatedItem.interestRate = '';
                updatedItem.tenure = '';
                updatedItem.loanEndMonth = '';
                updatedItem.loanEndYear = '';
            }
            
            
            return updatedItem;
        });
        updateLiabilities({ [collectionPath]: newItems });
    };

    // Reusable render function for Loans (prevents input focus loss)
    const renderExpandableLoanCard = ( 
        title: string, 
        Icon: React.ElementType, 
        collectionPath: keyof KYCLiabilitiesData 
    ) => {
        const items = liabilitiesData[collectionPath];
        const hasItems = items.length > 0;
        const isOpen = expandedCard === (collectionPath as string);

        if (!hasItems) {
            return (
                <div className="border border-gray-200 rounded-lg p-5 mb-6 flex items-center justify-between bg-white shadow-sm hover:border-blue-200 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                            <Icon size={24} />
                        </div>
                        <span className="font-semibold text-gray-800">{title}</span>
                    </div>
                    <button 
                        onClick={() => addLoanItem(collectionPath)} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors"
                    >
                        <PlusCircle size={18} /> {t('liabilities.addBtn')}
                    </button>
                </div>
            );
        }

        return (
            <div className="border border-gray-200 rounded-lg mb-6 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div 
                    className="p-5 flex items-center justify-between border-b border-gray-100 cursor-pointer bg-white"
                    onClick={() => setExpandedCard(isOpen ? null : (collectionPath as string))}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                            <Icon size={24} />
                        </div>
                        <span className="font-semibold text-gray-800">{title} ({items.length})</span>
                    </div>
                    <button className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        {isOpen ? t('common.collapse') : t('common.expand')}
                    </button>
                </div>
                
                {/* Body */}
                {isOpen && (
                    <div className="bg-slate-50 p-6 space-y-6">
                        {items.map((item: FinancialItem) => (
                            <div key={item.id} className="relative bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                                <div className="flex justify-end mb-4 border-b border-gray-100 pb-3">
                                    <button 
                                        onClick={() => removeLoanItem(collectionPath, item.id)} 
                                        className="text-red-500 flex items-center gap-1.5 hover:text-red-700 text-sm font-medium transition-colors"
                                    >
                                        <Trash2 size={16} /> {t('common.delete')}
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input 
                                            type="checkbox" 
                                            id={`loan-${item.id}`}
                                            className="w-4 h-4 text-xin-cyan bg-gray-100 border-gray-300 rounded focus:ring-xin-cyan"
                                            checked={!!item.isUnderLoan}
                                            onChange={(e) => updateLoanItemField(collectionPath, item.id, 'isUnderLoan', e.target.checked)}
                                        />
                                        <label htmlFor={`loan-${item.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                                            {isZh ? '仍在贷款中？' : 'Is it still under loan?'}
                                        </label>
                                    </div>

                                    {item.isUnderLoan && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                                            <div>
                                                <label className={labelClasses}>
                                                    {t('common.originalLoanAmount')} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                                </label>
                                                <div className="relative mt-1">
                                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                        <span className="text-gray-500 font-medium">RM</span>
                                                    </div>
                                                    <DebouncedNumberInput 
                                                        className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                        value={item.originalLoanAmount || ''}
                                                        onChange={(val) => updateLoanItemField(collectionPath, item.id, 'originalLoanAmount', val)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>
                                                    {isZh ? '未偿还余额' : 'Outstanding Balance'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                                </label>
                                                <div className="relative mt-1">
                                                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                        <span className="text-gray-500 font-medium">RM</span>
                                                    </div>
                                                    <DebouncedNumberInput 
                                                        className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                        value={item.amount || item.outstandingBalance || ''}
                                                        onChange={(val) => updateLoanItemField(collectionPath, item.id, 'amount', val)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>{isZh ? '年利率' : 'Interest Rate'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                <div className="relative mt-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className="w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                        value={item.interestRate || ''}
                                                        onChange={(e) => updateLoanItemField(collectionPath, item.id, 'interestRate', e.target.value)}
                                                    />
                                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                        <span className="text-gray-500 font-medium">%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>{isZh ? '贷款期限 (年)' : 'Tenure (Years)'}</label>
                                                <input
                                                    type="number"
                                                    className="w-full mt-1 px-3 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                    value={item.tenure || ''}
                                                    onChange={(e) => updateLoanItemField(collectionPath, item.id, 'tenure', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className={labelClasses}>{isZh ? '贷款开始时间' : 'Loan Commencement'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                <div className="flex gap-2 mt-1">
                                                    <select
                                                        className={selectClasses + ' flex-1'}
                                                        value={item.loanCommencementMonth || new Date().getMonth().toString()}
                                                        onChange={(e) => updateLoanItemField(collectionPath, item.id, 'loanCommencementMonth', e.target.value)}
                                                    >
                                                        {MONTHS.map(m => (
                                                            <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        className={selectClasses + ' w-28'}
                                                        value={item.loanCommencementYear || new Date().getFullYear().toString()}
                                                        onChange={(e) => updateLoanItemField(collectionPath, item.id, 'loanCommencementYear', e.target.value)}
                                                    >
                                                        {Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - 25 + i).toString()).map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClasses}>{isZh ? '计算出的结束时间 / 可修改' : 'Loan End (Calculated / Editable)'}</label>
                                                <div className="flex gap-2 mt-1">
                                                    <select
                                                        className={selectClasses + ' flex-1'}
                                                        value={item.loanEndMonth || ''}
                                                        onChange={(e) => updateLoanItemField(collectionPath, item.id, 'loanEndMonth', e.target.value)}
                                                    >
                                                        <option value="" disabled>-</option>
                                                        {MONTHS.map(m => (
                                                            <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>
                                                        ))}
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="YYYY"
                                                        className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm"
                                                        value={item.loanEndYear || ''}
                                                        onChange={(e) => updateLoanItemField(collectionPath, item.id, 'loanEndYear', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-span-1 md:col-span-2">
                                                <label className={labelClasses}>{isZh ? '每月供款 (自动计算 / 可修改)' : 'Monthly Installment (Auto / Editable)'}</label>
                                                <div className="relative mt-1">
                                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none border-r border-gray-200 pr-2 my-px bg-slate-50 rounded-l-md">
                                                        <span className="text-gray-500 text-sm font-medium">RM</span>
                                                    </div>
                                                    <DebouncedNumberInput
                                                        className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm font-bold text-xin-dark"
                                                        value={item.monthlyInstallment || ''}
                                                        onChange={(val) => updateLoanItemField(collectionPath, item.id, 'monthlyInstallment', val)}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className={labelClasses}>
                                            {t('common.description')} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            maxLength={100}
                                            className={inputClasses}
                                            value={item.description}
                                            onChange={(e) => updateLoanItemField(collectionPath, item.id, 'description', e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('common.maxChars')}</p>
                                    </div>


                                </div>
                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={() => addLoanItem(collectionPath)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-xin-cyan transition-colors bg-slate-50 px-4 py-2 rounded-full border border-xin-cyan/20"
                            >
                                <PlusCircle size={18} /> {isZh ? '添加另一项贷款' : 'Add Another Loan'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            {/* Form Box */}
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-gray-100 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-50 border border-xin-gold/20 p-2 rounded-md text-xin-blue">
                            <GraduationCap size={24} />
                        </div>
                        <h2 className="text-2xl font-serif text-gray-800">{t('liabilities.title')}</h2>
                    </div>

                    {/* Global Date Selector */}
                    <div className="flex gap-2">
                        <select
                            className={selectClasses}
                            value={formData.globalMonth}
                            onChange={(e) => updateData({ globalMonth: e.target.value })}
                        >
                            {MONTHS.map(m => (
                                <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>
                            ))}
                        </select>
                        <select
                            className={selectClasses}
                            value={formData.globalYear}
                            onChange={(e) => updateData({ globalYear: e.target.value })}
                        >
                            {YEARS.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="space-y-4">
                    {renderExpandableLoanCard(t('liabilities.study'), GraduationCap, "studyLoans")}
                    {renderExpandableLoanCard(isZh ? '个人贷款' : 'Personal Loans', Percent, "personalLoans")}
                    {renderExpandableLoanCard(t('liabilities.renovation'), HardHat, "renovationLoans")}
                    {renderExpandableLoanCard(t('liabilities.others'), FolderPlus, "otherLoans")}
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

export default LiabilitiesStep;
