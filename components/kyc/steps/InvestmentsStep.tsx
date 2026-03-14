import React, { useState } from 'react';
import { KYCData, FinancialItem, KYCInvestmentsData } from '../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Trash2, ChevronDown, ChevronUp, PlusCircle, TrendingUp, Briefcase, Landmark, DollarSign, Wallet, LineChart, Building2, FolderPlus } from 'lucide-react';

interface InvestmentsStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const InvestmentsStep: React.FC<InvestmentsStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
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
    };

    const removeInvestmentItem = (collectionPath: keyof KYCInvestmentsData, idToRemove: string) => {
        const newArray = investmentsData[collectionPath] || [];
        const newItems = newArray.filter((item: FinancialItem) => item.id !== idToRemove);
        updateInvestments({ [collectionPath]: newItems });
    };

    const updateInvestmentItemField = (collectionPath: keyof KYCInvestmentsData, idToUpdate: string, field: 'amount' | 'description', value: string) => {
        const newArray = investmentsData[collectionPath] || [];
        const newItems = newArray.map((item: FinancialItem) => 
            item.id === idToUpdate ? { ...item, [field]: value } : item
        );
        updateInvestments({ [collectionPath]: newItems });
    };

    // Reusable Expandable Card for Investments
    const ExpandableInvestmentCard = ({ 
        title, 
        icon: Icon, 
        collectionPath, 
    }: { 
        title: string, 
        icon: React.ElementType, 
        collectionPath: keyof KYCInvestmentsData,
    }) => {
        const items = investmentsData[collectionPath] || [];
        const hasItems = items.length > 0;
        const [isCollapsed, setIsCollapsed] = useState(false);

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
                        <PlusCircle size={18} /> {t('investments.addBtn')}
                    </button>
                </div>
            );
        }

        return (
            <div className="border border-gray-200 rounded-lg mb-6 bg-white shadow-sm overflow-hidden">
                {/* Header */}
                <div 
                    className="p-5 flex items-center justify-between border-b border-gray-100 cursor-pointer bg-white"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-full text-slate-600">
                            <Icon size={24} />
                        </div>
                        <span className="font-semibold text-gray-800">{title} ({items.length})</span>
                    </div>
                    <button className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors">
                        {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                        {isCollapsed ? t('common.expand') : t('common.collapse')}
                    </button>
                </div>
                
                {/* Body */}
                {!isCollapsed && (
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
                                            <input 
                                                type="text" 
                                                className="w-full pl-16 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                value={item.amount}
                                                onChange={(e) => {
                                                    const rawValue = e.target.value.replace(/,/g, '').replace(/\D/g, '');
                                                    const formattedValue = rawValue ? parseInt(rawValue).toLocaleString('en-US') : '';
                                                    updateInvestmentItemField(collectionPath, item.id, 'amount', formattedValue);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClasses}>
                                            {t('common.description')} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
                                        </label>
                                        <input 
                                            type="text" 
                                            maxLength={100}
                                            className={inputClasses}
                                            value={item.description}
                                            onChange={(e) => updateInvestmentItemField(collectionPath, item.id, 'description', e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('common.maxChars')}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-2">
                            <button 
                                onClick={() => addInvestmentItem(collectionPath)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-xin-cyan transition-colors bg-slate-50 px-4 py-2 rounded-full border border-xin-cyan/20"
                            >
                                <PlusCircle size={18} /> Add Another Investment
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
                    <ExpandableInvestmentCard 
                        title={t('investments.etf')}
                        icon={TrendingUp}
                        collectionPath="etf"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.bonds')}
                        icon={Briefcase}
                        collectionPath="bonds"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.stocks')}
                        icon={LineChart}
                        collectionPath="stocks"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.unitTrusts')}
                        icon={Building2}
                        collectionPath="unitTrusts"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.fixedDeposits')}
                        icon={Landmark}
                        collectionPath="fixedDeposits"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.forex')}
                        icon={DollarSign}
                        collectionPath="forex"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.moneyMarket')}
                        icon={Wallet}
                        collectionPath="moneyMarket"
                    />
                    <ExpandableInvestmentCard 
                        title={t('investments.other')}
                        icon={FolderPlus}
                        collectionPath="otherInvestments"
                    />
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
