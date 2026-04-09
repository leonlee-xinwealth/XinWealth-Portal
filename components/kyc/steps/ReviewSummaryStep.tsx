import React from 'react';
import { KYCData, ExpenseItem, FinancialItem } from '../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { User, Wallet, Home, Umbrella, Receipt, TrendingUp } from 'lucide-react';

interface ReviewSummaryStepProps {
    formData: KYCData;
    onEditStep: (stepId: string) => void;
    onNext: () => void;
    onPrev: () => void;
}

const parseAmount = (val: string) => parseInt(val.replace(/,/g, '') || '0', 10);

const calculateAnnualIncome = (income: any) => {
    if (!income) return 0;
    let total = 0;
    
    // Monthly * 12
    total += parseAmount(income.salary) * 12;
    total += parseAmount(income.directorFee) * 12;
    total += parseAmount(income.commission) * 12;
    total += parseAmount(income.rentalIncome) * 12;
    
    // Annual
    total += parseAmount(income.bonus);
    total += parseAmount(income.dividendCompany);
    total += parseAmount(income.dividendInvestment);
    
    return total;
};

const calculateTotalAssets = (assets: any) => {
    let total = 0;
    total += parseAmount(assets.savingsAccount);
    total += parseAmount(assets.fixedDeposit);
    total += parseAmount(assets.moneyMarketFund);
    total += parseAmount(assets.epfSejahtera);
    total += parseAmount(assets.epfPersaraan);
    total += parseAmount(assets.epfFleksibel);
    
    ['properties', 'vehicles', 'otherAssets'].forEach(key => {
        assets[key]?.forEach((item: FinancialItem) => total += parseAmount(item.amount));
    });
    
    return total;
};

const calculateTotalLiabilities = (formData: any) => {
    let total = 0;
    const liabilities = formData.liabilities;
    ['studyLoans', 'personalLoans', 'renovationLoans', 'otherLoans'].forEach(key => {
        liabilities[key]?.forEach((item: FinancialItem) => {
            if (item.isUnderLoan && item.outstandingBalance) {
                total += parseAmount(item.outstandingBalance);
            } else if (!item.isUnderLoan) {
                total += parseAmount(item.amount);
            }
        });
    });
    
    // Add dynamically from assets
    const assets = formData.assets;
    ['properties', 'vehicles'].forEach(key => {
        assets[key]?.forEach((item: any) => {
            if (item.isUnderLoan && item.outstandingBalance) {
                total += parseAmount(item.outstandingBalance);
            }
        });
    });

    // Add dynamically from investments (investment properties / fixedDeposits)
    const investments = formData.investments;
    investments?.fixedDeposits?.forEach((item: any) => {
        if (item.isUnderLoan && item.outstandingBalance) {
            total += parseAmount(item.outstandingBalance);
        }
    });
    
    return total;
};

const calculateTotalExpenses = (formData: any) => {
    let total = 0;
    const expenses = formData.expenses;
    const isYearlyType = (type: string) => type === 'Vacation/ Travel' || type === 'Income Tax Expense';

    ['household', 'transportation', 'dependants', 'personal', 'miscellaneous', 'otherExpenses'].forEach(key => {
        expenses[key]?.forEach((item: ExpenseItem) => {
            const amount = parseAmount(item.amount);
            total += isYearlyType(item.type) ? amount : amount * 12;
        });
    });
    
    // Add dynamically from assets monthly installments
    const assets = formData.assets;
    ['properties', 'vehicles'].forEach(key => {
        assets[key]?.forEach((item: any) => {
            if (item.isUnderLoan && item.monthlyInstallment) {
                total += parseAmount(item.monthlyInstallment) * 12;
            }
        });
    });

    // Add dynamically from liabilities monthly installments
    const liabilities = formData.liabilities;
    ['studyLoans', 'personalLoans', 'renovationLoans', 'otherLoans'].forEach(key => {
        liabilities[key]?.forEach((item: any) => {
            if (item.isUnderLoan && item.monthlyInstallment) {
                total += parseAmount(item.monthlyInstallment) * 12;
            }
        });
    });

    // Add dynamically from investments monthly installments
    const investments = formData.investments;
    investments?.fixedDeposits?.forEach((item: any) => {
        if (item.isUnderLoan && item.monthlyInstallment) {
            total += parseAmount(item.monthlyInstallment) * 12;
        }
    });

    return total;
};

const calculateTotalInvestments = (investments: any) => {
    let total = 0;
    ['etf', 'bonds', 'stocks', 'unitTrusts', 'fixedDeposits', 'forex', 'moneyMarket', 'otherInvestments'].forEach(key => {
        investments[key]?.forEach((item: FinancialItem) => total += parseAmount(item.amount));
    });
    return total;
};

