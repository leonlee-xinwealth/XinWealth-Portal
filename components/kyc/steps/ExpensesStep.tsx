import React, { useState } from 'react';
import { KYCData, ExpenseItem, KYCExpensesData } from '../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { Home, Car, Baby, Trash2, ChevronDown, ChevronUp, PlusCircle, Receipt, Info, User, Package, FolderPlus } from 'lucide-react';
import { DebouncedTextInput, DebouncedNumberInput } from '../FormInputs';

interface ExpensesStepProps {
    formData: KYCData;
    updateData: (data: Partial<KYCData>) => void;
    onNext: () => void;
    onPrev: () => void;
}

const HOUSEHOLD_OPTIONS = [
    { value: 'All - Household', labelEn: 'All - Household', labelZh: '全部 - 家庭' },
    { value: 'Tel/ Mobile/ Internet', labelEn: 'Tel/ Mobile/ Internet', labelZh: '电话/手机/网络' },
    { value: 'Property Tax', labelEn: 'Property Tax', labelZh: '房产税' },
    { value: 'Home Maintenance', labelEn: 'Home Maintenance', labelZh: '房屋维护' },
    { value: 'Utilities Bills', labelEn: 'Utilities Bills', labelZh: '水电费' },
    { value: 'Groceries/Marketing', labelEn: 'Groceries/Marketing', labelZh: '杂货/买菜' },
    { value: "Maid's Levy/ Salary", labelEn: "Maid's Levy/ Salary", labelZh: '女佣税/薪水' },
    { value: 'Rental Expense', labelEn: 'Rental Expense', labelZh: '租金支出' }
];

const TRANSPORT_OPTIONS = [
    { value: 'All - Transport', labelEn: 'All - Transport', labelZh: '全部 - 交通' },
    { value: 'Road Tax', labelEn: 'Road Tax', labelZh: '路税' },
    { value: 'Parking Fee', labelEn: 'Parking Fee', labelZh: '停车费' },
    { value: 'Petrol', labelEn: 'Petrol', labelZh: '汽油' },
    { value: 'Servicing', labelEn: 'Servicing', labelZh: '保养/维修' },
    { value: 'Bus/ MRT/ Taxi/ Car Share', labelEn: 'Bus/ MRT/ Taxi/ Car Share', labelZh: '巴士/地铁/出租车/共享汽车' },
    { value: 'Car Insurance', labelEn: 'Car Insurance', labelZh: '汽车保险' }
];

const DEPENDANTS_OPTIONS = [
    { value: 'All - Dependants', labelEn: 'All - Dependants', labelZh: '全部 - 赡养/抚养' },
    { value: 'Child Care', labelEn: 'Child Care', labelZh: '儿童保育' },
    { value: "Children's School Fee", labelEn: "Children's School Fee", labelZh: '子女学费' },
    { value: 'Upgrading Class', labelEn: 'Upgrading Class', labelZh: '补习班/提升班' },
    { value: 'Dependant Allowances', labelEn: 'Dependant Allowances', labelZh: '家属津贴' },
    { value: 'Child Expenses', labelEn: 'Child Expenses', labelZh: '子女开销' },
    { value: 'Parent Allowance', labelEn: 'Parent Allowance', labelZh: '父母津贴' }
];

const PERSONAL_OPTIONS = [
    { value: 'All - Personal', labelEn: 'All - Personal', labelZh: '全部 - 个人' },
    { value: 'Entertainment', labelEn: 'Entertainment', labelZh: '娱乐' },
    { value: 'Dining Out', labelEn: 'Dining Out', labelZh: '外出就餐' },
    { value: 'Personal Care/ Clothing', labelEn: 'Personal Care/ Clothing', labelZh: '个人护理/服装' },
    { value: 'Vacation/ Travel', labelEn: 'Vacation/ Travel', labelZh: '度假/旅游' },
    { value: 'Donations/ Charity/ Gifts', labelEn: 'Donations/ Charity/ Gifts', labelZh: '捐款/慈善/礼物' },
    { value: 'Income Tax Expense', labelEn: 'Income Tax Expense', labelZh: '所得税支出' },
    { value: 'School Fees', labelEn: 'School Fees', labelZh: '学费' }
];

const MISC_OPTIONS = [
    { value: 'All - Miscellaneous', labelEn: 'All - Miscellaneous', labelZh: '全部 - 杂项' },
    { value: 'Medical Cost', labelEn: 'Medical Cost', labelZh: '医疗费用' }
];

const OTHER_EXPENSES_OPTIONS = [
    { value: 'Loan Repayment', labelEn: 'Loan Repayment', labelZh: '贷款偿还' }
];

// Helper to determine suffix
const getSuffixForType = (type: string) => {
    if (type === 'Vacation/ Travel' || type === 'Income Tax Expense') {
        return '/year';
    }
    return '/month';
};

