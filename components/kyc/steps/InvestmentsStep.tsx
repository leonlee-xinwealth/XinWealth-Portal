import React, { useState } from 'react';
import { KYCData, FinancialItem, KYCInvestmentsData } from '../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Trash2, ChevronDown, ChevronUp, PlusCircle, TrendingUp, Briefcase, DollarSign, Wallet, LineChart, Building2, FolderPlus, Home } from 'lucide-react';
import { DebouncedTextInput, DebouncedNumberInput } from '../FormInputs';

interface InvestmentsStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const InvestmentsStep: React.FC<InvestmentsStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const isZh = language === 'zh';
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    
    // Safety check just in case formData.investments is somehow missing
    const investmentsData = formData.investments || {
        etf: [],
        bonds: [],
        stocks: [],
        unitTrusts: [],
        fixedDeposits: [],
        forex: [],
        moneyMarket: [],
        otherInvestments: []
    };

    const updateInvestments = (data: Partial<KYCInvestmentsData>) => {
        updateData({ investments: { ...investmentsData, ...data } });
    };

    const addInvestmentItem = (collectionPath: keyof KYCInvestmentsData) => {
        const newArray = investmentsData[collectionPath] || [];
        const newItems = [...newArray, { id: Date.now().toString() + Math.random().toString(), amount: '', description: '' }];
        updateInvestments({ [collectionPath]: newItems });
        setExpandedCard(collectionPath as string);
    };

    const removeInvestmentItem = (collectionPath: keyof KYCInvestmentsData, idToRemove: string) => {
        const newArray = investmentsData[collectionPath] || [];
        const newItems = newArray.filter((item: FinancialItem) => item.id !== idToRemove);
        updateInvestments({ [collectionPath]: newItems });
        if (newItems.length === 0) setExpandedCard(null);
    };

    const updateInvestmentItemField = (collectionPath: keyof KYCInvestmentsData, idToUpdate: string, field: keyof FinancialItem, value: any) => {
        const newArray = investmentsData[collectionPath] || [];
        const newItems = newArray.map((item: FinancialItem) => {
            if (item.id !== idToUpdate) return item;
            
            const updatedItem = { ...item, [field]: value };
            
            // Handle loan calculation for Investment Properties (which uses the 'fixedDeposits' key)
            if (collectionPath === 'fixedDeposits') {
                if (updatedItem.isUnderLoan) {
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
                            // Reducing Balance Method for Property
                            const monthlyRate = rate / 100 / 12;
                            const installment = balance * (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / (Math.pow(1 + monthlyRate, remainingMonths) - 1);
                            updatedItem.monthlyInstallment = Math.round(installment).toString();
                        } else {
                            updatedItem.monthlyInstallment = '0';
                        }
                    } else {
                        updatedItem.monthlyInstallment = '';
                    }
                } else {
                    updatedItem.monthlyInstallment = '';
                    updatedItem.outstandingBalance = '';
                    updatedItem.interestRate = '';
                    updatedItem.tenure = '';
                }
            }
            
            return updatedItem;
        });
        updateInvestments({ [collectionPath]: newItems });
    };

    // Reusable render function for Investments (prevents input focus loss)
    const renderExpandableInvestmentCard = ( 
        title: string, 
        Icon: React.ElementType, 
        collectionPath: keyof KYCInvestmentsData 
    ) => {
        const items = investmentsData[collectionPath] || [];
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
                        onClick={() => addInvestmentItem(collectionPath)} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors"
                    >
                        <PlusCircle size={18} /> {t('investments.add')}
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
                        {items.map((item: FinancialItem, index: number) => (
                            <div key={item.id} className="relative bg-white p-6 rounded-md border border-gray-200 shadow-sm">
                                <div className="flex justify-end mb-4 border-b border-gray-100 pb-3">
                                    <button 
                                        onClick={() => removeInvestmentItem(collectionPath, item.id)} 
                                        className="text-red-500 flex items-center gap-1.5 hover:text-red-700 text-sm font-medium transition-colors"
                                    >
                                        <Trash2 size={16} /> {t('common.delete')}
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className={labelClasses}>
                                            {t('common.value')} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                        </label>
                                        <div className="relative mt-1">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                <span className="text-gray-500 font-medium">RM</span>
                                            </div>
                                            <DebouncedNumberInput 
                                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                value={item.amount}
                                                onChange={(val) => updateInvestmentItemField(collectionPath, item.id, 'amount', val)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>
                                            {t('common.description')} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                        </label>
                                        <DebouncedTextInput 
                                            maxLength={100}
                                            className={inputClasses}
                                            value={item.description}
                                            onChange={(val) => updateInvestmentItemField(collectionPath, item.id, 'description', val)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('common.maxChars')}</p>
                                    </div>

                                    {/* Loan Details for Investment Properties */}
                                    {collectionPath === 'fixedDeposits' && (
                                        <div className="pt-4 border-t border-gray-100">
                                            <div className="flex items-center gap-2 mb-4">
                                                <input 
                                                    type="checkbox" 
                                                    id={`loan-${item.id}`}
                                                    className="w-4 h-4 text-xin-cyan bg-gray-100 border-gray-300 rounded focus:ring-xin-cyan"
                                                    checked={!!item.isUnderLoan}
                                                    onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'isUnderLoan', e.target.checked)}
                                                />
                                                <label htmlFor={`loan-${item.id}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                                                    {isZh ? '仍在贷款中？' : 'Is it still under loan?'}
                                                </label>
                                            </div>
                                            
                                            {item.isUnderLoan && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                                                    <div>
                                                        <label className={labelClasses}>{isZh ? '未偿还余额' : 'Outstanding Balance'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                        <div className="relative mt-1">
                                                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none border-r border-gray-200 pr-2 my-px bg-slate-50 rounded-l-md">
                                                                <span className="text-gray-500 text-sm font-medium">RM</span>
                                                            </div>
                                                            <DebouncedNumberInput
                                                                className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm"
                                                                value={item.outstandingBalance || ''}
                                                                onChange={(val) => updateInvestmentItemField(collectionPath, item.id, 'outstandingBalance', val)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>{isZh ? '年利率' : 'Interest Rate'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                        <div className="relative mt-1">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm"
                                                                value={item.interestRate || ''}
                                                                onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'interestRate', e.target.value)}
                                                            />
                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                                                <span className="text-gray-500 text-sm font-medium">%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>{isZh ? '贷款期限 (年)' : 'Tenure (Years)'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                        <input
                                                            type="number"
                                                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm"
                                                            value={item.tenure || ''}
                                                            onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'tenure', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={labelClasses}>{isZh ? '贷款开始时间' : 'Loan Commencement'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span></label>
                                                        <div className="flex gap-2 mt-1">
                                                            <select
                                                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm cursor-pointer flex-1"
                                                                value={item.loanCommencementMonth || new Date().getMonth().toString()}
                                                                onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'loanCommencementMonth', e.target.value)}
                                                            >
                                                                {[
                                                                    { value: '0', en: 'January', zh: '1月' }, { value: '1', en: 'February', zh: '2月' }, { value: '2', en: 'March', zh: '3月' },
                                                                    { value: '3', en: 'April', zh: '4月' }, { value: '4', en: 'May', zh: '5月' }, { value: '5', en: 'June', zh: '6月' },
                                                                    { value: '6', en: 'July', zh: '7月' }, { value: '7', en: 'August', zh: '8月' }, { value: '8', en: 'September', zh: '9月' },
                                                                    { value: '9', en: 'October', zh: '10月' }, { value: '10', en: 'November', zh: '11月' }, { value: '11', en: 'December', zh: '12月' }
                                                                ].map(m => (
                                                                    <option key={m.value} value={m.value}>{isZh ? m.zh : m.en}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm text-sm cursor-pointer w-24"
                                                                value={item.loanCommencementYear || new Date().getFullYear().toString()}
                                                                onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'loanCommencementYear', e.target.value)}
                                                            >
                                                                {Array.from({ length: 30 }, (_, i) => (new Date().getFullYear() - 25 + i).toString()).map(y => (
                                                                    <option key={y} value={y}>{y}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    {item.monthlyInstallment && (
                                                        <div className="col-span-1 md:col-span-2 mt-2 p-3 bg-xin-blue/5 border border-xin-blue/20 rounded-md flex justify-between items-center">
                                                            <span className="text-sm font-semibold text-xin-blue">{isZh ? '计算出的每月供款：' : 'Calculated Monthly Installment:'}</span>
                                                            <span className="text-lg font-bold text-xin-dark">RM {parseInt(item.monthlyInstallment).toLocaleString('en-US')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={() => addInvestmentItem(collectionPath)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-xin-cyan transition-colors bg-slate-50 px-4 py-2 rounded-full border border-xin-cyan/20"
                            >
                                <PlusCircle size={18} /> {isZh ? '添加另一项投资' : 'Add Another Investment'}
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
                
                <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                    <div className="bg-slate-50 border border-xin-gold/20 p-2 rounded-md text-xin-blue">
                        <LineChart size={24} />
                    </div>
                    <h2 className="text-2xl font-serif text-gray-800">{t('investments.title')}</h2>
                </div>
                
                <div className="space-y-4">
                    {renderExpandableInvestmentCard(t('investments.etf'), TrendingUp, "etf")}
                    {renderExpandableInvestmentCard(t('investments.bonds'), Briefcase, "bonds")}
                    {renderExpandableInvestmentCard(t('investments.stocks'), LineChart, "stocks")}
                    {renderExpandableInvestmentCard(t('investments.unitTrusts'), Building2, "unitTrusts")}
                    {renderExpandableInvestmentCard(t('investments.fixedDeposits'), Home, "fixedDeposits")}
                    {renderExpandableInvestmentCard(t('investments.forex'), DollarSign, "forex")}
                    {renderExpandableInvestmentCard(t('investments.money'), Wallet, "moneyMarket")}
                    {renderExpandableInvestmentCard(t('investments.others'), FolderPlus, "otherInvestments")}
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

export default InvestmentsStep;
