import React from 'react';
import { KYCData, ExpenseItem, FinancialItem } from '../../types';
import { User, Wallet, Home, Umbrella, Receipt, TrendingUp } from 'lucide-react';

interface ReviewSummaryStepProps {
    formData: KYCData;
    onEditStep: (stepId: string) => void;
    onNext: () => void;
    onPrev: () => void;
}

const parseAmount = (val: string) => parseInt(val.replace(/,/g, '') || '0', 10);

const calculateAnnualIncome = (income: any) => {
    let total = 0;
    total += parseAmount(income.monthlySalary) * 12;
    total += parseAmount(income.annualBonus);
    
    // Assuming rental is monthly
    income.rentalIncome?.forEach((item: any) => total += parseAmount(item.amount) * 12);
    // Assuming dividend is annual
    income.dividendIncome?.forEach((item: any) => total += parseAmount(item.amount));
    // Assuming other is monthly
    income.otherIncome?.forEach((item: any) => total += parseAmount(item.amount) * 12);
    
    return total;
};

const calculateTotalAssets = (assets: any) => {
    let total = 0;
    total += parseAmount(assets.savings);
    total += parseAmount(assets.epfSejahtera);
    total += parseAmount(assets.epfPersaraan);
    
    ['properties', 'vehicles', 'otherAssets'].forEach(key => {
        assets[key]?.forEach((item: FinancialItem) => total += parseAmount(item.amount));
    });
    
    return total;
};

const calculateTotalLiabilities = (liabilities: any) => {
    let total = 0;
    ['mortgages', 'carLoans', 'studyLoans', 'interestOnlyLoans', 'renovationLoans', 'otherLoans'].forEach(key => {
        liabilities[key]?.forEach((item: FinancialItem) => total += parseAmount(item.amount));
    });
    return total;
};