const ExpensesStep: React.FC<ExpensesStepProps> = ({ formData, updateData, onNext, onPrev }) => {
    const { t, language } = useLanguage();
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const isZh = language === 'zh';
    const inputClasses = "w-full mt-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan transition-colors bg-white shadow-sm";
    
    // Safety check just in case formData.expenses is missing due to older state
    const expensesData = formData.expenses || {
        household: [],
        transportation: [],
        dependants: [],
        personal: [],
        miscellaneous: [],
        otherExpenses: []
    };

    const updateExpenses = (data: Partial<KYCExpensesData>) => {
        updateData({ expenses: { ...expensesData, ...data } });
    };

    const addExpenseItem = (collectionPath: keyof KYCExpensesData, defaultType: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = [...newArray, { id: Date.now().toString() + Math.random().toString(), type: defaultType, amount: '' }];
        updateExpenses({ [collectionPath]: newItems });
        setExpandedCard(collectionPath as string);
    };

    const removeExpenseItem = (collectionPath: keyof KYCExpensesData, idToRemove: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = newArray.filter(item => item.id !== idToRemove);
        updateExpenses({ [collectionPath]: newItems });
        if (newItems.length === 0) setExpandedCard(null);
    };

    const updateExpenseItemField = (collectionPath: keyof KYCExpensesData, idToUpdate: string, field: 'type' | 'amount', value: string) => {
        const newArray = expensesData[collectionPath] || [];
        const newItems = newArray.map(item => 
            item.id === idToUpdate ? { ...item, [field]: value } : item
        );
        updateExpenses({ [collectionPath]: newItems });
    };

    // Reusable render function for Expenses (prevents input focus loss)
    const renderExpandableExpenseCard = ( 
        title: string, 
        Icon: React.ElementType, 
        collectionPath: keyof KYCExpensesData,
        options: { value: string, labelEn: string, labelZh: string }[],
        defaultType: string 
    ) => {
        const items = expensesData[collectionPath] || [];
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
                        onClick={() => addExpenseItem(collectionPath, defaultType)} 
                        className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors"
                    >
                        <PlusCircle size={18} /> {t('expenses.add')}
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
                    <button className="text-xin-blue flex items-center gap-1.5 text-sm font-medium hover:text-xin-cyan transition-colors overflow-hidden">
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        {isOpen ? t('common.collapse') : t('common.expand')}
                    </button>
                </div>
                
                {/* Body */}
                {isOpen && (
                    <div className="bg-slate-50 p-6 space-y-4">
                        <div className="hidden md:grid grid-cols-12 gap-4 px-2 mb-2">
                            <div className="col-span-12 md:col-span-6 text-sm font-semibold text-gray-700">{t('common.type')}</div>
                            <div className="col-span-12 md:col-span-6 text-sm font-semibold text-gray-700">{t('common.amount')}</div>
                        </div>

                        {items.map((item, index) => (
                            <div key={item.id} className="relative bg-white p-4 rounded-md border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-start gap-4">
                                
                                {/* Type Dropdown */}
                                <div className="w-full md:w-1/2">
                                    <label className="block md:hidden text-sm font-semibold text-gray-700 mb-1">{t('common.type')}</label>
                                    <select
                                        className={inputClasses + " cursor-pointer !mt-0"}
                                        value={item.type}
                                        onChange={(e) => updateExpenseItemField(collectionPath, item.id, 'type', e.target.value)}
                                    >
                                        {options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{isZh ? opt.labelZh : opt.labelEn}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount Input & Delete */}
                                <div className="w-full md:w-1/2 flex items-start gap-3">
                                    <div className="w-full">
                                        <label className="block md:hidden text-sm font-semibold text-gray-700 mb-1">{t('common.amount')}</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none border-r border-gray-200 pr-3 my-px bg-slate-50 rounded-l-md">
                                                <span className="text-gray-500 font-medium">RM</span>
                                            </div>
                                            <DebouncedNumberInput 
                                                className="w-full pl-16 pr-20 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-xin-cyan focus:border-xin-cyan bg-white shadow-sm"
                                                value={item.amount}
                                                onChange={(val) => updateExpenseItemField(collectionPath, item.id, 'amount', val)}
                                            />
                                            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-gray-400 text-sm font-medium border-l border-gray-200 pl-3 my-2">
                                                {getSuffixForType(item.type) === '/month' ? t('common.perMonth') : t('common.perYear')}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => removeExpenseItem(collectionPath, item.id)} 
                                        className="text-red-500 hover:text-red-700 p-2 mt-px bg-red-50 hover:bg-red-100 rounded-md transition-colors flex-shrink-0"
                                        title={t('common.delete')}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                            </div>
                        ))}
                        
                        <div className="flex justify-center pt-4">
                            <button 
                                onClick={() => addExpenseItem(collectionPath, defaultType)} 
                                className="text-xin-blue flex items-center gap-2 text-sm font-semibold hover:text-xin-cyan transition-colors bg-slate-50 px-4 py-2 rounded-full border border-xin-cyan/20"
                            >
                                <PlusCircle size={18} /> {isZh ? '添加另一项支出' : 'Add Another Expense'}
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
                
                <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-5">
                    <div className="bg-slate-50 border border-xin-gold/20 p-2 rounded-md text-xin-blue">
                        <Receipt size={24} />
                    </div>
                    <h2 className="text-2xl font-serif text-gray-800">{t('expenses.title')}</h2>
                </div>

                {/* Info Banner */}
                <div className="bg-xin-cyan/10 border border-xin-cyan/20 text-xin-blue p-4 rounded-lg flex items-start gap-3 mb-8">
                    <Info size={20} className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-relaxed">
                        {t('expenses.info')}
                    </p>
                </div>
                
                <div className="space-y-4">
                    {renderExpandableExpenseCard(t('expenses.household'), Home, "household", HOUSEHOLD_OPTIONS, "All - Household")}
                    {renderExpandableExpenseCard(t('expenses.transport'), Car, "transportation", TRANSPORT_OPTIONS, "All - Transport")}
                    {renderExpandableExpenseCard(t('expenses.dependants'), Baby, "dependants", DEPENDANTS_OPTIONS, "All - Dependants")}
                    {renderExpandableExpenseCard(t('expenses.personal'), User, "personal", PERSONAL_OPTIONS, "All - Personal")}
                    {renderExpandableExpenseCard(t('expenses.misc'), Package, "miscellaneous", MISC_OPTIONS, "All - Miscellaneous")}
                    {renderExpandableExpenseCard(t('expenses.others'), FolderPlus, "otherExpenses", OTHER_EXPENSES_OPTIONS, "Loan Repayment")}
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

export default ExpensesStep;
