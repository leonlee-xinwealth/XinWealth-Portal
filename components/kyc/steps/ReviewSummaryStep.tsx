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
                    {Icon === User ? '[Edit Details]' : '[Edit Details]'}
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

const ItemRow = ({ label, value }: { label: string, value: string }) => (
    <div className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value}</span>
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

    const formatCurrency = (val: number | string) => {
        const num = typeof val === 'string' ? parseAmount(val) : val;
        return `RM ${num.toLocaleString('en-US')}`;
    };

    const MONTH_LABELS: any = {
        '0': { en: 'January', zh: '1月' }, '1': { en: 'February', zh: '2月' }, '2': { en: 'March', zh: '3月' },
        '3': { en: 'April', zh: '4月' }, '4': { en: 'May', zh: '5月' }, '5': { en: 'June', zh: '6月' },
        '6': { en: 'July', zh: '7月' }, '7': { en: 'August', zh: '8月' }, '8': { en: 'September', zh: '9月' },
        '9': { en: 'October', zh: '10月' }, '10': { en: 'November', zh: '11月' }, '11': { en: 'December', zh: '12月' }
    };

    const selectedMonth = MONTH_LABELS[formData.globalMonth || '0'][isZh ? 'zh' : 'en'];
    const selectedYear = formData.globalYear || new Date().getFullYear().toString();

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-6">
                    <div>
                        <h2 className="text-2xl font-serif text-gray-800">{t('review.title')}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {isZh ? `所有填写的财务数据均属于 ${selectedMonth} ${selectedYear}` : `All financial data entered belongs to ${selectedMonth} ${selectedYear}`}
                        </p>
                    </div>
                </div>

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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-12">
                    
                    {/* Income */}
                    <div className="bg-slate-50/30 p-5 rounded-xl border border-slate-100">
                        <SectionHeader 
                            icon={Wallet} 
                            title={t('review.income')} 
                            onEdit={onEditStep} 
                            stepId="income" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(annualIncome)} 
                        />
                        <div className="space-y-1 mt-4">
                            {formData.income?.salary && <ItemRow label={isZh ? "工资 (月)" : "Salary (Monthly)"} value={formatCurrency(formData.income.salary)} />}
                            {formData.income?.directorFee && <ItemRow label={isZh ? "董事费 (月)" : "Director Fee (Monthly)"} value={formatCurrency(formData.income.directorFee)} />}
                            {formData.income?.commission && <ItemRow label={isZh ? "佣金 (月)" : "Commission (Monthly)"} value={formatCurrency(formData.income.commission)} />}
                            {formData.income?.rentalIncome && <ItemRow label={isZh ? "租金收入 (月)" : "Rental Income (Monthly)"} value={formatCurrency(formData.income.rentalIncome)} />}
                            {formData.income?.bonus && <ItemRow label={isZh ? "奖金 (年)" : "Bonus (Annual)"} value={formatCurrency(formData.income.bonus)} />}
                            {formData.income?.dividendCompany && <ItemRow label={isZh ? "公司股息 (年)" : "Company Dividends (Annual)"} value={formatCurrency(formData.income.dividendCompany)} />}
                            {formData.income?.dividendInvestment && <ItemRow label={isZh ? "投资股息 (年)" : "Investment Dividends (Annual)"} value={formatCurrency(formData.income.dividendInvestment)} />}
                        </div>
                    </div>

                    {/* Expenses */}
                    <div className="bg-slate-50/30 p-5 rounded-xl border border-slate-100">
                        <SectionHeader 
                            icon={Receipt} 
                            title={t('review.expenses')} 
                            onEdit={onEditStep} 
                            stepId="expenses" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalExpenses)} 
                        />
                        <div className="space-y-1 mt-4">
                            {Object.entries(formData.expenses || {}).map(([key, items]: [string, any]) => 
                                items.map((item: any) => (
                                    <ItemRow 
                                        key={item.id} 
                                        label={`${item.type}${item.description ? ` (${item.description})` : ''}`} 
                                        value={formatCurrency(item.amount)} 
                                    />
                                ))
                            )}
                            {/* Dynamically added expenses from loans */}
                            {formData.assets?.properties?.filter((p: any) => p.isUnderLoan && p.monthlyInstallment).map((p: any) => (
                                <ItemRow key={p.id} label={`${isZh ? '房贷' : 'Property Loan'}: ${p.description}`} value={formatCurrency(p.monthlyInstallment)} />
                            ))}
                            {formData.assets?.vehicles?.filter((v: any) => v.isUnderLoan && v.monthlyInstallment).map((v: any) => (
                                <ItemRow key={v.id} label={`${isZh ? '车贷' : 'Vehicle Loan'}: ${v.description}`} value={formatCurrency(v.monthlyInstallment)} />
                            ))}
                            {Object.entries(formData.liabilities || {}).map(([key, items]: [string, any]) => 
                                items.filter((l: any) => l.isUnderLoan && l.monthlyInstallment).map((l: any) => (
                                    <ItemRow key={l.id} label={`${isZh ? '贷款' : 'Loan'}: ${l.description}`} value={formatCurrency(l.monthlyInstallment)} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Assets */}
                    <div className="bg-slate-50/30 p-5 rounded-xl border border-slate-100">
                        <SectionHeader 
                            icon={Home} 
                            title={t('review.assets')} 
                            onEdit={onEditStep} 
                            stepId="assets" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalAssets)} 
                        />
                        <div className="space-y-1 mt-4">
                            {formData.assets?.savingsAccount && <ItemRow label={t('assets.savingsAccount')} value={formatCurrency(formData.assets.savingsAccount)} />}
                            {formData.assets?.fixedDeposit && <ItemRow label={t('assets.fixedDeposit')} value={formatCurrency(formData.assets.fixedDeposit)} />}
                            {formData.assets?.moneyMarketFund && <ItemRow label={t('assets.moneyMarketFund')} value={formatCurrency(formData.assets.moneyMarketFund)} />}
                            {formData.assets?.epfSejahtera && <ItemRow label={t('assets.epf.account2')} value={formatCurrency(formData.assets.epfSejahtera)} />}
                            {formData.assets?.epfPersaraan && <ItemRow label={t('assets.epf.account1')} value={formatCurrency(formData.assets.epfPersaraan)} />}
                            {formData.assets?.epfFleksibel && <ItemRow label={t('assets.epf.account3')} value={formatCurrency(formData.assets.epfFleksibel)} />}
                            
                            {['properties', 'vehicles', 'otherAssets'].map(key => 
                                formData.assets[key]?.map((item: any) => (
                                    <ItemRow key={item.id} label={item.description} value={formatCurrency(item.amount)} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Investments */}
                    <div className="bg-slate-50/30 p-5 rounded-xl border border-slate-100">
                        <SectionHeader 
                            icon={TrendingUp} 
                            title={t('review.investments')} 
                            onEdit={onEditStep} 
                            stepId="investments" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalInvestments)} 
                        />
                        <div className="space-y-1 mt-4">
                            {Object.entries(formData.investments || {}).map(([key, items]: [string, any]) => 
                                items.map((item: any) => (
                                    <ItemRow key={item.id} label={`${key.toUpperCase()}: ${item.description}`} value={formatCurrency(item.amount)} />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Liabilities */}
                    <div className="bg-slate-50/30 p-5 rounded-xl border border-slate-100">
                        <SectionHeader 
                            icon={Umbrella} 
                            title={t('review.liabilities')} 
                            onEdit={onEditStep} 
                            stepId="liabilities" 
                            totalLabel={t('review.total')} 
                            totalValue={formatCurrency(totalLiabilities)} 
                        />
                        <div className="space-y-1 mt-4">
                            {Object.entries(formData.liabilities || {}).map(([key, items]: [string, any]) => 
                                items.map((item: any) => (
                                    <ItemRow key={item.id} label={item.description} value={formatCurrency(item.outstandingBalance || item.amount)} />
                                ))
                            )}
                            {/* Dynamically added liabilities from assets */}
                            {formData.assets?.properties?.filter((p: any) => p.isUnderLoan).map((p: any) => (
                                <ItemRow key={p.id} label={`${isZh ? '房贷未分销' : 'Property Loan Balance'}: ${p.description}`} value={formatCurrency(p.outstandingBalance)} />
                            ))}
                            {formData.assets?.vehicles?.filter((v: any) => v.isUnderLoan).map((v: any) => (
                                <ItemRow key={v.id} label={`${isZh ? '车贷未分销' : 'Vehicle Loan Balance'}: ${v.description}`} value={formatCurrency(v.outstandingBalance)} />
                            ))}
                        </div>
                    </div>

                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 flex justify-between items-center bg-white border-t border-gray-100">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> {t('basic.back')}
                    </button>
                    <button 
                        onClick={onNext} 
                        className="px-10 py-2.5 bg-gradient-to-r from-xin-blue to-xin-blueLight text-white font-medium rounded-md hover:from-xin-dark hover:to-xin-blue flex items-center gap-3 transition-colors shadow-lg hover:shadow-xin-blue/20"
                    >
                        {t('review.confirm')} <span>&gt;</span>
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default ReviewSummaryStep;
