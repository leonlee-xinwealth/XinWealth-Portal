import React, { useState } from 'react';
import { KYCData, FinancialItem, KYCLiabilitiesData } from '../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Home, Car, GraduationCap, Percent, HardHat, FolderPlus, Trash2, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';

interface LiabilitiesStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const LiabilitiesStep: React.FC<LiabilitiesStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const isZh = language === 'zh';
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan transition-colors bg-white shadow-sm";
    const labelClasses = "block text-sm font-medium text-gray-700 font-sans";
    
    // Safety check just in case formData.liabilities is somehow missing
    const liabilitiesData = formData.liabilities || {
        mortgages: [],
        carLoans: [],
        studyLoans: [],
        interestOnlyLoans: [],
        renovationLoans: [],
        otherLoans: []
    };

    const updateLiabilities = (data: Partial<KYCLiabilitiesData>) => {
        updateData({ liabilities: { ...liabilitiesData, ...data } });
    };

    const addLoanItem = (collectionPath: keyof KYCLiabilitiesData) => {
        const newItems = [...liabilitiesData[collectionPath], { id: Date.now().toString() + Math.random().toString(), amount: '', description: '' }];
        updateLiabilities({ [collectionPath]: newItems });
    };

    const removeLoanItem = (collectionPath: keyof KYCLiabilitiesData, idToRemove: string) => {
        const newItems = liabilitiesData[collectionPath].filter(item => item.id !== idToRemove);
        updateLiabilities({ [collectionPath]: newItems });
    };

    const updateLoanItemField = (collectionPath: keyof KYCLiabilitiesData, idToUpdate: string, field: 'amount' | 'description', value: string) => {
        const newItems = liabilitiesData[collectionPath].map(item => 
            item.id === idToUpdate ? { ...item, [field]: value } : item
        );
        updateLiabilities({ [collectionPath]: newItems });
    };

    // Reusable Expandable Card for Loans
    const ExpandableLoanCard = ({ 
        title, 
        icon: Icon, 
        collectionPath, 
    }: { 
        title: string, 
        icon: React.ElementType, 
        collectionPath: keyof KYCLiabilitiesData,
    }) => {
        const items = liabilitiesData[collectionPath];
        const hasItems = items.length > 0;
        const [isCollapsed, setIsCollapsed] = useState(true);

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
                        {items.map((item, index) => (
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
                                    <div>
                                        <label className={labelClasses}>
                                            {isZh ? '未偿还余额' : 'Outstanding Balance'} <span className="text-gray-400 italic font-normal text-xs ml-2">{t('common.required')}</span>
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
                                                    updateLoanItemField(collectionPath, item.id, 'amount', formattedValue);
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
                
                <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
                    <h2 className="text-2xl font-serif text-gray-800">{t('liabilities.title')}</h2>
                </div>
                
                <div className="space-y-4">
                    <ExpandableLoanCard 
                        title={t('liabilities.mortgages')}
                        icon={Home}
                        collectionPath="mortgages"
                    />
                    <ExpandableLoanCard 
                        title={t('liabilities.car')}
                        icon={Car}
                        collectionPath="carLoans"
                    />
                    <ExpandableLoanCard 
                        title={t('liabilities.study')}
                        icon={GraduationCap}
                        collectionPath="studyLoans"
                    />
                    <ExpandableLoanCard 
                        title={t('liabilities.interest')}
                        icon={Percent}
                        collectionPath="interestOnlyLoans"
                    />
                    <ExpandableLoanCard 
                        title={t('liabilities.renovation')}
                        icon={HardHat}
                        collectionPath="renovationLoans"
                    />
                    <ExpandableLoanCard 
                        title={t('liabilities.others')}
                        icon={FolderPlus}
                        collectionPath="otherLoans"
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

export default LiabilitiesStep;