const calculateTotalExpenses = (expenses: any) => {
    let total = 0;
    const isYearlyType = (type: string) => type === 'Vacation/ Travel' || type === 'Income Tax Expense';

    ['household', 'transportation', 'dependants', 'personal', 'miscellaneous', 'otherExpenses'].forEach(key => {
        expenses[key]?.forEach((item: ExpenseItem) => {
            const amount = parseAmount(item.amount);
            total += isYearlyType(item.type) ? amount : amount * 12;
        });
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
            <div className={`p-2 rounded-md ${title === 'Profile' ? 'text-gray-600 bg-gray-100' : 'text-blue-500 bg-blue-50'}`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800 leading-tight">{title}</h3>
                <button onClick={() => onEdit(stepId)} className="text-sm text-xin-blue hover:underline">
                    [Edit Details]
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

const ReviewSummaryStep: React.FC<ReviewSummaryStepProps> = ({ formData, onEditStep, onNext, onPrev }) => {
    
    const annualIncome = calculateAnnualIncome(formData.income);
    const totalAssets = calculateTotalAssets(formData.assets);
    const totalLiabilities = calculateTotalLiabilities(formData.liabilities);
    const totalExpenses = calculateTotalExpenses(formData.expenses);
    const totalInvestments = calculateTotalInvestments(formData.investments);

    const formatCurrency = (val: number) => `RM ${val.toLocaleString('en-US')}`;

    return (
        <div className="flex flex-col h-full space-y-8 animate-in fade-in duration-300">
            <div className="bg-white p-6 lg:p-10 rounded-xl shadow-sm border border-gray-100 pb-12">
                
                <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-serif text-gray-800">Review Summary</h2>
                </div>
                <p className="text-lg text-gray-700 font-medium mb-10 border-b border-gray-100 pb-6">
                    Let's check if everything is correct before you submit!
                </p>

                {/* Profile Section */}
                <div className="mb-10">
                    <SectionHeader icon={User} title="Profile" onEdit={onEditStep} stepId="basic" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Email</div>
                            <div className="text-sm font-semibold">{formData.email || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Nationality</div>
                            <div className="text-sm font-semibold">{formData.nationality || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Residency</div>
                            <div className="text-sm font-semibold">{formData.residency || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tax Status</div>
                            <div className="text-sm font-semibold">{formData.taxStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">DOB</div>
                            <div className="text-sm font-semibold">{formData.dateOfBirth || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Retirement Age</div>
                            <div className="text-sm font-semibold">{formData.retirementAge || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Marital Status</div>
                            <div className="text-sm font-semibold">{formData.maritalStatus || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Employment Status</div>
                            <div className="text-sm font-semibold">{formData.employmentStatus || '-'}</div>
                        </div>
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Occupation</div>
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
                            title="Income" 
                            onEdit={onEditStep} 
                            stepId="income" 
                            totalLabel="TOTAL" 
                            totalValue={`${formatCurrency(annualIncome)}/year`} 
                        />
                        {annualIncome > 0 ? (
                            <div className="space-y-2">
                                {formData.income.monthlySalary && (
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-gray-700">Gross Income</span>
                                        <span className="font-medium text-gray-900">RM {formData.income.monthlySalary}/month</span>
                                    </div>
                                )}
                                {formData.income.annualBonus && (
                                    <div className="flex justify-between text-sm">
                                        <span className="font-semibold text-gray-700">Bonus</span>
                                        <span className="font-medium text-gray-900">RM {formData.income.annualBonus}/year</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No data available.</p>
                        )}
                    </div>

                    {/* Assets */}
                    <div>
                        <SectionHeader 
                            icon={Home} 
                            title="Assets" 
                            onEdit={onEditStep} 
                            stepId="assets" 
                            totalLabel="TOTAL" 
                            totalValue={formatCurrency(totalAssets)} 
                        />
                        {totalAssets > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Detailed assets are not displayed to save space. Click Edit to view.</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No data available.</p>
                        )}
                    </div>

                    {/* Liabilities */}
                    <div>
                        <SectionHeader 
                            icon={Umbrella} 
                            title="Liabilities" 
                            onEdit={onEditStep} 
                            stepId="liabilities" 
                            totalLabel="TOTAL" 
                            totalValue={formatCurrency(totalLiabilities)} 
                        />
                        {totalLiabilities > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Detailed liabilities are not displayed to save space. Click Edit to view.</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No data available.</p>
                        )}
                    </div>

                    {/* Expenses */}
                    <div>
                        <SectionHeader 
                            icon={Receipt} 
                            title="Expenses" 
                            onEdit={onEditStep} 
                            stepId="expenses" 
                            totalLabel="TOTAL" 
                            totalValue={`${formatCurrency(totalExpenses)}/year`} 
                        />
                        {totalExpenses > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Detailed expenses are not displayed to save space. Click Edit to view.</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No data available.</p>
                        )}
                    </div>

                    {/* Investments */}
                    <div>
                        <SectionHeader 
                            icon={TrendingUp} 
                            title="Investments" 
                            onEdit={onEditStep} 
                            stepId="investments" 
                            totalLabel="TOTAL" 
                            totalValue={formatCurrency(totalInvestments)} 
                        />
                        {totalInvestments > 0 ? (
                            <div className="space-y-2">
                                <p className="text-sm text-gray-700">Detailed investments are not displayed to save space. Click Edit to view.</p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">No data available.</p>
                        )}
                    </div>

                </div>

                {/* Navigation Buttons bottom */}
                <div className="mt-12 pt-6 flex justify-between items-center bg-white">
                    <button 
                        onClick={onPrev} 
                        className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-600 font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                        <span>&lt;</span> Back
                    </button>
                    <button 
                        onClick={onNext} 
                        className="px-10 py-2.5 bg-xin-blue text-white font-medium rounded-md hover:bg-blue-800 flex items-center gap-2 transition-colors shadow-sm"
                    >
                        Confirm <span>&gt;</span>
                    </button>
                </div>
            </div>
            
        </div>
    );
};

export default ReviewSummaryStep;