const SectionHeader = ({ icon: Icon, title, onEdit, totalLabel, totalValue, stepId }: any) => (
    <div className="flex items-start justify-between border-b border-gray-100 pb-3 mb-4">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${title === 'Profile' ? 'text-gray-600 bg-gray-100' : 'text-xin-blue bg-slate-50'}`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800 leading-tight">{title}</h3>
                <button onClick={() => onEdit(stepId)} className="text-sm text-xin-blue hover:underline">
                    [{totalLabel ? title : title}] {/* Temporarily hack since title is passed in to be translatable but we want to translate "[Edit Details]" string */}
                </button>
            </div>
        </div>
        {totalLabel && (
            <div className="text-right">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">{totalLabel}</div>
                <div className="text-lg font-bold text-gray-800">{totalValue}</div>
            </div>
        )}
    </div>
);

const ReviewSummaryStep: React.FC<ReviewSummaryStepProps> = ({ 
    formData, 
    onEditStep, 
    onNext, 
    onPrev 
}: ReviewSummaryStepProps) => {
    const { t, language } = useLanguage();
    const isZh = language === 'zh';
    
    const annualIncome = calculateAnnualIncome(formData.income);
    const totalAssets = calculateTotalAssets(formData.assets);
    const totalLiabilities = calculateTotalLiabilities(formData);
    const totalExpenses = calculateTotalExpenses(formData);
    const totalInvestments = calculateTotalInvestments(formData.investments);

    const formatCurrency = (val: number) => `RM ${val.toLocaleString('en-US')}`;

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-serif text-gray-800">{t('review.title')}</h2>
                </div>
                <p className="text-lg text-gray-700 font-medium mb-10 border-b border-gray-100 pb-6">
                    {t('review.subtitle')}
                </p>

                {/* Profile Section */}
                <div className="mb-10">
                    <SectionHeader icon={User} title={t('review.profile')} onEdit={onEditStep} stepId="basic" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.name')}</div>
                            <div className="text-sm font-semibold">{`${formData.familyName || ''} ${formData.givenName || ''}`.trim() || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.email')}</div>
                            <div className="text-sm font-semibold">{formData.email || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.nationality')}</div>
                            <div className="text-sm font-semibold">{formData.nationality || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.residency')}</div>
                            <div className="text-sm font-semibold">{formData.residency || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.tax')}</div>
                            <div className="text-sm font-semibold">{formData.taxStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.dob')}</div>
                            <div className="text-sm font-semibold">{formData.dateOfBirth || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.retirement')}</div>
                            <div className="text-sm font-semibold">{formData.retirementAge || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.marital')}</div>
                            <div className="text-sm font-semibold">{formData.maritalStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.employment')}</div>
                            <div className="text-sm font-semibold">{formData.employmentStatus || '-'}</div>
                        </div>
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{t('basic.occupation')}</div>
                            <div className="text-sm font-semibold">{formData.occupation || '-'}</div>
                        </div>
                    </div>
                </div>

                {/* Financial 2-Column Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    
                    {/* Income */}
                    <div>
                        <SectionHeader 
                            icon={Wallet} 
                            title={t('review.income')} 
                            onEdit={onEditStep} 
                            stepId="income" 
                            totalLabel={t('review.total')} 
                            totalValue={`${formatCurrency(annualIncome)}${isZh ? '/年' : '/year'}`} 
                        />
                        {annualIncome > 0 ? (
                            <div className="space-y-2">
                                {formData.income?.salary && (
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-gray-700">{t('review.grossIncome')}</span>
                                        <span className="font-medium text-gray-900">RM {formData.income.salary}{isZh ? '/月' : '/month'}</span>
                                    </div>
                                )}
                                {formData.income?.bonus && (
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-gray-700">{t('review.bonus')}</span>
                                        <span className="font-medium text-gray-900">RM {formData.income.bonus}{isZh ? '/年' : '/year'}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('review.noData')}</p>
                        )}
                    </div>

                    {/* Expenses */}
                    <div>
                        <SectionHeader 
                            icon={Receipt} 
                            title={t('review.expenses')} 
                            onEdit={onEditStep} 
                            stepId="expenses" 
                            totalLabel={t('review.total')} 
                            totalValue={`${formatCurrency(totalExpenses)}${isZh ? '/年' : '/year'}`} 
                        />
                        {totalExpenses > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">{t('review.hiddenDetails')}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('review.noData')}</p>
                        )}
                    </div>

                    {/* Assets */}
                    <div>
                        <SectionHeader 
                            icon={Home} 
                            title={t('review.assets')} 
                            onEdit={onEditStep} 
                            stepId="assets" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalAssets)} 
                        />
                        {totalAssets > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">{t('review.hiddenDetails')}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('review.noData')}</p>
                        )}
                    </div>

                    {/* Investments */}
                    <div>
                        <SectionHeader 
                            icon={TrendingUp} 
                            title={t('review.investments')} 
                            onEdit={onEditStep} 
                            stepId="investments" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalInvestments)} 
                        />
                        {totalInvestments > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">{t('review.hiddenDetails')}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('review.noData')}</p>
                        )}
                    </div>

                    {/* Liabilities */}
                    <div>
                        <SectionHeader 
                            icon={Umbrella} 
                            title={t('review.liabilities')} 
                            onEdit={onEditStep} 
                            stepId="liabilities" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalLiabilities)} 
                        />
                        {totalLiabilities > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">{t('review.hiddenDetails')}</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">{t('review.noData')}</p>
                        )}
                    </div>

                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 flex justify-between items-center bg-white">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> {t('basic.back')}
                    </button>
                    <button 
                        onClick={onNext} 
                        className="px-10 py-2.5 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white font-medium rounded-md hover:from-xin-dark hover:to-xin-blue flex items-center gap-2 transition-colors shadow-sm"
                    >
                        {t('review.confirm')} <span>&gt;</span>
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default ReviewSummaryStep;
